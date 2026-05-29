import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import { io as createClient, Socket as ClientSocket } from "socket.io-client";
import {
  getRoomForTests,
  io,
  resetServerStateForTests,
  server,
  setReconnectGraceMsForTests,
} from "./index";
import type { Card, PublicRoomState, PublicRoomSummary, Suit } from "./types";

type SessionAck = {
  code: string;
  playerId: string;
};

let baseUrl = "";
let clients: ClientSocket[] = [];

function makeCard(id: string, value: Card["value"], suit?: Suit): Card {
  return {
    id,
    value,
    suit,
  };
}

function waitForEvent<T>(
  socket: ClientSocket,
  event: string,
  predicate: (payload: T) => boolean = () => true
) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${event}`));
    }, 4000);

    function cleanup() {
      clearTimeout(timeout);
      socket.off(event, handler);
    }

    function handler(payload: T) {
      if (!predicate(payload)) return;

      cleanup();
      resolve(payload);
    }

    socket.on(event, handler);
  });
}

function waitForRoom(
  socket: ClientSocket,
  predicate: (room: PublicRoomState) => boolean = () => true,
  timeoutMs = 4000
) {
  return new Promise<PublicRoomState>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for room state"));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      socket.off("room_updated", handler);
      socket.off("room_state", handler);
    }

    function handler(room: PublicRoomState) {
      if (!predicate(room)) return;

      cleanup();
      resolve(room);
    }

    socket.on("room_updated", handler);
    socket.on("room_state", handler);
  });
}

async function connectClient() {
  const socket = createClient(baseUrl, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    timeout: 2000,
  });

  clients.push(socket);

  await waitForEvent(socket, "connect");

  return socket;
}

async function createRoomWithHost(
  name = "Host",
  options: Record<string, unknown> = {}
) {
  const host = await connectClient();
  const created = waitForEvent<SessionAck>(host, "room_created");
  const state = waitForRoom(host, (room) => room.players.length === 1);

  host.emit("create_room", {
    name,
    ...options,
  });

  return {
    host,
    session: await created,
    room: await state,
  };
}

async function joinRoom(code: string, name = "Guest") {
  const guest = await connectClient();
  const joined = waitForEvent<SessionAck>(guest, "room_joined");
  const state = waitForRoom(
    guest,
    (room) => room.code === code && room.players.some((player) => player.name === name)
  );

  guest.emit("join_room", {
    code,
    name,
  });

  return {
    guest,
    session: await joined,
    room: await state,
  };
}

async function createTwoPlayerRoom() {
  const hostSession = await createRoomWithHost("Host");
  const guestSession = await joinRoom(hostSession.session.code, "Guest");

  await waitForRoom(
    hostSession.host,
    (room) => room.players.length === 2 && room.players.some((player) => player.id === guestSession.session.playerId)
  );

  return {
    code: hostSession.session.code,
    host: hostSession.host,
    guest: guestSession.guest,
    hostId: hostSession.session.playerId,
    guestId: guestSession.session.playerId,
  };
}

async function readyAndStartGame(host: ClientSocket, guest: ClientSocket) {
  const hostStarted = waitForRoom(host, (room) => room.started);
  const guestStarted = waitForRoom(guest, (room) => room.started);

  host.emit("start_game");

  return {
    hostState: await hostStarted,
    guestState: await guestStarted,
  };
}

async function disconnectAndObserve(
  socket: ClientSocket,
  observer: ClientSocket,
  playerId: string
) {
  const offline = waitForRoom(
    observer,
    (room) => room.players.find((player) => player.id === playerId)?.connected === false
  );

  socket.disconnect();

  return offline;
}

async function recoverClient(code: string, playerId: string, name = "Recovered") {
  const socket = await connectClient();
  const recovered = waitForEvent<SessionAck>(socket, "reconnected");
  const state = waitForRoom(
    socket,
    (room) => room.players.some((player) => player.id === playerId && player.connected)
  );

  socket.emit("recover_session", {
    code,
    playerId,
    name,
  });

  return {
    socket,
    session: await recovered,
    room: await state,
  };
}

async function listPublicRooms(socket: ClientSocket) {
  const rooms = waitForEvent<PublicRoomSummary[]>(socket, "public_rooms");

  socket.emit("list_public_rooms");

  return rooms;
}

before(async () => {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  for (const client of clients) {
    client.disconnect();
  }

  clients = [];
  resetServerStateForTests();
  setReconnectGraceMsForTests(5000);
});

after(async () => {
  for (const client of clients) {
    client.disconnect();
  }

  resetServerStateForTests();
  await new Promise<void>((resolve) => io.close(() => resolve()));

  if (server.listening) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe("socket reconnect recovery", () => {
  it("starts a room with two players without requiring ready", async () => {
    const { host, guest } = await createTwoPlayerRoom();
    const hostStarted = waitForRoom(host, (room) => room.started);
    const guestStarted = waitForRoom(guest, (room) => room.started);

    host.emit("start_game");

    assert.equal((await hostStarted).started, true);
    assert.equal((await guestStarted).started, true);
  });

  it("rejects starting with only one player", async () => {
    const { host } = await createRoomWithHost("Host");
    const error = waitForEvent<string>(
      host,
      "error_message",
      (message) => message === "Je hebt minimaal 2 spelers nodig"
    );

    host.emit("start_game");

    assert.equal(await error, "Je hebt minimaal 2 spelers nodig");
  });

  it("rejects stale session recovery for a missing room", async () => {
    const client = await connectClient();
    const failed = waitForEvent(client, "reconnect_failed");

    client.emit("recover_session", {
      code: "ZZZZZ",
      playerId: "missing-player",
      name: "Stale",
    });

    await failed;
  });

  it("quick play creates a public room and sends the next player into it", async () => {
    const first = await connectClient();
    const firstCreated = waitForEvent<SessionAck>(first, "room_created");
    const firstQuickResult = waitForEvent<{ status: string; code: string }>(
      first,
      "quick_play_result"
    );
    const firstState = waitForRoom(first, (room) => room.visibility === "public");

    first.emit("quick_play", {
      name: "Quick A",
    });

    const created = await firstCreated;
    const firstQuick = await firstQuickResult;
    const publicState = await firstState;

    assert.equal(firstQuick.status, "created");
    assert.equal(publicState.mode, "quick");

    const second = await connectClient();
    const secondJoined = waitForEvent<SessionAck>(second, "room_joined");
    const secondQuickResult = waitForEvent<{ status: string; code: string }>(
      second,
      "quick_play_result"
    );
    const joinedRoom = waitForRoom(
      second,
      (room) => room.code === created.code && room.players.length === 2
    );

    second.emit("quick_play", {
      name: "Quick B",
    });

    const joined = await secondJoined;

    assert.equal(joined.code, created.code);
    assert.equal((await secondQuickResult).status, "found");
    assert.equal((await joinedRoom).players.length, 2);
  });

  it("quick play skips full and in-game public rooms", async () => {
    const first = await connectClient();
    const firstCreated = waitForEvent<SessionAck>(first, "room_created");

    first.emit("quick_play", { name: "A" });
    const firstRoom = await firstCreated;

    for (const name of ["B", "C", "D"]) {
      const client = await connectClient();
      const joined = waitForEvent<SessionAck>(client, "room_joined");

      client.emit("quick_play", { name });
      assert.equal((await joined).code, firstRoom.code);
    }

    const fifth = await connectClient();
    const fifthCreated = waitForEvent<SessionAck>(fifth, "room_created");

    fifth.emit("quick_play", { name: "E" });
    const fifthRoom = await fifthCreated;

    assert.notEqual(fifthRoom.code, firstRoom.code);

    const room = getRoomForTests(fifthRoom.code);
    assert.ok(room);
    room.players.push({
      id: "manual-guest",
      socketId: "",
      name: "Manual",
      connected: true,
      ready: true,
    });
    room.started = true;
    room.turnState = "normal";

    const next = await connectClient();
    const nextCreated = waitForEvent<SessionAck>(next, "room_created");

    next.emit("quick_play", { name: "F" });
    assert.notEqual((await nextCreated).code, fifthRoom.code);
  });

  it("lists public waiting rooms but hides private tables", async () => {
    await createRoomWithHost("Private Host");
    const publicHost = await createRoomWithHost("Public Host", {
      visibility: "public",
      mode: "casual",
    });
    const viewer = await connectClient();
    const publicRooms = waitForEvent<PublicRoomSummary[]>(
      viewer,
      "public_rooms",
      (rooms) => rooms.some((room) => room.code === publicHost.session.code)
    );

    viewer.emit("list_public_rooms");

    const rooms = await publicRooms;

    assert.equal(rooms.some((room) => room.hostName === "Private Host"), false);
    assert.equal(rooms.some((room) => room.code === publicHost.session.code), true);
  });

  it("joins a selected public room", async () => {
    const publicHost = await createRoomWithHost("Public Host", {
      visibility: "public",
      mode: "casual",
    });
    const player = await connectClient();
    const joined = waitForEvent<SessionAck>(player, "room_joined");
    const state = waitForRoom(
      player,
      (room) => room.code === publicHost.session.code && room.players.length === 2
    );

    player.emit("join_public_room", {
      code: publicHost.session.code,
      name: "Open Player",
    });

    assert.equal((await joined).code, publicHost.session.code);
    assert.equal((await state).visibility, "public");
  });

  it("lets the host add a bot and start without ready", async () => {
    const { host } = await createRoomWithHost("Host");
    const botJoined = waitForRoom(
      host,
      (room) => room.players.some((player) => player.isBot)
    );

    host.emit("add_bot");

    const withBot = await botJoined;
    assert.equal(withBot.players.length, 2);

    const started = waitForRoom(host, (room) => room.started);

    host.emit("start_game");

    assert.equal((await started).started, true);
  });

  it("keeps a human host when a bot joins", async () => {
    const { host, session } = await createRoomWithHost("Host");
    const botJoined = waitForRoom(
      host,
      (room) => room.players.some((player) => player.isBot)
    );

    host.emit("add_bot");

    const state = await botJoined;
    const hostPlayer = state.players.find((player) => player.id === state.hostId);

    assert.equal(state.hostId, session.playerId);
    assert.notEqual(hostPlayer?.isBot, true);
  });

  it("migrates host to another human when the host leaves, never to a bot", async () => {
    const { code, host, guest, hostId, guestId } = await createTwoPlayerRoom();
    const botJoined = waitForRoom(
      guest,
      (room) => room.players.some((player) => player.isBot)
    );

    host.emit("add_bot");
    await botJoined;

    const migrated = waitForRoom(
      guest,
      (room) =>
        room.hostId === guestId &&
        !room.players.some((player) => player.id === hostId)
    );

    host.emit("leave_room");

    const state = await migrated;
    const hostPlayer = state.players.find((player) => player.id === state.hostId);

    assert.equal(state.code, code);
    assert.equal(hostPlayer?.id, guestId);
    assert.notEqual(hostPlayer?.isBot, true);
  });

  it("migrates host to a connected human when the host disconnects", async () => {
    const { host, guest, hostId, guestId } = await createTwoPlayerRoom();
    const botJoined = waitForRoom(
      guest,
      (room) => room.players.some((player) => player.isBot)
    );

    host.emit("add_bot");
    await botJoined;

    const migrated = waitForRoom(
      guest,
      (room) =>
        room.hostId === guestId &&
        room.players.find((player) => player.id === hostId)?.connected === false
    );

    host.disconnect();

    const state = await migrated;
    const hostPlayer = state.players.find((player) => player.id === state.hostId);

    assert.equal(hostPlayer?.id, guestId);
    assert.notEqual(hostPlayer?.isBot, true);
  });

  it("repairs a bot host before listing a valid public room", async () => {
    const publicHost = await createRoomWithHost("Public Host", {
      visibility: "public",
      mode: "casual",
    });
    const botJoined = waitForRoom(
      publicHost.host,
      (room) => room.players.some((player) => player.isBot)
    );

    publicHost.host.emit("add_bot");
    await botJoined;

    const room = getRoomForTests(publicHost.session.code);
    assert.ok(room);
    const bot = room.players.find((player) => player.isBot);
    assert.ok(bot);
    room.hostId = bot.id;

    const viewer = await connectClient();
    const rooms = await listPublicRooms(viewer);
    const listedRoom = rooms.find((item) => item.code === publicHost.session.code);

    assert.ok(listedRoom);
    assert.equal(listedRoom.hostName, "Public Host");
    assert.equal(getRoomForTests(publicHost.session.code)?.hostId, publicHost.session.playerId);
  });

  it("cleans bot-only public rooms and never lists them", async () => {
    const publicHost = await createRoomWithHost("Public Host", {
      visibility: "public",
      mode: "quick",
    });
    const room = getRoomForTests(publicHost.session.code);
    assert.ok(room);

    room.players = [
      {
        id: "bot-only",
        socketId: "",
        name: "Bot Only",
        connected: true,
        ready: true,
        isBot: true,
      },
    ];
    room.hostId = "bot-only";

    const viewer = await connectClient();
    const rooms = await listPublicRooms(viewer);

    assert.equal(rooms.some((item) => item.code === publicHost.session.code), false);
    assert.equal(getRoomForTests(publicHost.session.code), undefined);
  });

  it("quick play skips invalid bot-only rooms and creates a human-hosted room", async () => {
    const publicHost = await createRoomWithHost("Public Host", {
      visibility: "public",
      mode: "quick",
    });
    const oldCode = publicHost.session.code;
    const room = getRoomForTests(oldCode);
    assert.ok(room);

    room.players = [
      {
        id: "bot-only",
        socketId: "",
        name: "Bot Only",
        connected: true,
        ready: true,
        isBot: true,
      },
    ];
    room.hostId = "bot-only";

    const player = await connectClient();
    const created = waitForEvent<SessionAck>(player, "room_created");
    const state = waitForRoom(player, (roomState) => roomState.visibility === "public");

    player.emit("quick_play", {
      name: "Quick Human",
    });

    const session = await created;
    const roomState = await state;
    const hostPlayer = roomState.players.find(
      (roomPlayer) => roomPlayer.id === roomState.hostId
    );

    assert.notEqual(session.code, oldCode);
    assert.equal(getRoomForTests(oldCode), undefined);
    assert.equal(hostPlayer?.name, "Quick Human");
    assert.notEqual(hostPlayer?.isBot, true);
  });

  it("hides orphaned, full and in-game public rooms from public listings", async () => {
    const orphan = await createRoomWithHost("Orphan Host", {
      visibility: "public",
      mode: "casual",
    });
    const full = await createRoomWithHost("Full Host", {
      visibility: "public",
      mode: "casual",
    });
    const inGame = await createTwoPlayerRoom();
    const inGameRoom = getRoomForTests(inGame.code);
    assert.ok(inGameRoom);
    inGameRoom.visibility = "public";
    inGameRoom.mode = "casual";
    inGameRoom.started = true;
    inGameRoom.turnState = "normal";

    const fullRoom = getRoomForTests(full.session.code);
    assert.ok(fullRoom);
    fullRoom.players.push(
      {
        id: "full-2",
        socketId: "manual-2",
        name: "Full 2",
        connected: true,
        ready: true,
      },
      {
        id: "full-3",
        socketId: "manual-3",
        name: "Full 3",
        connected: true,
        ready: true,
      },
      {
        id: "full-4",
        socketId: "manual-4",
        name: "Full 4",
        connected: true,
        ready: true,
      }
    );

    const orphanRoom = getRoomForTests(orphan.session.code);
    assert.ok(orphanRoom);
    orphanRoom.players[0].connected = false;
    orphanRoom.players[0].socketId = "";

    const viewer = await connectClient();
    const rooms = await listPublicRooms(viewer);

    assert.equal(rooms.some((item) => item.code === orphan.session.code), false);
    assert.equal(rooms.some((item) => item.code === full.session.code), false);
    assert.equal(rooms.some((item) => item.code === inGame.code), false);
  });

  it("returns an active game to lobby when a leaving player makes it unplayable", async () => {
    const { host, guest, guestId } = await createTwoPlayerRoom();
    await readyAndStartGame(host, guest);

    const returnedToLobby = waitForRoom(
      host,
      (room) =>
        !room.started &&
        room.players.length === 1 &&
        !room.players.some((player) => player.id === guestId)
    );

    guest.emit("leave_room");

    const state = await returnedToLobby;

    assert.equal(state.turnState, "normal");
    assert.equal(
      state.lastMessage,
      "Tafel teruggezet omdat er niet genoeg spelers over zijn."
    );
  });

  it("restores finished state when a player reconnects after game end", async () => {
    const { code, host, guest, hostId, guestId } = await createTwoPlayerRoom();
    await readyAndStartGame(host, guest);

    const room = getRoomForTests(code);
    assert.ok(room);
    room.currentPlayerIndex = room.players.findIndex((player) => player.id === hostId);
    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands[hostId] = [makeCard("winner-card", "5", "clubs")];
    room.hands[guestId] = [makeCard("guest-card", "9", "spades")];

    const finished = waitForRoom(
      guest,
      (state) => state.turnState === "finished" && state.winnerId === hostId
    );

    host.emit("play_card", {
      cardId: "winner-card",
    });

    await finished;
    await disconnectAndObserve(guest, host, guestId);

    const recovered = await recoverClient(code, guestId, "Guest");

    assert.equal(recovered.room.turnState, "finished");
    assert.equal(recovered.room.winnerId, hostId);
    assert.equal(recovered.room.started, true);
  });

  it("blocks further card plays after a legal winner is declared", async () => {
    const { code, host, guest, hostId, guestId } = await createTwoPlayerRoom();
    await readyAndStartGame(host, guest);

    const room = getRoomForTests(code);
    assert.ok(room);
    room.currentPlayerIndex = room.players.findIndex((player) => player.id === hostId);
    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands[hostId] = [makeCard("winner-card", "5", "clubs")];
    room.hands[guestId] = [makeCard("guest-card", "5", "spades")];

    const finished = waitForRoom(
      guest,
      (state) => state.turnState === "finished" && state.winnerId === hostId
    );

    host.emit("play_card", {
      cardId: "winner-card",
    });

    await finished;

    const error = waitForEvent<string>(
      guest,
      "error_message",
      (message) => message === "Game is al klaar"
    );

    guest.emit("play_card", {
      cardId: "guest-card",
    });

    assert.equal(await error, "Game is al klaar");
  });

  it("resets a finished game to lobby when a player asks for another round", async () => {
    const { code, host, guest, hostId, guestId } = await createTwoPlayerRoom();
    await readyAndStartGame(host, guest);

    const room = getRoomForTests(code);
    assert.ok(room);
    room.currentPlayerIndex = room.players.findIndex((player) => player.id === hostId);
    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands[hostId] = [makeCard("winner-card", "5", "clubs")];
    room.hands[guestId] = [makeCard("guest-card", "9", "spades")];

    const finished = waitForRoom(
      guest,
      (state) => state.turnState === "finished" && state.winnerId === hostId
    );

    host.emit("play_card", {
      cardId: "winner-card",
    });

    await finished;

    const lobby = waitForRoom(
      guest,
      (state) =>
        !state.started &&
        state.turnState === "normal" &&
        state.winnerId === undefined &&
        state.hand.length === 0
    );

    host.emit("play_again_response", {
      wantsAgain: true,
    });

    const state = await lobby;

    assert.equal(state.lastMessage, "Host wil nog een potje. De host kan opnieuw starten.");

    const restarted = waitForRoom(guest, (roomState) => roomState.started);

    host.emit("start_game");

    assert.equal((await restarted).turnState, "normal");
  });

  it("runs the basic room flow and sends both players state", async () => {
    const { host, guest } = await createTwoPlayerRoom();

    const { hostState, guestState } = await readyAndStartGame(host, guest);

    assert.equal(hostState.started, true);
    assert.equal(guestState.started, true);
    assert.equal(hostState.players.length, 2);
    assert.equal(guestState.players.length, 2);
    assert.equal(hostState.hand.length, 7);
    assert.equal(guestState.hand.length, 7);
  });

  it("recovers a disconnected player before the game starts without duplicating them", async () => {
    const { code, host, guest, guestId } = await createTwoPlayerRoom();

    await disconnectAndObserve(guest, host, guestId);

    const recovered = await recoverClient(code, guestId, "Guest");

    assert.equal(recovered.session.playerId, guestId);
    assert.equal(recovered.room.players.length, 2);
    assert.equal(
      recovered.room.players.filter((player) => player.id === guestId).length,
      1
    );
    assert.equal(
      recovered.room.players.find((player) => player.id === guestId)?.connected,
      true
    );
  });

  it("recovers during an active game with the same hand and turn state", async () => {
    const { code, host, guest, hostId, guestId } = await createTwoPlayerRoom();
    const { hostState } = await readyAndStartGame(host, guest);
    const originalHand = hostState.hand.map((card) => card.id);
    const originalTurn = hostState.currentPlayerId;

    await disconnectAndObserve(host, guest, hostId);

    const recovered = await recoverClient(code, hostId, "Host");

    assert.deepEqual(
      recovered.room.hand.map((card) => card.id),
      originalHand
    );
    assert.equal(recovered.room.currentPlayerId, originalTurn);
    assert.equal(recovered.room.players.length, 2);
  });

  it("lets the current player play after reconnecting", async () => {
    const { code, host, guest, hostId, guestId } = await createTwoPlayerRoom();
    await readyAndStartGame(host, guest);

    const room = getRoomForTests(code);
    assert.ok(room);
    room.currentPlayerIndex = room.players.findIndex((player) => player.id === hostId);
    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands[hostId] = [
      makeCard("host-heart", "9", "hearts"),
      makeCard("host-extra", "3", "clubs"),
    ];
    room.hands[guestId] = [makeCard("guest-spade", "9", "spades")];
    room.turnState = "normal";

    await disconnectAndObserve(host, guest, hostId);
    const recovered = await recoverClient(code, hostId, "Host");

    const played = waitForRoom(
      guest,
      (state) => state.topCard?.id === "host-heart"
    );

    recovered.socket.emit("play_card", {
      cardId: "host-heart",
    });

    const updated = await played;

    assert.equal(updated.topCard?.id, "host-heart");
    assert.equal(updated.currentPlayerId, guestId);
  });

  it("preserves chosen suit after a Jack through another player's reconnect", async () => {
    const { code, host, guest, hostId, guestId } = await createTwoPlayerRoom();
    await readyAndStartGame(host, guest);

    const room = getRoomForTests(code);
    assert.ok(room);
    room.currentPlayerIndex = room.players.findIndex((player) => player.id === hostId);
    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands[hostId] = [
      makeCard("jack-hearts", "J", "hearts"),
      makeCard("host-extra", "3", "spades"),
    ];
    room.hands[guestId] = [makeCard("guest-spade", "9", "spades")];
    room.turnState = "normal";

    const jackPlayed = waitForRoom(
      guest,
      (state) => state.chosenSuit === "spades"
    );
    host.emit("play_card", {
      cardId: "jack-hearts",
      chosenSuit: "spades",
    });
    await jackPlayed;

    await disconnectAndObserve(guest, host, guestId);
    const recovered = await recoverClient(code, guestId, "Guest");

    assert.equal(recovered.room.chosenSuit, "spades");
    assert.equal(recovered.room.topCard?.id, "jack-hearts");
  });

  it("preserves a pending 2/Joker penalty through reconnect", async () => {
    const { code, host, guest, hostId, guestId } = await createTwoPlayerRoom();
    await readyAndStartGame(host, guest);

    const room = getRoomForTests(code);
    assert.ok(room);
    room.currentPlayerIndex = room.players.findIndex((player) => player.id === hostId);
    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands[hostId] = [
      makeCard("draw-two", "2", "hearts"),
      makeCard("host-extra", "3", "clubs"),
    ];
    room.hands[guestId] = [makeCard("guest-nine", "9", "clubs")];
    room.turnState = "normal";

    const penalty = waitForRoom(
      guest,
      (state) => state.pendingDraw === 2 && state.currentPlayerId === guestId
    );
    host.emit("play_card", {
      cardId: "draw-two",
    });
    await penalty;

    await disconnectAndObserve(guest, host, guestId);
    const recovered = await recoverClient(code, guestId, "Guest");

    assert.equal(recovered.room.pendingDraw, 2);
    assert.equal(recovered.room.currentPlayerId, guestId);
    assert.equal(recovered.room.canDraw, true);
  });

  it("preserves an active 7-chain through reconnect", async () => {
    const { code, host, guest, hostId, guestId } = await createTwoPlayerRoom();
    await readyAndStartGame(host, guest);

    const room = getRoomForTests(code);
    assert.ok(room);
    room.currentPlayerIndex = room.players.findIndex((player) => player.id === hostId);
    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands[hostId] = [
      makeCard("seven-hearts", "7", "hearts"),
      makeCard("nine-hearts", "9", "hearts"),
    ];
    room.hands[guestId] = [makeCard("guest-nine", "9", "clubs")];
    room.turnState = "normal";

    const chain = waitForRoom(
      host,
      (state) => state.turnState === "seven_chain" && state.sevenSuit === "hearts"
    );
    host.emit("play_card", {
      cardId: "seven-hearts",
    });
    await chain;

    await disconnectAndObserve(host, guest, hostId);
    const recovered = await recoverClient(code, hostId, "Host");

    assert.equal(recovered.room.turnState, "seven_chain");
    assert.equal(recovered.room.sevenSuit, "hearts");
    assert.equal(recovered.room.currentPlayerId, hostId);
  });

  it("keeps one player entry when the same player reconnects twice", async () => {
    const { code, host, guest, guestId } = await createTwoPlayerRoom();

    await disconnectAndObserve(guest, host, guestId);

    const first = await recoverClient(code, guestId, "Guest");
    const second = await recoverClient(code, guestId, "Guest");

    const firstNameAttempt = waitForRoom(
      host,
      (room) => room.players.find((player) => player.id === guestId)?.name === "Old Guest",
      250
    );

    first.socket.emit("update_name", {
      name: "Old Guest",
    });

    await assert.rejects(firstNameAttempt, /Timed out/);

    const secondName = waitForRoom(
      host,
      (room) => room.players.find((player) => player.id === guestId)?.name === "Guest Back"
    );

    second.socket.emit("update_name", {
      name: "Guest Back",
    });
    const state = await secondName;

    assert.equal(state.players.filter((player) => player.id === guestId).length, 1);
  });

  it("removes an offline player after the reconnect grace timeout", async () => {
    setReconnectGraceMsForTests(60);
    const { host, guest, guestId } = await createTwoPlayerRoom();

    await disconnectAndObserve(guest, host, guestId);

    const removed = await waitForRoom(
      host,
      (room) => !room.players.some((player) => player.id === guestId)
    );

    assert.equal(removed.players.length, 1);
  });
});
