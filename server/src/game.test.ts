import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canRedrawLastDrawnCard,
  canPlayCard,
  createRoom,
  drawCards,
  getCurrentPlayer,
  getPublicRoomState,
  getRedrawCost,
  passTurn,
  playBotTurn,
  playCard,
  redrawDrawnCard,
  resetToLobby,
  sortHand,
  startGame,
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

function makeBot(id: string): Player {
  return {
    ...makePlayer(id),
    socketId: "",
    name: `Bot ${id}`,
    isBot: true,
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
  room.roundPlayerIds = players.map((player) => player.id);
  room.finishedPlayerIds = [];
  room.currentPlayerIndex = 0;

  return room;
}

function getAllCards(room: GameRoom) {
  return [
    ...room.deck,
    ...room.discardPile,
    ...Object.values(room.hands).flat(),
  ];
}

function countCard(room: GameRoom, cardId: string) {
  return getAllCards(room).filter((card) => card.id === cardId).length;
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

  it("only allows 2 or Joker to stack a draw penalty", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top-2", "2", "hearts")];
    room.pendingDraw = 2;
    room.hands["1"] = [
      makeCard("same-suit", "9", "hearts"),
      makeCard("same-value", "2", "clubs"),
      makeCard("joker", "JOKER"),
    ];

    assert.equal(canPlayCard(room, room.hands["1"][0], "1"), false);
    assert.equal(canPlayCard(room, room.hands["1"][1], "1"), true);
    assert.equal(canPlayCard(room, room.hands["1"][2], "1"), true);
  });

  it("allows drawing even when the player has a playable card", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [
      makeCard("playable", "5", "clubs"),
      makeCard("other", "9", "spades"),
    ];
    room.deck = [makeCard("drawn", "10", "diamonds")];

    const publicRoom = getPublicRoomState(room, "1");

    assert.equal(publicRoom.canDraw, true);

    drawCards(room, "1");

    assert.equal(room.hands["1"].some((card) => card.id === "drawn"), true);
    assert.equal(room.turnState, "after_draw");
  });

  it("reshuffles the discard pile into the deck when drawing from an empty deck", () => {
    const room = makeRoom(2);

    room.discardPile = [
      makeCard("recycled", "9", "spades"),
      makeCard("top", "5", "hearts"),
    ];
    room.hands["1"] = [makeCard("hand", "10", "clubs")];
    room.deck = [];

    drawCards(room, "1");

    assert.equal(room.hands["1"].some((card) => card.id === "recycled"), true);
    assert.deepEqual(room.discardPile.map((card) => card.id), ["top"]);
  });

  it("keeps a Joker/Joker/2 stack when the final 2 is an illegal finish", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [
      makeCard("p1-joker", "JOKER"),
      makeCard("p1-final-2", "2", "clubs"),
    ];
    room.hands["2"] = [
      makeCard("p2-joker", "JOKER"),
      makeCard("p2-extra", "9", "diamonds"),
    ];
    room.deck = [
      makeCard("penalty-1", "4", "hearts"),
      makeCard("penalty-2", "6", "spades"),
    ];

    playCard(room, "1", "p1-joker");
    playCard(room, "2", "p2-joker");
    playCard(room, "1", "p1-final-2");

    assert.equal(room.winnerId, undefined);
    assert.equal(room.pendingDraw, 12);
    assert.equal(room.hands["1"].length, 2);
    assert.deepEqual(
      room.hands["1"].map((card) => card.id),
      ["penalty-1", "penalty-2"]
    );
    assert.equal(getCurrentPlayer(room)?.id, "2");

    const publicRoom = getPublicRoomState(room, "2");

    assert.equal(publicRoom.pendingDraw, 12);
    assert.equal(publicRoom.canDraw, true);
  });

  it("adds a final 2 onto an existing pending draw instead of overwriting it", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top-2", "2", "hearts")];
    room.pendingDraw = 10;
    room.hands["1"] = [makeCard("final-2", "2", "clubs")];
    room.deck = [
      makeCard("penalty-1", "4", "hearts"),
      makeCard("penalty-2", "6", "spades"),
    ];

    playCard(room, "1", "final-2");

    assert.equal(room.winnerId, undefined);
    assert.equal(room.pendingDraw, 12);
    assert.equal(room.hands["1"].length, 2);
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("adds a final Joker onto an existing pending draw instead of overwriting it", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top-2", "2", "hearts")];
    room.pendingDraw = 4;
    room.hands["1"] = [makeCard("final-joker", "JOKER")];
    room.deck = [
      makeCard("penalty-1", "4", "hearts"),
      makeCard("penalty-2", "6", "spades"),
    ];

    playCard(room, "1", "final-joker");

    assert.equal(room.winnerId, undefined);
    assert.equal(room.pendingDraw, 9);
    assert.equal(room.hands["1"].length, 2);
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("penalizes non-draw pest-card finishes while keeping their normal effects", () => {
    const pestFinalCards: Array<{
      label: string;
      card: Card;
      chosenSuit?: Suit;
      playerCount?: number;
      deck?: Card[];
      assertEffect: (room: GameRoom) => void;
    }> = [
      {
        label: "Ace",
        card: makeCard("final-a", "A", "hearts"),
        assertEffect: (room) => {
          assert.equal(room.direction, -1);
          assert.equal(getCurrentPlayer(room)?.id, "1");
        },
      },
      {
        label: "Eight",
        card: makeCard("final-8", "8", "hearts"),
        playerCount: 3,
        assertEffect: (room) => {
          assert.equal(getCurrentPlayer(room)?.id, "3");
        },
      },
      {
        label: "Jack",
        card: makeCard("final-j", "J", "hearts"),
        chosenSuit: "spades",
        assertEffect: (room) => {
          assert.equal(room.chosenSuit, "spades");
          assert.equal(getCurrentPlayer(room)?.id, "2");
        },
      },
      {
        label: "King",
        card: makeCard("final-k", "K", "hearts"),
        deck: [
          makeCard("king-penalty-1", "K", "spades"),
          makeCard("king-penalty-2", "6", "clubs"),
        ],
        assertEffect: (room) => {
          assert.equal(room.turnState, "must_play");
          assert.equal(getCurrentPlayer(room)?.id, "1");
        },
      },
      {
        label: "Seven",
        card: makeCard("final-7", "7", "hearts"),
        deck: [
          makeCard("seven-penalty-1", "9", "hearts"),
          makeCard("seven-penalty-2", "6", "clubs"),
        ],
        assertEffect: (room) => {
          assert.equal(room.turnState, "seven_chain");
          assert.equal(room.sevenSuit, "hearts");
          assert.equal(getCurrentPlayer(room)?.id, "1");
        },
      },
    ];

    for (const { label, card, chosenSuit, playerCount, deck, assertEffect } of pestFinalCards) {
      const room = makeRoom(playerCount ?? 2);

      room.discardPile = [makeCard("top", "5", "hearts")];
      room.hands["1"] = [card];
      room.deck =
        deck ?? [
          makeCard(`${card.id}-penalty-1`, "4", "clubs"),
          makeCard(`${card.id}-penalty-2`, "6", "spades"),
        ];

      playCard(room, "1", card.id, chosenSuit);

      assert.equal(room.winnerId, undefined, `${label} should not win`);
      assert.equal(room.hands["1"].length, 2, `${label} penalty`);
      assertEffect(room);
    }
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

  it("runs the full 7 same-suit chain and closes on same value", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "Q", "hearts")];
    room.hands["1"] = [
      makeCard("heart-7", "7", "hearts"),
      makeCard("heart-4", "4", "hearts"),
      makeCard("heart-6", "6", "hearts"),
      makeCard("spade-6", "6", "spades"),
      makeCard("extra", "9", "clubs"),
    ];

    playCard(room, "1", "heart-7");
    playCard(room, "1", "heart-4");
    playCard(room, "1", "heart-6");

    const spadeSix = room.hands["1"].find((card) => card.id === "spade-6");

    assert.equal(canPlayCard(room, spadeSix!, "1"), true);

    playCard(room, "1", "spade-6");

    assert.equal(room.turnState, "normal");
    assert.equal(room.sevenSuit, undefined);
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("ends a 7-chain cleanly after one valid follow-up card", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "Q", "hearts")];
    room.hands["1"] = [
      makeCard("heart-7", "7", "hearts"),
      makeCard("heart-6", "6", "hearts"),
      makeCard("spade-9", "9", "spades"),
    ];
    room.deck = [makeCard("penalty", "10", "clubs")];

    playCard(room, "1", "heart-7");
    playCard(room, "1", "heart-6");

    assert.equal(room.turnState, "normal");
    assert.equal(room.sevenSuit, undefined);
    assert.equal(room.hands["1"].some((card) => card.id === "penalty"), false);
    assert.equal(getCurrentPlayer(room)?.id, "2");
    assert.match(room.lastMessage ?? "", /sluit de 7-reeks af/);
  });

  it("penalizes a bare 7 when the player cannot add a required card", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "Q", "hearts")];
    room.hands["1"] = [
      makeCard("heart-7", "7", "hearts"),
      makeCard("spade-9", "9", "spades"),
    ];
    room.deck = [makeCard("penalty", "10", "clubs")];

    playCard(room, "1", "heart-7");

    assert.equal(room.turnState, "normal");
    assert.equal(room.sevenSuit, undefined);
    assert.equal(room.hands["1"].some((card) => card.id === "penalty"), true);
    assert.equal(getCurrentPlayer(room)?.id, "2");
    assert.match(room.lastMessage ?? "", /geen kaart erbij leggen/);
  });

  it("lets a 7-chain switch suits and close on a draw card when cards remain", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "Q", "spades")];
    room.hands["1"] = [
      makeCard("spade-7", "7", "spades"),
      makeCard("diamond-7", "7", "diamonds"),
      makeCard("diamond-6", "6", "diamonds"),
      makeCard("diamond-2", "2", "diamonds"),
      makeCard("extra", "9", "clubs"),
    ];

    playCard(room, "1", "spade-7");
    playCard(room, "1", "diamond-7");
    playCard(room, "1", "diamond-6");
    playCard(room, "1", "diamond-2");

    assert.equal(room.turnState, "normal");
    assert.equal(room.sevenSuit, undefined);
    assert.equal(room.pendingDraw, 2);
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

  it("allows a jack on top of another jack", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top-jack", "J", "hearts")];
    room.chosenSuit = "diamonds";
    room.hands["1"] = [
      makeCard("club-jack", "J", "clubs"),
      makeCard("club-9", "9", "clubs"),
    ];

    assert.equal(canPlayCard(room, room.hands["1"][0], "1"), true);

    playCard(room, "1", "club-jack", "spades");

    assert.equal(room.chosenSuit, "spades");
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("treats an ace like a skip when only two players are active", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [
      makeCard("ace", "A", "hearts"),
      makeCard("extra", "9", "clubs"),
    ];

    playCard(room, "1", "ace");

    assert.equal(room.direction, -1);
    assert.equal(getCurrentPlayer(room)?.id, "1");
  });

  it("reverses direction after an ace with three active players", () => {
    const room = makeRoom(3);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [
      makeCard("ace", "A", "hearts"),
      makeCard("extra", "9", "clubs"),
    ];

    playCard(room, "1", "ace");

    assert.equal(room.direction, -1);
    assert.equal(getCurrentPlayer(room)?.id, "3");
  });

  it("treats an ace like a skip when only two players remain from a larger round", () => {
    const room = makeRoom(3);

    room.finishedPlayerIds = ["2"];
    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [
      makeCard("ace", "A", "hearts"),
      makeCard("extra", "9", "clubs"),
    ];
    room.hands["3"] = [makeCard("p3-card", "9", "diamonds")];

    playCard(room, "1", "ace");

    assert.equal(room.direction, -1);
    assert.equal(getCurrentPlayer(room)?.id, "1");
  });

  it("skips the next player after an eight", () => {
    const room = makeRoom(3);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [
      makeCard("eight", "8", "hearts"),
      makeCard("extra", "9", "clubs"),
    ];

    playCard(room, "1", "eight");

    assert.equal(getCurrentPlayer(room)?.id, "3");
  });

  it("respects the chosen suit after a jack", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top-jack", "J", "hearts")];
    room.chosenSuit = "spades";
    room.hands["1"] = [
      makeCard("heart-9", "9", "hearts"),
      makeCard("spade-4", "4", "spades"),
      makeCard("club-jack", "J", "clubs"),
    ];

    assert.equal(canPlayCard(room, room.hands["1"][0], "1"), false);
    assert.equal(canPlayCard(room, room.hands["1"][1], "1"), true);
    assert.equal(canPlayCard(room, room.hands["1"][2], "1"), true);

    playCard(room, "1", "spade-4");

    assert.equal(room.chosenSuit, undefined);
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("rejects invalid plays without changing turn state", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [
      makeCard("bad-card", "9", "clubs"),
      makeCard("good-card", "5", "spades"),
    ];

    assert.throws(() => playCard(room, "1", "bad-card"), /mag je nu niet/);
    assert.deepEqual(
      room.hands["1"].map((card) => card.id),
      ["bad-card", "good-card"]
    );
    assert.equal(getCurrentPlayer(room)?.id, "1");
    assert.equal(room.turnState, "normal");
  });

  it("forces a draw before passing when a king in a 7-chain has no follow-up", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "Q", "hearts")];
    room.hands["1"] = [
      makeCard("heart-7", "7", "hearts"),
      makeCard("heart-k", "K", "hearts"),
      makeCard("club-9", "9", "clubs"),
    ];
    room.deck = [makeCard("draw-card", "4", "spades")];

    playCard(room, "1", "heart-7");
    playCard(room, "1", "heart-k");

    const publicRoom = getPublicRoomState(room, "1");

    assert.equal(room.turnState, "seven_chain");
    assert.equal(room.sevenStopAfterNext, true);
    assert.equal(publicRoom.canDraw, true);
    assert.equal(publicRoom.canPass, false);
    assert.throws(() => passTurn(room, "1"), /nadat je een kaart hebt getrokken/);

    drawCards(room, "1");

    const afterDrawRoom = getPublicRoomState(room, "1");

    assert.equal(room.turnState, "after_draw");
    assert.equal(afterDrawRoom.canPass, true);
    passTurn(room, "1");

    assert.equal(room.turnState, "normal");
    assert.equal(room.sevenSuit, undefined);
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("allows a normal follow-up card after a king in a 7-chain", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "Q", "hearts")];
    room.hands["1"] = [
      makeCard("heart-7", "7", "hearts"),
      makeCard("heart-k", "K", "hearts"),
      makeCard("joker", "JOKER"),
      makeCard("club-9", "9", "clubs"),
    ];

    playCard(room, "1", "heart-7");
    playCard(room, "1", "heart-k");

    const joker = room.hands["1"].find((card) => card.id === "joker");
    const publicRoom = getPublicRoomState(room, "1");

    assert.equal(canPlayCard(room, joker!, "1"), true);
    assert.equal(publicRoom.canDraw, false);
    assert.equal(publicRoom.canPass, false);

    playCard(room, "1", "joker");

    assert.equal(room.turnState, "normal");
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("forces a draw before passing when a normal king has no follow-up", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [
      makeCard("heart-k", "K", "hearts"),
      makeCard("club-9", "9", "clubs"),
    ];
    room.deck = [makeCard("draw-card", "4", "spades")];

    playCard(room, "1", "heart-k");

    const publicRoom = getPublicRoomState(room, "1");

    assert.equal(room.turnState, "must_play");
    assert.equal(publicRoom.canDraw, true);
    assert.equal(publicRoom.canPass, false);
    assert.throws(() => passTurn(room, "1"), /nadat je een kaart hebt getrokken/);

    drawCards(room, "1");

    const afterDrawRoom = getPublicRoomState(room, "1");

    assert.equal(room.turnState, "after_draw");
    assert.equal(afterDrawRoom.canPass, true);
    passTurn(room, "1");

    assert.equal(room.turnState, "normal");
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("ends a normal king turn after exactly one follow-up king", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [
      makeCard("heart-k", "K", "hearts"),
      makeCard("spade-k", "K", "spades"),
      makeCard("extra", "9", "clubs"),
    ];

    playCard(room, "1", "heart-k");

    assert.equal(room.turnState, "must_play");
    assert.equal(getCurrentPlayer(room)?.id, "1");

    playCard(room, "1", "spade-k");

    assert.equal(room.turnState, "normal");
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("lets a bot stack a pending 2/Joker penalty", () => {
    const room = makeRoom(2);

    room.players[1] = makeBot("2");
    room.discardPile = [makeCard("top-2", "2", "hearts")];
    room.pendingDraw = 2;
    room.currentPlayerIndex = 1;
    room.hands["2"] = [
      makeCard("bot-joker", "JOKER"),
      makeCard("bot-extra", "9", "clubs"),
    ];

    assert.equal(playBotTurn(room, "2"), true);
    assert.equal(room.pendingDraw, 7);
    assert.equal(room.discardPile[room.discardPile.length - 1].id, "bot-joker");
    assert.equal(getCurrentPlayer(room)?.id, "1");
  });

  it("makes a bot choose a useful suit after a Jack", () => {
    const room = makeRoom(2);

    room.players[0] = makeBot("1");
    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [
      makeCard("bot-jack", "J", "hearts"),
      makeCard("bot-spade-1", "9", "spades"),
      makeCard("bot-spade-2", "4", "spades"),
    ];

    playBotTurn(room, "1");

    assert.equal(room.chosenSuit, "spades");
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("makes a bot avoid ending with a pest card when it has an alternative", () => {
    const room = makeRoom(2);

    room.players[0] = makeBot("1");
    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [
      makeCard("bot-ace", "A", "hearts"),
      makeCard("bot-five", "5", "clubs"),
    ];

    playBotTurn(room, "1");

    assert.equal(room.discardPile[room.discardPile.length - 1].id, "bot-five");
    assert.deepEqual(
      room.hands["1"].map((card) => card.id),
      ["bot-ace"]
    );
    assert.equal(room.winnerId, undefined);
  });

  it("makes a bot handle a king extra-card turn", () => {
    const room = makeRoom(2);

    room.players[0] = makeBot("1");
    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [
      makeCard("bot-king", "K", "hearts"),
      makeCard("bot-king-extra", "K", "spades"),
      makeCard("bot-extra", "9", "clubs"),
    ];

    playBotTurn(room, "1");

    assert.equal(room.turnState, "normal");
    assert.equal(room.discardPile[room.discardPile.length - 1].id, "bot-king-extra");
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("makes a bot continue a 7-chain when possible", () => {
    const room = makeRoom(2);

    room.players[0] = makeBot("1");
    room.discardPile = [makeCard("top", "Q", "hearts")];
    room.hands["1"] = [
      makeCard("bot-seven", "7", "hearts"),
      makeCard("bot-heart", "9", "hearts"),
      makeCard("bot-extra", "5", "clubs"),
    ];

    playBotTurn(room, "1");

    assert.equal(room.turnState, "normal");
    assert.equal(room.sevenSuit, undefined);
    assert.equal(room.discardPile[room.discardPile.length - 1].id, "bot-heart");
    assert.equal(getCurrentPlayer(room)?.id, "2");
  });

  it("finishes immediately when a player legally plays their last card", () => {
    const room = makeRoom(3);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [makeCard("p1-out", "5", "clubs")];
    room.hands["2"] = [makeCard("p2-out", "5", "diamonds")];
    room.hands["3"] = [makeCard("p3-left", "9", "spades")];

    playCard(room, "1", "p1-out");

    assert.equal(room.winnerId, "1");
    assert.equal(room.turnState, "finished");
    assert.deepEqual(room.finishedPlayerIds, ["1"]);
    assert.equal(room.pendingDraw, 0);
    assert.equal(room.chosenSuit, undefined);
    assert.equal(room.redrawOffer, undefined);

    assert.throws(
      () => playCard(room, "2", "p2-out"),
      /Spel is al klaar/
    );
  });

  it("keeps bot turns stopped after the room is finished", () => {
    const room = makeRoom(2);

    room.players[0] = makeBot("1");
    room.turnState = "finished";
    assert.equal(room.turnState, "finished");
    room.hands["1"] = [makeCard("bot-play", "5", "clubs")];

    assert.equal(playBotTurn(room, "1"), false);
    assert.equal(room.discardPile[room.discardPile.length - 1].id, "top");
  });

  it("keeps late joiners waiting until the next round and skips them in turn order", () => {
    const room = makeRoom(2);
    const latePlayer = makePlayer("3");

    room.players.push(latePlayer);
    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [makeCard("p1-play", "5", "clubs"), makeCard("p1-extra", "9", "spades")];
    room.hands["2"] = [makeCard("p2-play", "5", "diamonds")];

    playCard(room, "1", "p1-play");

    const latePublicRoom = getPublicRoomState(room, "3");
    const latePublicPlayer = latePublicRoom.players.find((player) => player.id === "3");

    assert.equal(getCurrentPlayer(room)?.id, "2");
    assert.equal(latePublicPlayer?.waitingForNextRound, true);
    assert.equal(latePublicPlayer?.inRound, false);
    assert.equal(latePublicRoom.canDraw, false);
  });

  it("resets finished rounds back to a clean lobby", () => {
    const room = makeRoom(2);

    room.turnState = "finished";
    room.winnerId = "1";
    room.loserId = "2";
    room.pendingDraw = 7;
    room.chosenSuit = "spades";
    room.sevenSuit = "hearts";
    room.sevenStopAfterNext = true;
    room.redrawOffer = {
      playerId: "1",
      cardId: "drawn",
      offerId: "old-offer",
    };
    room.redrawCounts = {
      "1": 2,
    };
    room.rematchVotes = {
      "1": true,
      "2": true,
    };
    room.players[0].ready = true;
    room.players[1].ready = true;

    resetToLobby(room);

    assert.equal(room.started, false);
    assert.equal(room.turnState, "normal");
    assert.equal(room.pendingDraw, 0);
    assert.equal(room.chosenSuit, undefined);
    assert.equal(room.sevenSuit, undefined);
    assert.equal(room.sevenStopAfterNext, false);
    assert.equal(room.redrawOffer, undefined);
    assert.deepEqual(room.redrawCounts, {});
    assert.equal(room.winnerId, undefined);
    assert.equal(room.loserId, undefined);
    assert.deepEqual(room.rematchVotes, {});
    assert.deepEqual(room.roundPlayerIds, []);
    assert.deepEqual(room.finishedPlayerIds, []);
    assert.equal(room.players.every((player) => !player.ready), true);
  });

  it("starts a rematch with clean votes and fresh hands", () => {
    const room = makeRoom(2);

    room.turnState = "finished";
    room.winnerId = "1";
    room.loserId = "2";
    room.rematchVotes = {
      "1": true,
      "2": true,
    };

    startGame(room);

    assert.equal(room.started, true);
    assert.equal(room.turnState, "normal");
    assert.equal(room.winnerId, undefined);
    assert.equal(room.loserId, undefined);
    assert.deepEqual(room.rematchVotes, {});
    assert.equal(room.players.every((player) => !player.ready), true);
    assert.equal(room.hands["1"].length, 7);
    assert.equal(room.hands["2"].length, 7);
    assert.equal(room.roundPlayerIds.length, 2);
    assert.equal(room.discardPile.length, 1);
  });

  it("offers a gem redraw after a normal draw and replaces only that card", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [makeCard("hand", "9", "clubs")];
    room.deck = [
      makeCard("bad-draw", "10", "spades"),
      makeCard("good-draw", "5", "clubs"),
    ];

    drawCards(room, "1");

    const offerId = room.redrawOffer?.offerId;
    const totalCardCount = getAllCards(room).length;

    assert.equal(room.turnState, "after_draw");
    assert.equal(room.redrawOffer?.cardId, "bad-draw");
    assert.equal(room.redrawOffer?.playerId, "1");
    assert.equal(typeof offerId, "string");
    assert.equal(getRedrawCost(room, "1"), 3);
    assert.equal(canRedrawLastDrawnCard(room, "1", { offerId }), true);
    assert.equal(getCurrentPlayer(room)?.id, "1");

    const result = redrawDrawnCard(room, "1", {
      offerId,
      availableGems: 25,
    });

    assert.equal(result.costGems, 3);
    assert.equal(room.redrawOffer?.cardId, "good-draw");
    assert.equal(getRedrawCost(room, "1"), 5);
    assert.equal(getAllCards(room).length, totalCardCount);
    assert.equal(room.hands["1"].some((card) => card.id === "bad-draw"), false);
    assert.equal(room.hands["1"].some((card) => card.id === "good-draw"), true);
    assert.equal(countCard(room, "bad-draw"), 1);
    assert.equal(countCard(room, "good-draw"), 1);
    assert.equal(getCurrentPlayer(room)?.id, "1");
  });

  it("increases redraw cost per player within the same match", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [makeCard("hand", "9", "clubs")];
    room.deck = [
      makeCard("draw-1", "10", "spades"),
      makeCard("draw-2", "9", "spades"),
      makeCard("draw-3", "4", "clubs"),
      makeCard("draw-4", "3", "diamonds"),
    ];

    drawCards(room, "1");

    assert.equal(getRedrawCost(room, "1"), 3);

    const first = redrawDrawnCard(room, "1", {
      offerId: room.redrawOffer?.offerId,
      availableGems: 25,
    });

    assert.equal(first.costGems, 3);
    assert.equal(getRedrawCost(room, "1"), 5);

    const second = redrawDrawnCard(room, "1", {
      offerId: room.redrawOffer?.offerId,
      availableGems: 25,
    });

    assert.equal(second.costGems, 5);
    assert.equal(getRedrawCost(room, "1"), 7);

    const third = redrawDrawnCard(room, "1", {
      offerId: room.redrawOffer?.offerId,
      availableGems: 25,
    });

    assert.equal(third.costGems, 7);
    assert.equal(getRedrawCost(room, "1"), 9);
  });

  it("resets redraw cost when a new match starts", () => {
    const room = makeRoom(2);

    room.redrawCounts["1"] = 3;

    assert.equal(getRedrawCost(room, "1"), 9);

    startGame(room);

    assert.equal(getRedrawCost(room, "1"), 3);
    assert.deepEqual(room.redrawCounts, {});
  });

  it("rejects redraw when no normal draw just happened", () => {
    const room = makeRoom(2);

    assert.equal(canRedrawLastDrawnCard(room, "1"), false);
    assert.throws(
      () => redrawDrawnCard(room, "1"),
      /Alleen direct na trekken|niet mogelijk/i
    );
  });

  it("rejects redraw after playing the drawn card", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [makeCard("keeper", "9", "clubs")];
    room.deck = [makeCard("drawn", "5", "clubs")];

    drawCards(room, "1");
    const offerId = room.redrawOffer?.offerId;

    playCard(room, "1", "drawn");

    assert.equal(room.redrawOffer, undefined);
    assert.throws(
      () => redrawDrawnCard(room, "1", { offerId }),
      /Alleen direct na trekken|niet aan de beurt/i
    );
  });

  it("rejects redraw after passing the turn", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [makeCard("keeper", "9", "clubs")];
    room.deck = [makeCard("drawn", "10", "spades")];

    drawCards(room, "1");
    const offerId = room.redrawOffer?.offerId;

    passTurn(room, "1");

    assert.equal(room.redrawOffer, undefined);
    assert.throws(
      () => redrawDrawnCard(room, "1", { offerId }),
      /niet aan de beurt|Alleen direct na trekken/i
    );
  });

  it("does not offer redraw during pending draw penalties", () => {
    const room = makeRoom(2);

    room.pendingDraw = 2;
    room.discardPile = [makeCard("top", "2", "hearts")];
    room.hands["1"] = [makeCard("keeper", "9", "clubs")];
    room.deck = [
      makeCard("penalty-1", "10", "spades"),
      makeCard("penalty-2", "9", "spades"),
    ];

    drawCards(room, "1");

    assert.equal(room.redrawOffer, undefined);
    assert.equal(getPublicRoomState(room, "1").canRedrawDrawnCard, false);
  });

  it("rejects redraw if it is not the player's turn", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [makeCard("keeper", "9", "clubs")];
    room.deck = [makeCard("drawn", "10", "spades")];

    drawCards(room, "1");

    assert.throws(() => redrawDrawnCard(room, "2"), /niet aan de beurt/i);
  });

  it("rejects redraw after the game is finished", () => {
    const room = makeRoom(2);

    room.turnState = "finished";
    room.winnerId = "1";
    room.redrawOffer = {
      playerId: "1",
      cardId: "drawn",
      offerId: "finished-offer",
    };

    assert.throws(
      () => redrawDrawnCard(room, "1", { offerId: "finished-offer" }),
      /al klaar/i
    );
  });

  it("rejects redraw when the player has too few gems", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [makeCard("keeper", "9", "clubs")];
    room.deck = [makeCard("drawn", "10", "spades")];

    drawCards(room, "1");

    assert.throws(
      () =>
        redrawDrawnCard(room, "1", {
          offerId: room.redrawOffer?.offerId,
          availableGems: 2,
        }),
      /Niet genoeg gems/
    );
    assert.equal(room.redrawCounts["1"] ?? 0, 0);
    assert.equal(room.hands["1"].some((card) => card.id === "drawn"), true);
  });

  it("rejects duplicate redraw requests with a stale offer id", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [makeCard("keeper", "9", "clubs")];
    room.deck = [
      makeCard("drawn", "10", "spades"),
      makeCard("replacement", "9", "spades"),
      makeCard("next", "4", "clubs"),
    ];

    drawCards(room, "1");
    const staleOfferId = room.redrawOffer?.offerId;

    redrawDrawnCard(room, "1", {
      offerId: staleOfferId,
      availableGems: 25,
    });

    assert.equal(room.redrawCounts["1"], 1);
    assert.throws(
      () =>
        redrawDrawnCard(room, "1", {
          offerId: staleOfferId,
          availableGems: 25,
        }),
      /Alleen direct na trekken/i
    );
    assert.equal(room.redrawCounts["1"], 1);
    assert.equal(room.hands["1"].length, 2);
  });

  it("does not allow stale reconnect redraw state after the offer changes", () => {
    const room = makeRoom(2);

    room.discardPile = [makeCard("top", "5", "hearts")];
    room.hands["1"] = [makeCard("keeper", "9", "clubs")];
    room.deck = [
      makeCard("drawn", "10", "spades"),
      makeCard("replacement", "9", "spades"),
      makeCard("next", "4", "clubs"),
    ];

    drawCards(room, "1");
    const reconnectState = getPublicRoomState(room, "1");

    redrawDrawnCard(room, "1", {
      offerId: reconnectState.redrawOfferId,
      availableGems: 25,
    });

    assert.throws(
      () =>
        redrawDrawnCard(room, "1", {
          offerId: reconnectState.redrawOfferId,
          availableGems: 25,
        }),
      /Alleen direct na trekken/i
    );
    assert.equal(getPublicRoomState(room, "1").canRedrawDrawnCard, true);
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
