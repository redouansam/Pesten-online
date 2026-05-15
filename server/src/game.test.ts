import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canPlayCard,
  createRoom,
  drawCards,
  getCurrentPlayer,
  playCard,
  redrawDrawnCard,
  sortHand,
} from "./game";
import { Card, GameRoom, Player, Suit } from "./types";

function makePlayer(id: string): Player {
  return {
    id,
    socketId: `socket-${id}`,
    name: `Player ${id}`,
    connected: true,
    ready: true,
  };
}

function makeCard(id: string, value: Card["value"], suit?: Suit): Card {
  return {
    id,
    value,
    suit,
  };
}

function makeRoom(playerCount = 3): GameRoom {
  const players = Array.from({ length: playerCount }, (_, index) =>
    makePlayer(String(index + 1))
  );
  const room = createRoom("TEST1", players[0]);

  room.players = players;
  room.started = true;
  room.deck = [];
  room.discardPile = [makeCard("top", "5", "hearts")];
  room.hands = Object.fromEntries(players.map((player) => [player.id, []]));
  room.currentPlayerIndex = 0;

  return room;
}

describe("game rules", () => {
  it("stacks draw penalties and clears the stack after drawing", () => {
    const room = makeRoom(3);

    room.discardPile = [makeCard("top-2", "2", "hearts")];
    room.hands["1"] = [
      makeCard("p1-2", "2", "clubs"),
      makeCard("p1-extra", "9", "clubs"),
    ];
    room.hands["2"] = [
      makeCard("p2-joker", "JOKER"),
      makeCard("p2-extra", "9", "diamonds"),
    ];
    room.deck = Array.from({ length: 7 }, (_, index) =>
      makeCard(`draw-${index}`, "9", "spades")
    );

    playCard(room, "1", "p1-2");

    assert.equal(room.pendingDraw, 2);
    assert.equal(getCurrentPlayer(room)?.id, "2");

    playCard(room, "2", "p2-joker");

    assert.equal(room.pendingDraw, 7);
    assert.equal(getCurrentPlayer(room)?.id, "3");

    drawCards(room, "3");

    assert.equal(room.pendingDraw, 0);
    assert.equal(room.hands["3"].length, 7);
    assert.equal(room.turnState, "after_draw");
  });

  it("penalizes illegal pest-card finishes without forwarding the draw stack", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top-2", "2", "hearts")];
    room.hands["1"] = [makeCard("final-2", "2", "clubs")];
    room.deck = [
      makeCard("penalty-1", "4", "hearts"),
      makeCard("penalty-2", "6", "spades"),
    ];

    playCard(room, "1", "final-2");

    assert.equal(room.winnerId, undefined);
    assert.equal(room.pendingDraw, 0);
    assert.equal(room.hands["1"].length, 2);
    assert.equal(getCurrentPlayer(room)?.id, "2");
    assert.match(room.lastMessage ?? "", /pestkaart/);
  });

  it("keeps a 7-chain on the same suit and allows same-value closure", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top-7", "7", "clubs")];
    room.hands["1"] = [
      makeCard("seven", "7", "hearts"),
      makeCard("heart-5", "5", "hearts"),
      makeCard("spade-5", "5", "spades"),
      makeCard("extra", "9", "clubs"),
    ];

    playCard(room, "1", "seven");

    assert.equal(room.turnState, "seven_chain");
    assert.equal(room.sevenSuit, "hearts");
    assert.equal(canPlayCard(room, room.hands["1"][0], "1"), true);
    assert.equal(canPlayCard(room, room.hands["1"][1], "1"), false);

    playCard(room, "1", "heart-5");

    assert.equal(room.turnState, "seven_chain");
    assert.equal(canPlayCard(room, room.hands["1"][0], "1"), true);

    playCard(room, "1", "spade-5");

    assert.equal(room.turnState, "normal");
    assert.equal(room.sevenSuit, undefined);
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("allows another 7 during an active 7-chain", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top-7", "7", "clubs")];
    room.hands["1"] = [
      makeCard("heart-7", "7", "hearts"),
      makeCard("spade-7", "7", "spades"),
      makeCard("spade-5", "5", "spades"),
    ];

    playCard(room, "1", "heart-7");

    assert.equal(room.turnState, "seven_chain");
    assert.equal(canPlayCard(room, room.hands["1"][0], "1"), true);

    playCard(room, "1", "spade-7");

    assert.equal(room.turnState, "seven_chain");
    assert.equal(room.sevenSuit, "spades");
    assert.equal(canPlayCard(room, room.hands["1"][0], "1"), true);
  });

  it("blocks an off-suit 7 after the 7-chain continues with a normal card", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top-7", "7", "clubs")];
    room.hands["1"] = [
      makeCard("heart-7", "7", "hearts"),
      makeCard("heart-4", "4", "hearts"),
      makeCard("club-7", "7", "clubs"),
      makeCard("club-4", "4", "clubs"),
    ];

    playCard(room, "1", "heart-7");
    playCard(room, "1", "heart-4");

    const clubSeven = room.hands["1"].find((card) => card.id === "club-7");
    const clubFour = room.hands["1"].find((card) => card.id === "club-4");

    assert.equal(room.turnState, "seven_chain");
    assert.equal(canPlayCard(room, clubSeven!, "1"), false);
    assert.equal(canPlayCard(room, clubFour!, "1"), true);

    playCard(room, "1", "club-4");

    assert.equal(room.turnState, "normal");
    assert.equal(room.sevenSuit, undefined);
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("offers a gem redraw when a normal draw is not playable", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [makeCard("hand", "9", "clubs")];
    room.deck = [
      makeCard("bad-draw", "10", "spades"),
      makeCard("good-draw", "5", "clubs"),
    ];

    drawCards(room, "1");

    assert.equal(room.turnState, "after_draw");
    assert.equal(room.redrawOffer?.cardId, "bad-draw");
    assert.equal(getCurrentPlayer(room)?.id, "1");

    redrawDrawnCard(room, "1");

    assert.equal(room.redrawOffer, undefined);
    assert.equal(room.hands["1"].some((card) => card.id === "bad-draw"), false);
    assert.equal(room.hands["1"].some((card) => card.id === "good-draw"), true);
    assert.equal(getCurrentPlayer(room)?.id, "1");
  });

  it("sorts hands by suit or value depending on the requested mode", () => {
    const room = makeRoom(2);

    room.hands["1"] = [
      makeCard("spade-k", "K", "spades"),
      makeCard("heart-3", "3", "hearts"),
      makeCard("club-a", "A", "clubs"),
      makeCard("diamond-3", "3", "diamonds"),
    ];

    sortHand(room, "1", "value");

    assert.deepEqual(
      room.hands["1"].map((card) => card.id),
      ["club-a", "heart-3", "diamond-3", "spade-k"]
    );

    sortHand(room, "1", "suit");

    assert.deepEqual(
      room.hands["1"].map((card) => card.id),
      ["heart-3", "diamond-3", "club-a", "spade-k"]
    );
  });
});
