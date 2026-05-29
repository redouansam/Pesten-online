import express from "express";
import cors from "cors";
import http from "http";
import { Server, Socket } from "socket.io";
import { randomUUID } from "crypto";
import {
  clampCurrentPlayerIndex,
  createRoom,
  drawCards,
  generateRoomCode,
  getCurrentPlayer,
  getPublicRoomState,
  passTurn,
  playBotTurn,
  playCard,
  redrawDrawnCard,
  reorderHand,
  resetToLobby,
  sortHand,
  startGame,
} from "./game";
import {
  GameRoom,
  Player,
  PublicRoomSummary,
  RoomMode,
  RoomVisibility,
  Suit,
} from "./types";

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map<string, GameRoom>();
const socketToRoom = new Map<string, string>();
const socketToPlayerId = new Map<string, string>();
const disconnectGraceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const botTurnTimers = new Map<string, ReturnType<typeof setTimeout>>();

let reconnectGraceMs = Number(process.env.RECONNECT_GRACE_MS) || 3 * 60 * 1000;

const validSuits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

type SessionPayload = {
  code?: string;
  playerId?: string;
  name?: string;
};

type SessionEventName = "room_created" | "room_joined" | "reconnected";
type CreateRoomPayload = SessionPayload & {
  visibility?: RoomVisibility;
  mode?: RoomMode;
};

const validRoomModes: RoomMode[] = ["friends", "casual", "quick"];
const validRoomVisibilities: RoomVisibility[] = ["private", "public"];

function isValidSuit(value: unknown): value is Suit {
  return typeof value === "string" && validSuits.includes(value as Suit);
}

function sanitizePlayerName(name: unknown) {
  if (typeof name !== "string") return "Speler";

  const trimmedName = name.trim().slice(0, 18);

  return trimmedName || "Speler";
}

function sanitizeRoomMode(value: unknown, fallback: RoomMode): RoomMode {
  return typeof value === "string" && validRoomModes.includes(value as RoomMode)
    ? (value as RoomMode)
    : fallback;
}

function sanitizeRoomVisibility(
  value: unknown,
  fallback: RoomVisibility
): RoomVisibility {
  return typeof value === "string" &&
    validRoomVisibilities.includes(value as RoomVisibility)
    ? (value as RoomVisibility)
    : fallback;
}

app.get("/", (_req, res) => {
  res.send("Pesten multiplayer server draait");
});

function getConnectedPlayerCount(room: GameRoom) {
  return room.players.filter((player) => player.isBot || isConnectedHuman(player))
    .length;
}

function getRoomStatus(room: GameRoom) {
  return room.started && room.turnState !== "finished" ? "in_game" : "waiting";
}

function isHuman(player: Player) {
  return !player.isBot;
}

function isConnectedHuman(player: Player) {
  return isHuman(player) && player.connected && Boolean(player.socketId);
}

function getHumans(room: GameRoom) {
  return room.players.filter(isHuman);
}

function getConnectedHumans(room: GameRoom) {
  return room.players.filter(isConnectedHuman);
}

function getHost(room: GameRoom) {
  return room.players.find((player) => player.id === room.hostId);
}

function hasConnectedHumanHost(room: GameRoom) {
  const host = getHost(room);

  return Boolean(host && isConnectedHuman(host));
}

function migrateHost(room: GameRoom) {
  const currentHost = getHost(room);

  if (currentHost && isConnectedHuman(currentHost)) {
    return true;
  }

  const nextHumanHost = getConnectedHumans(room)[0];

  if (nextHumanHost) {
    if (room.hostId !== nextHumanHost.id) {
      room.hostId = nextHumanHost.id;
      room.lastMessage = `${nextHumanHost.name} is nu host.`;
    }

    return true;
  }

  const reservedHumanHost = currentHost && isHuman(currentHost)
    ? currentHost
    : getHumans(room)[0];

  if (reservedHumanHost) {
    room.hostId = reservedHumanHost.id;
  }

  return false;
}

function clearBotTurn(roomCode: string) {
  const timer = botTurnTimers.get(roomCode);

  if (!timer) return;

  clearTimeout(timer);
  botTurnTimers.delete(roomCode);
}

function closeRoom(
  roomCode: string,
  reason: string,
  message = "Tafel gesloten omdat er niet genoeg spelers over zijn."
) {
  const room = rooms.get(roomCode);

  if (!room) return false;

  clearBotTurn(roomCode);

  const notifiedSockets = new Set<string>();

  for (const player of room.players) {
    clearDisconnectGrace(player.id);

    if (!player.socketId) continue;

    notifiedSockets.add(player.socketId);
    io.to(player.socketId).emit("room_closed", {
      code: roomCode,
      reason,
      message,
    });
    socketToRoom.delete(player.socketId);
    socketToPlayerId.delete(player.socketId);
    io.sockets.sockets.get(player.socketId)?.leave(roomCode);
  }

  for (const [socketId, mappedRoomCode] of socketToRoom) {
    if (mappedRoomCode !== roomCode) continue;

    if (!notifiedSockets.has(socketId)) {
      io.to(socketId).emit("room_closed", {
        code: roomCode,
        reason,
        message,
      });
    }

    socketToRoom.delete(socketId);
    socketToPlayerId.delete(socketId);
    io.sockets.sockets.get(socketId)?.leave(roomCode);
  }

  rooms.delete(roomCode);
  console.log(`Kamer ${roomCode} gesloten (${reason})`);

  return true;
}

function remainingRoundPlayerCount(room: GameRoom) {
  return room.players.filter(
    (player) =>
      room.roundPlayerIds.includes(player.id) &&
      !room.finishedPlayerIds.includes(player.id)
  ).length;
}

function abortActiveGameToLobby(room: GameRoom, message: string) {
  resetToLobby(room);
  room.lastMessage = message;
  migrateHost(room);
}

function validateRoomInvariant(roomCode: string) {
  const room = rooms.get(roomCode);

  if (!room) return false;

  if (getHumans(room).length === 0) {
    closeRoom(roomCode, "bot_only");
    return false;
  }

  migrateHost(room);

  const host = getHost(room);

  if (!host || host.isBot) {
    closeRoom(roomCode, "invalid_host");
    return false;
  }

  if (
    room.started &&
    room.turnState !== "finished" &&
    room.roundPlayerIds.length > 0 &&
    remainingRoundPlayerCount(room) < 2
  ) {
    abortActiveGameToLobby(
      room,
      "Tafel teruggezet omdat er niet genoeg spelers over zijn."
    );
  }

  return true;
}

function isPublicWaitingRoom(room: GameRoom) {
  return (
    room.visibility === "public" &&
    !room.started &&
    room.turnState !== "finished" &&
    hasConnectedHumanHost(room) &&
    getConnectedHumans(room).length > 0 &&
    room.players.length < room.maxPlayers
  );
}

function getPublicRoomSummary(room: GameRoom): PublicRoomSummary {
  return {
    code: room.code,
    hostName:
      room.players.find((player) => player.id === room.hostId)?.name ?? "Speler",
    playerCount: getConnectedPlayerCount(room),
    maxPlayers: room.maxPlayers,
    status: getRoomStatus(room),
    region: room.region,
    mode: room.mode,
    createdAt: room.createdAt,
  };
}

function getPublicRooms() {
  for (const roomCode of [...rooms.keys()]) {
    validateRoomInvariant(roomCode);
  }

  return [...rooms.values()]
    .filter(isPublicWaitingRoom)
    .sort((roomA, roomB) => roomA.createdAt - roomB.createdAt)
    .map(getPublicRoomSummary);
}

function emitPublicRooms(socket: Socket) {
  socket.emit("public_rooms", getPublicRooms());
}

function scheduleBotTurn(roomCode: string) {
  if (botTurnTimers.has(roomCode)) return;

  if (!validateRoomInvariant(roomCode)) return;

  const room = rooms.get(roomCode);
  const currentPlayer = room ? getCurrentPlayer(room) : undefined;

  if (
    !room ||
    getConnectedHumans(room).length === 0 ||
    !currentPlayer?.isBot ||
    !room.started ||
    room.turnState === "finished"
  ) {
    return;
  }

  const timer = setTimeout(() => {
    botTurnTimers.delete(roomCode);

    const latestRoom = rooms.get(roomCode);
    const bot = latestRoom ? getCurrentPlayer(latestRoom) : undefined;

    if (
      !validateRoomInvariant(roomCode) ||
      !latestRoom ||
      getConnectedHumans(latestRoom).length === 0 ||
      !bot?.isBot ||
      !latestRoom.started ||
      latestRoom.turnState === "finished"
    ) {
      return;
    }

    try {
      playBotTurn(latestRoom, bot.id);
      sendRoomUpdate(roomCode);
    } catch (error) {
      latestRoom.lastMessage = `${bot.name} kon geen zet doen.`;
      console.warn(
        `Bot zet mislukt in ${roomCode}:`,
        error instanceof Error ? error.message : error
      );
      sendRoomUpdate(roomCode);
    }
  }, 650);

  timer.unref?.();
  botTurnTimers.set(roomCode, timer);
}

function sendRoomUpdate(roomCode: string) {
  if (!validateRoomInvariant(roomCode)) return;

  const room = rooms.get(roomCode);

  if (!room) return;

  for (const player of room.players) {
    if (!player.socketId) continue;

    io.to(player.socketId).emit("room_updated", getPublicRoomState(room, player.id));
  }

  scheduleBotTurn(roomCode);
}

function findRoomByPlayerId(playerId: string) {
  for (const room of rooms.values()) {
    const player = room.players.find((item) => item.id === playerId);

    if (player) {
      return {
        room,
        player,
      };
    }
  }

  return null;
}

function clearForcedTurnState(room: GameRoom, message?: string) {
  const isForcedTurn =
    room.turnState === "after_draw" ||
    room.turnState === "must_play" ||
    room.turnState === "seven_chain";

  if (!isForcedTurn) return false;

  room.turnState = "normal";
  room.sevenSuit = undefined;
  room.sevenStopAfterNext = false;
  room.redrawOffer = undefined;

  if (message) {
    room.lastMessage = message;
  }

  return true;
}

function scheduleRoomCleanup(roomCode: string) {
  const timer = setTimeout(() => {
    const room = rooms.get(roomCode);

    if (!room) return;

    const hasConnectedHumans = getConnectedHumans(room).length > 0;

    if (!hasConnectedHumans && getHumans(room).length === 0) {
      closeRoom(roomCode, "no_humans");
      return;
    }

    if (!hasConnectedHumans && getHumans(room).every((player) => !player.connected)) {
      console.log(`Kamer ${roomCode} wacht nog op reconnect van menselijke spelers`);
    }
  }, 10 * 60 * 1000);

  timer.unref?.();
}

function clearDisconnectGrace(playerId: string) {
  const timer = disconnectGraceTimers.get(playerId);

  if (!timer) return;

  clearTimeout(timer);
  disconnectGraceTimers.delete(playerId);
}

function scheduleDisconnectGrace(roomCode: string, playerId: string) {
  clearDisconnectGrace(playerId);

  const timer = setTimeout(() => {
    disconnectGraceTimers.delete(playerId);

    const room = rooms.get(roomCode);

    if (!room) return;

    const player = room.players.find((item) => item.id === playerId);

    if (!player || player.connected) return;

    console.log(
      `${player.name} (${player.id}) niet terug binnen grace; verwijderen uit ${roomCode}`
    );
    removePlayerFromRoom(roomCode, playerId);
  }, reconnectGraceMs);

  timer.unref?.();

  disconnectGraceTimers.set(playerId, timer);
}

function removePlayerFromRoom(roomCode: string, playerId: string) {
  const room = rooms.get(roomCode);

  if (!room) return;

  const currentPlayerBeforeLeave = getCurrentPlayer(room);
  const leavingPlayer = room.players.find((player) => player.id === playerId);
  const leavingWasCurrentPlayer = currentPlayerBeforeLeave?.id === playerId;

  room.players = room.players.filter((player) => player.id !== playerId);
  clearDisconnectGrace(playerId);
  delete room.hands[playerId];
  delete room.rematchVotes[playerId];
  room.roundPlayerIds = room.roundPlayerIds.filter((id) => id !== playerId);
  room.finishedPlayerIds = room.finishedPlayerIds.filter((id) => id !== playerId);

  if (room.winnerId === playerId) {
    room.winnerId = room.finishedPlayerIds[0];
  }

  if (room.loserId === playerId) {
    room.loserId = undefined;
  }

  if (room.players.length === 0) {
    closeRoom(roomCode, "empty");
    return;
  }

  if (!leavingWasCurrentPlayer && currentPlayerBeforeLeave) {
    const currentPlayerIndex = room.players.findIndex(
      (player) => player.id === currentPlayerBeforeLeave.id
    );

    room.currentPlayerIndex = currentPlayerIndex === -1 ? 0 : currentPlayerIndex;
  } else {
    clampCurrentPlayerIndex(room);
  }

  const clearedForcedTurn =
    leavingWasCurrentPlayer &&
    clearForcedTurnState(
      room,
      `${leavingPlayer?.name ?? "Een speler"} heeft de kamer verlaten; de beurt gaat door.`
    );

  const messageBeforeValidation = room.lastMessage;

  validateRoomInvariant(roomCode);

  if (!rooms.has(roomCode)) return;

  if (!clearedForcedTurn && room.lastMessage === messageBeforeValidation) {
    room.lastMessage = `${leavingPlayer?.name ?? "Een speler"} heeft de kamer verlaten.`;
  }

  sendRoomUpdate(roomCode);
}

function createPlayer(socketId: string, name: string, isBot = false): Player {
  return {
    id: randomUUID(),
    socketId,
    name,
    connected: true,
    ready: true,
    isBot,
  };
}

function attachPlayerSocket(
  socket: Socket,
  roomCode: string,
  room: GameRoom,
  player: Player,
  eventName: SessionEventName,
  name?: string
) {
  const previousSocketId = player.socketId;

  if (previousSocketId && previousSocketId !== socket.id) {
    socketToRoom.delete(previousSocketId);
    socketToPlayerId.delete(previousSocketId);
    io.sockets.sockets.get(previousSocketId)?.leave(roomCode);
  }

  if (!room.started && name) {
    player.name = sanitizePlayerName(name);
  }

  player.socketId = socket.id;
  player.connected = true;
  player.disconnectedAt = undefined;
  clearDisconnectGrace(player.id);

  socketToRoom.set(socket.id, roomCode);
  socketToPlayerId.set(socket.id, player.id);
  socket.join(roomCode);

  migrateHost(room);

  socket.emit(eventName, {
    code: roomCode,
    playerId: player.id,
  });
  socket.emit("room_state", getPublicRoomState(room, player.id));

  room.lastMessage =
    eventName === "reconnected"
      ? `${player.name} is terug verbonden.`
      : room.lastMessage;

  sendRoomUpdate(roomCode);
}

function recoverExistingPlayer(socket: Socket, payload: SessionPayload) {
  if (!payload.playerId) return false;

  const roomCode = payload.code?.trim().toUpperCase();
  const found = roomCode
    ? (() => {
        const room = rooms.get(roomCode);
        const player = room?.players.find((item) => item.id === payload.playerId);

        return room && player ? { room, player } : null;
      })()
    : findRoomByPlayerId(payload.playerId);

  if (!found) return false;

  attachPlayerSocket(
    socket,
    found.room.code,
    found.room,
    found.player,
    "reconnected",
    payload.name
  );

  console.log(
    `${found.player.name} herstelde sessie in kamer ${found.room.code}`
  );

  return true;
}

io.on("connection", (socket) => {
  console.log("Speler verbonden:", socket.id);

  socket.on("create_room", ({ name, playerId, visibility, mode }: CreateRoomPayload) => {
    if (recoverExistingPlayer(socket, { playerId, name })) return;

    const existingRoomCode = socketToRoom.get(socket.id);
    const existingPlayerId = socketToPlayerId.get(socket.id);
    const existingRoom = existingRoomCode ? rooms.get(existingRoomCode) : undefined;
    const existingPlayer = existingRoom?.players.find(
      (player) => player.id === existingPlayerId
    );

    if (existingRoom && existingPlayer) {
      attachPlayerSocket(
        socket,
        existingRoom.code,
        existingRoom,
        existingPlayer,
        "room_created",
        name
      );
      return;
    }

    const playerName = sanitizePlayerName(name);
    const code = generateRoomCode([...rooms.keys()]);
    const player = createPlayer(socket.id, playerName);
    const roomVisibility = sanitizeRoomVisibility(visibility, "private");
    const roomMode = sanitizeRoomMode(
      mode,
      roomVisibility === "public" ? "casual" : "friends"
    );

    const room = createRoom(code, player, {
      visibility: roomVisibility,
      mode: roomMode,
      maxPlayers: 4,
    });

    rooms.set(code, room);

    console.log(`${playerName} maakte kamer ${code}`);
    attachPlayerSocket(socket, code, room, player, "room_created");
  });

  socket.on("join_room", ({ code, name, playerId }: SessionPayload) => {
    const roomCode = code?.trim().toUpperCase();
    const playerName = sanitizePlayerName(name);

    if (!roomCode) {
      socket.emit("error_message", "Kamer bestaat niet");
      return;
    }

    if (!validateRoomInvariant(roomCode)) {
      socket.emit("error_message", "Kamer bestaat niet");
      return;
    }

    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit("error_message", "Kamer bestaat niet");
      return;
    }

    const reconnectingPlayer = playerId
      ? room.players.find((item) => item.id === playerId)
      : undefined;

    if (reconnectingPlayer) {
      attachPlayerSocket(
        socket,
        roomCode,
        room,
        reconnectingPlayer,
        "room_joined",
        playerName
      );
      console.log(`${reconnectingPlayer.name} herstelde join in kamer ${roomCode}`);
      return;
    }

    const existingRoomCode = socketToRoom.get(socket.id);
    const existingPlayerId = socketToPlayerId.get(socket.id);
    const existingPlayer =
      existingRoomCode === roomCode
        ? room.players.find((item) => item.id === existingPlayerId)
        : undefined;

    if (existingPlayer) {
      attachPlayerSocket(
        socket,
        roomCode,
        room,
        existingPlayer,
        "room_joined",
        playerName
      );
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      socket.emit("error_message", "Deze kamer zit vol");
      return;
    }

    const player = createPlayer(socket.id, playerName);

    room.players.push(player);

    console.log(`${playerName} joined kamer ${roomCode}`);

    if (room.started && room.turnState !== "finished") {
      room.lastMessage = `${playerName} kijkt mee en doet de volgende ronde mee.`;
    }

    attachPlayerSocket(socket, roomCode, room, player, "room_joined");
  });

  socket.on("list_public_rooms", () => {
    emitPublicRooms(socket);
  });

  socket.on("join_public_room", ({ code, name, playerId }: SessionPayload) => {
    const roomCode = code?.trim().toUpperCase();
    const playerName = sanitizePlayerName(name);

    if (!roomCode) {
      socket.emit("error_message", "Open tafel bestaat niet");
      return;
    }

    if (!validateRoomInvariant(roomCode)) {
      socket.emit("error_message", "Open tafel bestaat niet");
      emitPublicRooms(socket);
      return;
    }

    const room = rooms.get(roomCode);

    if (!room || room.visibility !== "public") {
      socket.emit("error_message", "Open tafel bestaat niet");
      emitPublicRooms(socket);
      return;
    }

    if (!isPublicWaitingRoom(room)) {
      socket.emit("error_message", "Deze open tafel is niet meer beschikbaar");
      emitPublicRooms(socket);
      return;
    }

    const reconnectingPlayer = playerId
      ? room.players.find((item) => item.id === playerId)
      : undefined;

    if (reconnectingPlayer) {
      attachPlayerSocket(
        socket,
        roomCode,
        room,
        reconnectingPlayer,
        "room_joined",
        playerName
      );
      emitPublicRooms(socket);
      return;
    }

    const player = createPlayer(socket.id, playerName);

    room.players.push(player);
    room.lastMessage = `${playerName} schoof aan via open tafels.`;

    attachPlayerSocket(socket, roomCode, room, player, "room_joined");
    emitPublicRooms(socket);
  });

  socket.on("quick_play", ({ name, playerId }: SessionPayload) => {
    if (recoverExistingPlayer(socket, { playerId, name })) {
      socket.emit("quick_play_result", { status: "recovered" });
      return;
    }

    const playerName = sanitizePlayerName(name);
    for (const roomCode of [...rooms.keys()]) {
      validateRoomInvariant(roomCode);
    }

    const availableRoom = [...rooms.values()].find(isPublicWaitingRoom);

    if (availableRoom) {
      const player = createPlayer(socket.id, playerName);

      availableRoom.players.push(player);
      availableRoom.lastMessage = `${playerName} vond deze open tafel.`;
      socket.emit("quick_play_result", {
        status: "found",
        code: availableRoom.code,
      });
      attachPlayerSocket(
        socket,
        availableRoom.code,
        availableRoom,
        player,
        "room_joined"
      );
      emitPublicRooms(socket);
      return;
    }

    const code = generateRoomCode([...rooms.keys()]);
    const player = createPlayer(socket.id, playerName);
    const room = createRoom(code, player, {
      visibility: "public",
      mode: "quick",
      maxPlayers: 4,
    });

    room.lastMessage = "Open snelspel-tafel gemaakt.";
    rooms.set(code, room);

    socket.emit("quick_play_result", {
      status: "created",
      code,
    });
    console.log(`${playerName} maakte snelspel kamer ${code}`);
    attachPlayerSocket(socket, code, room, player, "room_created");
    emitPublicRooms(socket);
  });

  socket.on("add_bot", ({ name }: { name?: string } = {}) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);

    if (!roomCode || !playerId) return;

    const room = rooms.get(roomCode);

    if (!room || room.started) return;

    if (!validateRoomInvariant(roomCode) || !rooms.has(roomCode)) return;

    if (room.hostId !== playerId) {
      socket.emit("error_message", "Alleen de host kan een bot toevoegen");
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      socket.emit("error_message", "Deze tafel zit vol");
      return;
    }

    const botNumber = room.players.filter((player) => player.isBot).length + 1;
    const bot = createPlayer("", sanitizePlayerName(name ?? `Bot ${botNumber}`), true);

    bot.id = `bot-${randomUUID()}`;
    room.players.push(bot);
    room.lastMessage = `${bot.name} is aangeschoven voor testspel.`;
    sendRoomUpdate(roomCode);
  });

  socket.on("update_name", ({ name }: { name: string }) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);

    if (!roomCode || !playerId) return;

    const room = rooms.get(roomCode);

    if (!room || room.started) return;

    const player = room.players.find((item) => item.id === playerId);

    if (!player) return;

    player.name = sanitizePlayerName(name);

    sendRoomUpdate(roomCode);
  });

  socket.on(
    "reconnect_room",
    ({ code, playerId, name }: SessionPayload) => {
      if (!code || !playerId) return;

      const roomCode = code.trim().toUpperCase();
      const room = rooms.get(roomCode);

      if (!room) {
        socket.emit("reconnect_failed");
        return;
      }

      const player = room.players.find((item) => item.id === playerId);

      if (!player) {
        socket.emit("reconnect_failed");
        return;
      }

      attachPlayerSocket(socket, roomCode, room, player, "reconnected", name);
      console.log(`${player.name} reconnect in kamer ${roomCode}`);
    }
  );

  socket.on("recover_session", (payload: SessionPayload) => {
    if (!recoverExistingPlayer(socket, payload)) {
      socket.emit("reconnect_failed");
    }
  });

  socket.on("toggle_ready", () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);

    if (!roomCode || !playerId) return;

    const room = rooms.get(roomCode);

    if (!room || room.started) return;

    const player = room.players.find((item) => item.id === playerId);

    if (!player) return;

    player.ready = !player.ready;

    sendRoomUpdate(roomCode);
  });

  socket.on("start_game", () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);

    if (!roomCode || !playerId) return;

    if (!validateRoomInvariant(roomCode)) return;

    const room = rooms.get(roomCode);

    if (!room) return;

    if (!hasConnectedHumanHost(room) || room.hostId !== playerId) {
      socket.emit("error_message", "Alleen de host kan starten");
      return;
    }

    const connectedPlayers = room.players.filter(
      (player) => player.isBot || isConnectedHuman(player)
    );

    if (connectedPlayers.length < 2) {
      socket.emit("error_message", "Je hebt minimaal 2 spelers nodig");
      return;
    }

    try {
      startGame(room);
      console.log(`Game gestart in kamer ${roomCode}`);
      sendRoomUpdate(roomCode);
    } catch (error) {
      socket.emit(
        "error_message",
        error instanceof Error ? error.message : "Starten mislukt"
      );
    }
  });

  socket.on(
    "play_card",
    ({ cardId, chosenSuit }: { cardId: string; chosenSuit?: Suit }) => {
      const roomCode = socketToRoom.get(socket.id);
      const playerId = socketToPlayerId.get(socket.id);

      if (!roomCode || !playerId) return;

      const room = rooms.get(roomCode);

      if (!room) return;

      const safeChosenSuit = isValidSuit(chosenSuit) ? chosenSuit : undefined;

      try {
        playCard(room, playerId, cardId, safeChosenSuit);
        sendRoomUpdate(roomCode);
      } catch (error) {
        socket.emit(
          "error_message",
          error instanceof Error ? error.message : "Ongeldige zet"
        );
      }
    }
  );

  socket.on("draw_cards", () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);

    if (!roomCode || !playerId) return;

    const room = rooms.get(roomCode);

    if (!room) return;

    try {
      drawCards(room, playerId);
      sendRoomUpdate(roomCode);
    } catch (error) {
      socket.emit(
        "error_message",
        error instanceof Error ? error.message : "Pakken mislukt"
      );
    }
  });

  socket.on("pass_turn", () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);

    if (!roomCode || !playerId) return;

    const room = rooms.get(roomCode);

    if (!room) return;

    try {
      passTurn(room, playerId);
      sendRoomUpdate(roomCode);
    } catch (error) {
      socket.emit(
        "error_message",
        error instanceof Error ? error.message : "Passen mislukt"
      );
    }
  });

  socket.on("redraw_drawn_card", () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);

    if (!roomCode || !playerId) return;

    const room = rooms.get(roomCode);

    if (!room) return;

    try {
      redrawDrawnCard(room, playerId);
      sendRoomUpdate(roomCode);
    } catch (error) {
      socket.emit(
        "error_message",
        error instanceof Error ? error.message : "Nieuwe pakkaart mislukt"
      );
    }
  });

  socket.on("reorder_hand", ({ cardIds }: { cardIds: string[] }) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);

    if (!roomCode || !playerId) return;

    const room = rooms.get(roomCode);

    if (!room) return;

    try {
      reorderHand(room, playerId, cardIds);
      sendRoomUpdate(roomCode);
    } catch (error) {
      socket.emit(
        "error_message",
        error instanceof Error ? error.message : "Sorteren mislukt"
      );
    }
  });

  socket.on("sort_hand", ({ mode }: { mode: "suit" | "value" }) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);

    if (!roomCode || !playerId) return;

    const room = rooms.get(roomCode);

    if (!room) return;

    try {
      sortHand(room, playerId, mode);
      sendRoomUpdate(roomCode);
    } catch (error) {
      socket.emit(
        "error_message",
        error instanceof Error ? error.message : "Sorteren mislukt"
      );
    }
  });

  socket.on("play_again_response", ({ wantsAgain }: { wantsAgain: boolean }) => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);

    if (!roomCode || !playerId) return;

    const room = rooms.get(roomCode);

    if (!room) return;

    if (room.turnState !== "finished") return;

    const player = room.players.find((item) => item.id === playerId);
    const playerName = player?.name ?? "Een speler";

    resetToLobby(room);
    room.lastMessage = wantsAgain
      ? `${playerName} wil nog een potje. De host kan opnieuw starten.`
      : `${playerName} ging terug naar de lobby.`;

    sendRoomUpdate(roomCode);
  });

  socket.on("leave_room", () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);

    if (!roomCode || !playerId) return;

    socketToRoom.delete(socket.id);
    socketToPlayerId.delete(socket.id);
    socket.leave(roomCode);

    removePlayerFromRoom(roomCode, playerId);
  });

  socket.on("disconnect", () => {
    const roomCode = socketToRoom.get(socket.id);
    const playerId = socketToPlayerId.get(socket.id);

    if (!roomCode || !playerId) {
      console.log("Speler weg:", socket.id);
      return;
    }

    const room = rooms.get(roomCode);

    if (!room) {
      socketToRoom.delete(socket.id);
      socketToPlayerId.delete(socket.id);
      return;
    }

    const player = room.players.find((item) => item.id === playerId);

    if (player && player.socketId !== socket.id) {
      socketToRoom.delete(socket.id);
      socketToPlayerId.delete(socket.id);
      return;
    }

    if (player) {
      player.connected = false;
      player.socketId = "";
      player.disconnectedAt = Date.now();
      room.lastMessage = `${player.name} is offline gegaan.`;
    }

    socketToRoom.delete(socket.id);
    socketToPlayerId.delete(socket.id);

    scheduleDisconnectGrace(roomCode, playerId);
    scheduleRoomCleanup(roomCode);

    console.log(
      `Speler tijdelijk weg: ${playerId} uit ${roomCode}, grace ${reconnectGraceMs}ms`
    );

    sendRoomUpdate(roomCode);
  });
});

const PORT = Number(process.env.PORT) || 3001;

export function resetServerStateForTests() {
  for (const timer of disconnectGraceTimers.values()) {
    clearTimeout(timer);
  }

  for (const timer of botTurnTimers.values()) {
    clearTimeout(timer);
  }

  disconnectGraceTimers.clear();
  botTurnTimers.clear();
  rooms.clear();
  socketToRoom.clear();
  socketToPlayerId.clear();
}

export function setReconnectGraceMsForTests(ms: number) {
  reconnectGraceMs = ms;
}

export function getRoomForTests(code: string) {
  return rooms.get(code);
}

export { app, io, server };

if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server draait op poort ${PORT}`);
  });
}
