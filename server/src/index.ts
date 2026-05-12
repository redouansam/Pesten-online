import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { randomUUID } from "crypto";
import {
  clampCurrentPlayerIndex,
  createRoom,
  drawCards,
  generateRoomCode,
  getCurrentPlayer,
  getPublicRoomState,
  moveToNextPlayer,
  passTurn,
  playCard,
  reorderHand,
  resetToLobby,
  sortHand,
  startGame,
} from "./game";
import { GameRoom, Player, Suit } from "./types";

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

const validSuits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

function isValidSuit(value: unknown): value is Suit {
  return typeof value === "string" && validSuits.includes(value as Suit);
}

app.get("/", (_req, res) => {
  res.send("Pesten multiplayer server draait");
});

function sendRoomUpdate(roomCode: string) {
  const room = rooms.get(roomCode);

  if (!room) return;

  for (const player of room.players) {
    if (!player.socketId) continue;

    io.to(player.socketId).emit("room_updated", getPublicRoomState(room, player.id));
  }
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

function assignNewHostIfNeeded(room: GameRoom) {
  const host = room.players.find((player) => player.id === room.hostId);

  if (host?.connected) return;

  const nextHost = room.players.find((player) => player.connected);

  if (nextHost) {
    room.hostId = nextHost.id;
  }
}

function skipDisconnectedCurrentPlayer(room: GameRoom) {
  if (!room.started || room.winnerId) return;

  let attempts = 0;

  while (
    getCurrentPlayer(room) &&
    !getCurrentPlayer(room).connected &&
    attempts < room.players.length
  ) {
    moveToNextPlayer(room);
    attempts++;
  }
}

function scheduleRoomCleanup(roomCode: string) {
  setTimeout(() => {
    const room = rooms.get(roomCode);

    if (!room) return;

    const hasConnectedPlayers = room.players.some((player) => player.connected);

    if (!hasConnectedPlayers) {
      rooms.delete(roomCode);
      console.log(`Kamer ${roomCode} verwijderd omdat iedereen offline is`);
    }
  }, 10 * 60 * 1000);
}

function removePlayerFromRoom(roomCode: string, playerId: string) {
  const room = rooms.get(roomCode);

  if (!room) return;

  const leavingPlayer = room.players.find((player) => player.id === playerId);

  room.players = room.players.filter((player) => player.id !== playerId);
  delete room.hands[playerId];
  delete room.rematchVotes[playerId];

  if (room.players.length === 0) {
    rooms.delete(roomCode);
    return;
  }

  clampCurrentPlayerIndex(room);
  assignNewHostIfNeeded(room);
  skipDisconnectedCurrentPlayer(room);

  room.lastMessage = `${leavingPlayer?.name ?? "Een speler"} heeft de kamer verlaten.`;

  sendRoomUpdate(roomCode);
}

function createPlayer(socketId: string, name: string): Player {
  return {
    id: randomUUID(),
    socketId,
    name,
    connected: true,
    ready: false,
  };
}

io.on("connection", (socket) => {
  console.log("Speler verbonden:", socket.id);

  socket.on("create_room", ({ name }: { name: string }) => {
    const playerName = name?.trim() || "Speler";
    const code = generateRoomCode([...rooms.keys()]);
    const player = createPlayer(socket.id, playerName);

    const room = createRoom(code, player);

    rooms.set(code, room);
    socketToRoom.set(socket.id, code);
    socketToPlayerId.set(socket.id, player.id);
    socket.join(code);

    console.log(`${playerName} maakte kamer ${code}`);

    socket.emit("room_created", {
      code,
      playerId: player.id,
    });

    sendRoomUpdate(code);
  });

  socket.on("join_room", ({ code, name }: { code: string; name: string }) => {
    const roomCode = code?.trim().toUpperCase();
    const playerName = name?.trim() || "Speler";

    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit("error_message", "Kamer bestaat niet");
      return;
    }

    if (room.started) {
      socket.emit("error_message", "Deze game is al gestart");
      return;
    }

    if (room.players.length >= 4) {
      socket.emit("error_message", "Deze kamer zit vol");
      return;
    }

    const player = createPlayer(socket.id, playerName);

    room.players.push(player);

    socketToRoom.set(socket.id, roomCode);
    socketToPlayerId.set(socket.id, player.id);
    socket.join(roomCode);

    console.log(`${playerName} joined kamer ${roomCode}`);

    socket.emit("room_joined", {
      code: roomCode,
      playerId: player.id,
    });

    sendRoomUpdate(roomCode);
  });

  socket.on(
    "reconnect_room",
    ({ code, playerId }: { code?: string; playerId?: string }) => {
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

      player.socketId = socket.id;
      player.connected = true;

      socketToRoom.set(socket.id, roomCode);
      socketToPlayerId.set(socket.id, player.id);
      socket.join(roomCode);

      room.lastMessage = `${player.name} is terug verbonden.`;

      socket.emit("reconnected", {
        code: roomCode,
        playerId: player.id,
      });

      assignNewHostIfNeeded(room);
      sendRoomUpdate(roomCode);
    }
  );

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

    const room = rooms.get(roomCode);

    if (!room) return;

    if (room.hostId !== playerId) {
      socket.emit("error_message", "Alleen de host kan starten");
      return;
    }

    const connectedPlayers = room.players.filter((player) => player.connected);
    const allReady = connectedPlayers.every((player) => player.ready);

    if (connectedPlayers.length < 2) {
      socket.emit("error_message", "Je hebt minimaal 2 spelers nodig");
      return;
    }

    if (!allReady) {
      socket.emit("error_message", "Iedereen moet eerst klaar zijn");
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

    if (!room.winnerId) return;

    room.rematchVotes[playerId] = wantsAgain;

    if (!wantsAgain) {
      resetToLobby(room);
      sendRoomUpdate(roomCode);
      return;
    }

    const activePlayers = room.players.filter((player) => player.connected);
    const allAnsweredYes =
      activePlayers.length >= 2 &&
      activePlayers.every((player) => room.rematchVotes[player.id] === true);

    if (allAnsweredYes) {
      startGame(room);
      sendRoomUpdate(roomCode);
      return;
    }

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

    if (player) {
      player.connected = false;
      player.ready = false;
      player.socketId = "";
      room.lastMessage = `${player.name} is offline gegaan.`;
    }

    socketToRoom.delete(socket.id);
    socketToPlayerId.delete(socket.id);

    assignNewHostIfNeeded(room);
    skipDisconnectedCurrentPlayer(room);
    scheduleRoomCleanup(roomCode);

    console.log("Speler weg:", socket.id);

    sendRoomUpdate(roomCode);
  });
});

const PORT = Number(process.env.PORT) || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server draait op poort ${PORT}`);
});