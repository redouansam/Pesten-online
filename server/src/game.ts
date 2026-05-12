import { Card, GameRoom, Player, Suit } from "./types";

const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

const values: Card["value"][] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

const pestCards: Card["value"][] = ["A", "2", "7", "8", "J", "K", "JOKER"];

export function generateRoomCode(existingCodes: string[]) {
  let code = "";

  do {
    code = Math.random().toString(36).substring(2, 7).toUpperCase();
  } while (existingCodes.includes(code));

  return code;
}

export function createRoom(code: string, host: Player): GameRoom {
  return {
    code,
    hostId: host.id,
    players: [host],
    started: false,

    deck: [],
    discardPile: [],
    hands: {},

    currentPlayerIndex: 0,
    direction: 1,

    pendingDraw: 0,
    turnState: "normal",

    rematchVotes: {},
  };
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  let idCounter = 1;

  for (const suit of suits) {
    for (const value of values) {
      deck.push({
        id: `card-${idCounter}`,
        suit,
        value,
      });

      idCounter++;
    }
  }

  deck.push({
    id: `card-${idCounter}`,
    value: "JOKER",
  });

  idCounter++;

  deck.push({
    id: `card-${idCounter}`,
    value: "JOKER",
  });

  return shuffle(deck);
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    const current = copy[index];
    const random = copy[randomIndex];

    copy[index] = random;
    copy[randomIndex] = current;
  }

  return copy;
}

function isNormalStartCard(card: Card) {
  return ["3", "4", "5", "6", "9", "10", "Q"].includes(card.value);
}

function isPestCard(card: Card) {
  return pestCards.includes(card.value);
}

export function startGame(room: GameRoom) {
  room.players = room.players.filter((player) => player.connected);

  room.deck = createDeck();
  room.discardPile = [];
  room.hands = {};

  room.currentPlayerIndex = 0;
  room.direction = 1;

  room.pendingDraw = 0;
  room.chosenSuit = undefined;

  room.turnState = "normal";
  room.sevenSuit = undefined;
  room.sevenStopAfterNext = false;

  room.winnerId = undefined;
  room.lastMessage = "Kaarten worden gedeeld...";
  room.rematchVotes = {};

  room.started = true;

  for (const player of room.players) {
    player.ready = false;
    room.hands[player.id] = room.deck.splice(0, 7);
  }

  let firstCard = room.deck.shift();

  while (firstCard && !isNormalStartCard(firstCard)) {
    room.deck.push(firstCard);
    firstCard = room.deck.shift();
  }

  if (!firstCard) {
    throw new Error("Geen startkaart gevonden");
  }

  room.discardPile.push(firstCard);
}

export function resetToLobby(room: GameRoom) {
  room.started = false;
  room.deck = [];
  room.discardPile = [];
  room.hands = {};
  room.currentPlayerIndex = 0;
  room.direction = 1;
  room.pendingDraw = 0;
  room.chosenSuit = undefined;
  room.turnState = "normal";
  room.sevenSuit = undefined;
  room.sevenStopAfterNext = false;
  room.winnerId = undefined;
  room.lastMessage = undefined;
  room.rematchVotes = {};

  for (const player of room.players) {
    player.ready = false;
  }
}

export function getTopCard(room: GameRoom) {
  return room.discardPile[room.discardPile.length - 1];
}

export function getCurrentPlayer(room: GameRoom) {
  return room.players[room.currentPlayerIndex];
}

function getPlayerName(room: GameRoom, playerId: string) {
  return room.players.find((player) => player.id === playerId)?.name ?? "Speler";
}

function getActiveSuit(room: GameRoom) {
  const topCard = getTopCard(room);

  return room.chosenSuit ?? topCard?.suit;
}

function hasOtherCardOfSuit(
  room: GameRoom,
  playerId: string,
  suit?: Suit,
  exceptCardId?: string
) {
  if (!suit) return false;

  const hand = room.hands[playerId] ?? [];

  return hand.some((card) => card.id !== exceptCardId && card.suit === suit);
}

function hasCardOfSuit(room: GameRoom, playerId: string, suit?: Suit) {
  return hasOtherCardOfSuit(room, playerId, suit);
}

function hasCardOfValue(
  room: GameRoom,
  playerId: string,
  value?: Card["value"]
) {
  if (!value) return false;

  const hand = room.hands[playerId] ?? [];

  return hand.some((card) => card.value === value);
}

function isSevenSameValueFinish(
  room: GameRoom,
  playerId: string,
  card: Card
) {
  if (room.turnState !== "seven_chain") return false;
  if (!room.sevenSuit) return false;
  if (card.suit === room.sevenSuit) return false;
  if (card.value === "7") return false;

  const topCard = getTopCard(room);

  if (!topCard) return false;

  const stillHasSevenSuit = hasOtherCardOfSuit(
    room,
    playerId,
    room.sevenSuit,
    card.id
  );

  return !stillHasSevenSuit && card.value === topCard.value;
}

export function canPlayCard(room: GameRoom, card: Card, playerId?: string) {
  const topCard = getTopCard(room);
  const activePlayerId = playerId ?? getCurrentPlayer(room)?.id;

  if (!topCard) return true;

  if (room.turnState === "seven_chain") {
    if (card.suit === room.sevenSuit) return true;

    if (!activePlayerId) return false;
    if (!room.sevenSuit) return false;
    if (card.value === "7") return false;

    const stillHasSevenSuit = hasOtherCardOfSuit(
      room,
      activePlayerId,
      room.sevenSuit,
      card.id
    );

    return !stillHasSevenSuit && card.value === topCard.value;
  }

  if (room.pendingDraw > 0) {
    return card.value === "2" || card.value === "JOKER";
  }

  if (topCard.value === "JOKER") {
    return true;
  }

  if (card.value === "JOKER") return true;

  const activeSuit = getActiveSuit(room);

  if (card.value === "J") {
    return Boolean(card.suit && activeSuit && card.suit === activeSuit);
  }

  return card.value === topCard.value || card.suit === activeSuit;
}

function hasPlayableCard(room: GameRoom, playerId: string) {
  const hand = room.hands[playerId] ?? [];

  return hand.some((card) => canPlayCard(room, card, playerId));
}

export function playCard(
  room: GameRoom,
  playerId: string,
  cardId: string,
  chosenSuit?: Suit
) {
  if (!room.started) {
    throw new Error("Game is nog niet gestart");
  }

  if (room.winnerId) {
    throw new Error("Game is al klaar");
  }

  const currentPlayer = getCurrentPlayer(room);

  if (!currentPlayer || currentPlayer.id !== playerId) {
    throw new Error("Je bent niet aan de beurt");
  }

  const hand = room.hands[playerId];

  if (!hand) {
    throw new Error("Hand niet gevonden");
  }

  const cardIndex = hand.findIndex((card) => card.id === cardId);

  if (cardIndex === -1) {
    throw new Error("Je hebt deze kaart niet");
  }

  const card = hand[cardIndex];

  if (!canPlayCard(room, card, playerId)) {
    throw new Error("Deze kaart mag je nu niet leggen");
  }

  if (card.value === "J" && !chosenSuit) {
    throw new Error("Kies een symbool bij de boer");
  }

  const wasSevenChain = room.turnState === "seven_chain";
  const wasSevenStopAfterNext = Boolean(room.sevenStopAfterNext);
  const wasSevenSameValueFinish = isSevenSameValueFinish(room, playerId, card);

  hand.splice(cardIndex, 1);
  room.discardPile.push(card);
  room.lastMessage = undefined;

  const effect = applyCardEffect(room, card, chosenSuit);

  if (hand.length === 0) {
    if (isPestCard(card) && !wasSevenChain) {
      drawAmountToPlayer(room, playerId, 2);

      room.lastMessage = `${getPlayerName(
        room,
        playerId
      )} probeerde te eindigen met een pestkaart en pakt 2 strafkaarten.`;

      room.turnState = "normal";
      room.sevenSuit = undefined;
      room.sevenStopAfterNext = false;
      moveSteps(room, effect.steps);
      return;
    }

    room.winnerId = playerId;
    room.turnState = "finished";
    return;
  }

  if (wasSevenSameValueFinish) {
    room.turnState = "normal";
    room.sevenSuit = undefined;
    room.sevenStopAfterNext = false;

    room.lastMessage = `${getPlayerName(
      room,
      playerId
    )} sluit de 7-reeks af met dezelfde waarde.`;

    moveSteps(room, effect.steps);
    return;
  }

  if (wasSevenChain) {
    resolveSevenChainAfterCard(
      room,
      playerId,
      card,
      effect.steps,
      wasSevenStopAfterNext
    );
    return;
  }

  if (card.value === "7") {
    resolveSevenStart(room, playerId, card);
    return;
  }

  if (card.value === "K") {
    resolveMustPlayAfterKing(room, playerId);
    return;
  }

  room.turnState = "normal";
  moveSteps(room, effect.steps);
}

function applyCardEffect(
  room: GameRoom,
  card: Card,
  chosenSuit?: Suit
): { steps: number } {
  let steps = 1;

  room.chosenSuit = undefined;

  if (card.value === "2") {
    room.pendingDraw += 2;
  }

  if (card.value === "JOKER") {
    room.pendingDraw += 5;
  }

  if (card.value === "J") {
    room.chosenSuit = chosenSuit;
  }

  if (card.value === "A") {
    room.direction = room.direction === 1 ? -1 : 1;
  }

  if (card.value === "8") {
    steps = 2;
  }

  if (card.value === "7" && card.suit) {
    room.sevenSuit = card.suit;
    room.turnState = "seven_chain";
    room.sevenStopAfterNext = false;
  }

  if (card.value === "K") {
    room.turnState = "must_play";
  }

  return {
    steps,
  };
}

function resolveSevenStart(room: GameRoom, playerId: string, card: Card) {
  if (!card.suit) {
    moveToNextPlayer(room);
    return;
  }

  if (!hasCardOfSuit(room, playerId, card.suit)) {
    drawAmountToPlayer(room, playerId, 1);

    room.lastMessage = `${getPlayerName(
      room,
      playerId
    )} legde een 7 maar kon geen kaart erbij leggen en pakt 1 strafkaart.`;

    room.turnState = "normal";
    room.sevenSuit = undefined;
    room.sevenStopAfterNext = false;
    moveToNextPlayer(room);
    return;
  }

  room.turnState = "seven_chain";
  room.sevenSuit = card.suit;
  room.sevenStopAfterNext = false;
  room.lastMessage = `${getPlayerName(
    room,
    playerId
  )} moet nu kaarten van hetzelfde symbool leggen.`;
}

function resolveSevenChainAfterCard(
  room: GameRoom,
  playerId: string,
  card: Card,
  steps: number,
  wasSevenStopAfterNext: boolean
) {
  const suit = room.sevenSuit;

  if (wasSevenStopAfterNext) {
    room.turnState = "normal";
    room.sevenSuit = undefined;
    room.sevenStopAfterNext = false;
    moveSteps(room, steps);
    return;
  }

  if (card.value === "K") {
    if (!hasPlayableCard(room, playerId)) {
      drawAmountToPlayer(room, playerId, 1);

      room.lastMessage = `${getPlayerName(
        room,
        playerId
      )} eindigde de 7-reeks met een Heer maar kon niet nog een kaart leggen en pakt 1 strafkaart.`;

      room.turnState = "normal";
      room.sevenSuit = undefined;
      room.sevenStopAfterNext = false;
      moveToNextPlayer(room);
      return;
    }

    room.turnState = "seven_chain";
    room.sevenStopAfterNext = true;
    room.lastMessage = "Heer in 7-reeks: leg nog precies één kaart.";
    return;
  }

  if (isPestCard(card)) {
    room.turnState = "normal";
    room.sevenSuit = undefined;
    room.sevenStopAfterNext = false;
    moveSteps(room, steps);
    return;
  }

  const topCard = getTopCard(room);
  const canContinueWithSuit = hasCardOfSuit(room, playerId, suit);
  const canFinishWithSameValue = hasCardOfValue(room, playerId, topCard?.value);

  if (canContinueWithSuit || canFinishWithSameValue) {
    room.turnState = "seven_chain";
    room.sevenStopAfterNext = false;

    if (!canContinueWithSuit && canFinishWithSameValue) {
      room.lastMessage = `${getPlayerName(
        room,
        playerId
      )} mag nog dezelfde waarde leggen om af te sluiten.`;
    }

    return;
  }

  room.turnState = "normal";
  room.sevenSuit = undefined;
  room.sevenStopAfterNext = false;
  moveToNextPlayer(room);
}

function resolveMustPlayAfterKing(room: GameRoom, playerId: string) {
  if (!hasPlayableCard(room, playerId)) {
    drawAmountToPlayer(room, playerId, 1);

    room.lastMessage = `${getPlayerName(
      room,
      playerId
    )} legde een Heer maar kon niet nog een kaart leggen en pakt 1 strafkaart.`;

    room.turnState = "normal";
    moveToNextPlayer(room);
    return;
  }

  room.turnState = "must_play";
}

export function drawCards(room: GameRoom, playerId: string) {
  if (!room.started) {
    throw new Error("Game is nog niet gestart");
  }

  if (room.winnerId) {
    throw new Error("Game is al klaar");
  }

  const currentPlayer = getCurrentPlayer(room);

  if (!currentPlayer || currentPlayer.id !== playerId) {
    throw new Error("Je bent niet aan de beurt");
  }

  if (room.turnState === "after_draw") {
    throw new Error("Je hebt al gepakt. Je mag nu leggen of passen.");
  }

  if (room.turnState === "must_play" || room.turnState === "seven_chain") {
    throw new Error("Je moet nu een kaart leggen.");
  }

  const amount = room.pendingDraw > 0 ? room.pendingDraw : 1;

  drawAmountToPlayer(room, playerId, amount);

  room.pendingDraw = 0;
  room.sevenSuit = undefined;
  room.sevenStopAfterNext = false;

  if (hasPlayableCard(room, playerId)) {
    room.turnState = "after_draw";

    room.lastMessage =
      amount > 1
        ? `${getPlayerName(
            room,
            playerId
          )} pakte ${amount} kaarten en mag nu leggen of passen.`
        : `${getPlayerName(
            room,
            playerId
          )} pakte 1 kaart en mag nu leggen of passen.`;

    return;
  }

  room.turnState = "normal";

  room.lastMessage =
    amount > 1
      ? `${getPlayerName(
          room,
          playerId
        )} pakte ${amount} kaarten maar kan niks leggen.`
      : `${getPlayerName(room, playerId)} pakte 1 kaart maar kan niks leggen.`;

  moveToNextPlayer(room);
}

export function passTurn(room: GameRoom, playerId: string) {
  if (!room.started) {
    throw new Error("Game is nog niet gestart");
  }

  if (room.winnerId) {
    throw new Error("Game is al klaar");
  }

  const currentPlayer = getCurrentPlayer(room);

  if (!currentPlayer || currentPlayer.id !== playerId) {
    throw new Error("Je bent niet aan de beurt");
  }

  if (room.turnState !== "after_draw") {
    throw new Error("Je mag alleen passen nadat je hebt gepakt.");
  }

  room.turnState = "normal";
  room.sevenSuit = undefined;
  room.sevenStopAfterNext = false;
  room.lastMessage = `${getPlayerName(room, playerId)} past de beurt.`;

  moveToNextPlayer(room);
}

export function reorderHand(room: GameRoom, playerId: string, cardIds: string[]) {
  const hand = room.hands[playerId];

  if (!hand) {
    throw new Error("Hand niet gevonden");
  }

  if (cardIds.length !== hand.length) {
    throw new Error("Ongeldige kaartvolgorde");
  }

  const handMap = new Map(hand.map((card) => [card.id, card]));
  const newHand: Card[] = [];

  for (const cardId of cardIds) {
    const card = handMap.get(cardId);

    if (!card) {
      throw new Error("Ongeldige kaartvolgorde");
    }

    newHand.push(card);
  }

  room.hands[playerId] = newHand;
}

export function sortHand(
  room: GameRoom,
  playerId: string,
  _mode: "suit" | "value"
) {
  const hand = room.hands[playerId];

  if (!hand) {
    throw new Error("Hand niet gevonden");
  }

  const suitOrder: Record<string, number> = {
    hearts: 1,
    diamonds: 2,
    clubs: 3,
    spades: 4,
  };

  const valueOrder: Record<string, number> = {
    A: 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    J: 11,
    Q: 12,
    K: 13,
    JOKER: 14,
  };

  hand.sort((a, b) => {
    const suitDiff =
      (suitOrder[a.suit ?? ""] ?? 99) - (suitOrder[b.suit ?? ""] ?? 99);

    if (suitDiff !== 0) return suitDiff;

    return valueOrder[a.value] - valueOrder[b.value];
  });
}

function drawAmountToPlayer(room: GameRoom, playerId: string, amount: number) {
  const hand = room.hands[playerId];

  if (!hand) {
    throw new Error("Hand niet gevonden");
  }

  for (let index = 0; index < amount; index++) {
    ensureDeckHasCards(room);

    const card = room.deck.shift();

    if (card) {
      hand.push(card);
    }
  }
}

function ensureDeckHasCards(room: GameRoom) {
  if (room.deck.length > 0) return;
  if (room.discardPile.length <= 1) return;

  const topCard = room.discardPile.pop();

  if (!topCard) return;

  room.deck = shuffle(room.discardPile);
  room.discardPile = [topCard];
}

function moveSteps(room: GameRoom, steps: number) {
  for (let index = 0; index < steps; index++) {
    moveToNextPlayer(room);
  }
}

export function moveToNextPlayer(room: GameRoom) {
  const totalPlayers = room.players.length;

  if (totalPlayers === 0) return;

  room.currentPlayerIndex =
    (room.currentPlayerIndex + room.direction + totalPlayers) % totalPlayers;
}

export function clampCurrentPlayerIndex(room: GameRoom) {
  if (room.players.length === 0) {
    room.currentPlayerIndex = 0;
    return;
  }

  if (room.currentPlayerIndex >= room.players.length) {
    room.currentPlayerIndex = 0;
  }
}

export function getPublicRoomState(room: GameRoom, playerId: string) {
  const currentPlayerId = getCurrentPlayer(room)?.id;
  const isCurrentPlayer = currentPlayerId === playerId;

  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      connected: player.connected,
      ready: player.ready,
      cardCount: room.hands[player.id]?.length ?? 0,
    })),
    started: room.started,

    hand: room.hands[playerId] ?? [],
    topCard: getTopCard(room),
    currentPlayerId,

    direction: room.direction,
    pendingDraw: room.pendingDraw,
    chosenSuit: room.chosenSuit,

    turnState: room.turnState,
    sevenSuit: room.sevenSuit,
    sevenStopAfterNext: room.sevenStopAfterNext,

    canDraw:
      isCurrentPlayer &&
      !room.winnerId &&
      room.turnState === "normal",

    canPass:
      isCurrentPlayer &&
      !room.winnerId &&
      room.turnState === "after_draw",

    winnerId: room.winnerId,
    lastMessage: room.lastMessage,

    rematchVotes: room.rematchVotes,
  };
}