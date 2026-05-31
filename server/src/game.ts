import { Card, GameRoom, Player, RoomMode, RoomVisibility, Suit } from "./types";

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
const redrawBaseCostGems = 3;
const redrawCostStepGems = 2;

export type RedrawRequestOptions = {
  offerId?: string;
  availableGems?: number;
};

export function generateRoomCode(existingCodes: string[]) {
  let code = "";

  do {
    code = Math.random().toString(36).substring(2, 7).toUpperCase();
  } while (existingCodes.includes(code));

  return code;
}

export function createRoom(
  code: string,
  host: Player,
  options: {
    visibility?: RoomVisibility;
    mode?: RoomMode;
    maxPlayers?: number;
  } = {}
): GameRoom {
  return {
    code,
    hostId: host.id,
    players: [host],
    started: false,
    roundId: 0,
    visibility: options.visibility ?? "private",
    mode: options.mode ?? "friends",
    maxPlayers: Math.max(2, Math.min(4, options.maxPlayers ?? 4)),
    region: "NL",
    createdAt: Date.now(),

    deck: [],
    discardPile: [],
    hands: {},

    currentPlayerIndex: 0,
    direction: 1,

    pendingDraw: 0,
    turnState: "normal",
    redrawCounts: {},

    roundPlayerIds: [],
    finishedPlayerIds: [],
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
  room.redrawOffer = undefined;
  room.redrawCounts = {};

  room.winnerId = undefined;
  room.loserId = undefined;
  room.finishedPlayerIds = [];
  room.lastMessage = "Kaarten worden gedeeld...";
  room.rematchVotes = {};

  room.started = true;
  room.roundId += 1;

  room.roundPlayerIds = room.players.map((player) => player.id);

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
  room.redrawOffer = undefined;
  room.redrawCounts = {};
  room.winnerId = undefined;
  room.loserId = undefined;
  room.roundPlayerIds = [];
  room.finishedPlayerIds = [];
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

function isRoundPlayer(room: GameRoom, playerId: string) {
  return room.roundPlayerIds.includes(playerId);
}

function isFinishedPlayer(room: GameRoom, playerId: string) {
  return room.finishedPlayerIds.includes(playerId);
}

function isActiveTurnPlayer(room: GameRoom, player: Player) {
  if (!room.started) return true;
  if (room.turnState === "finished" || room.loserId) return false;

  return (
    isRoundPlayer(room, player.id) &&
    !isFinishedPlayer(room, player.id)
  );
}

function getRemainingRoundPlayers(room: GameRoom) {
  return room.players.filter(
    (player) => isRoundPlayer(room, player.id) && !isFinishedPlayer(room, player.id)
  );
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

function isPlayableSevenInChain(room: GameRoom, card: Card) {
  if (card.value !== "7") return false;
  if (!room.sevenSuit) return false;

  const topCard = getTopCard(room);

  return card.suit === room.sevenSuit || topCard?.value === "7";
}

function hasPlayableSevenInChain(
  room: GameRoom,
  playerId: string,
  exceptCardId?: string
) {
  const hand = room.hands[playerId] ?? [];

  return hand.some(
    (card) => card.id !== exceptCardId && isPlayableSevenInChain(room, card)
  );
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
  const stillHasPlayableSeven = hasPlayableSevenInChain(
    room,
    playerId,
    card.id
  );

  return (
    !stillHasSevenSuit &&
    !stillHasPlayableSeven &&
    card.value === topCard.value
  );
}

export function canPlayCard(room: GameRoom, card: Card, playerId?: string) {
  const activePlayerId = playerId ?? getCurrentPlayer(room)?.id;

  if (
    activePlayerId &&
    room.started &&
    (!isRoundPlayer(room, activePlayerId) || isFinishedPlayer(room, activePlayerId))
  ) {
    return false;
  }

  if (room.turnState === "seven_chain") {
    if (room.sevenStopAfterNext) {
      return canPlayNormalTurnCard(room, card);
    }

    if (card.suit === room.sevenSuit) return true;
    if (isPlayableSevenInChain(room, card)) return true;

    if (!activePlayerId) return false;
    if (!room.sevenSuit) return false;

    const topCard = getTopCard(room);

    if (!topCard) return true;

    const stillHasSevenSuit = hasOtherCardOfSuit(
      room,
      activePlayerId,
      room.sevenSuit,
      card.id
    );
    const stillHasPlayableSeven = hasPlayableSevenInChain(
      room,
      activePlayerId,
      card.id
    );

    return (
      !stillHasSevenSuit &&
      !stillHasPlayableSeven &&
      card.value === topCard.value
    );
  }

  return canPlayNormalTurnCard(room, card);
}

function canPlayNormalTurnCard(room: GameRoom, card: Card) {
  const topCard = getTopCard(room);

  if (!topCard) return true;

  if (room.pendingDraw > 0) {
    return card.value === "2" || card.value === "JOKER";
  }

  if (topCard.value === "JOKER") {
    return true;
  }

  if (card.value === "JOKER") return true;

  const activeSuit = getActiveSuit(room);

  if (card.value === "J") {
    return (
      topCard.value === "J" ||
      Boolean(card.suit && activeSuit && card.suit === activeSuit)
    );
  }

  return card.value === topCard.value || card.suit === activeSuit;
}

function hasPlayableCard(room: GameRoom, playerId: string) {
  if (!isRoundPlayer(room, playerId) || isFinishedPlayer(room, playerId)) {
    return false;
  }

  const hand = room.hands[playerId] ?? [];

  return hand.some((card) => canPlayCard(room, card, playerId));
}

function isForcedExtraCardState(room: GameRoom) {
  return (
    room.turnState === "must_play" ||
    (room.turnState === "seven_chain" && Boolean(room.sevenStopAfterNext))
  );
}

function canDrawNow(room: GameRoom, playerId: string) {
  if (!isRoundPlayer(room, playerId) || isFinishedPlayer(room, playerId)) {
    return false;
  }

  if (room.turnState === "normal") return true;
  if (!isForcedExtraCardState(room)) return false;

  return !hasPlayableCard(room, playerId);
}

function canPassNow(room: GameRoom) {
  if (room.turnState === "after_draw") return true;

  return false;
}

export function getRedrawCost(room: GameRoom, playerId: string) {
  return (
    redrawBaseCostGems +
    (room.redrawCounts?.[playerId] ?? 0) * redrawCostStepGems
  );
}

function createRedrawOffer(room: GameRoom, playerId: string, cardId: string) {
  const redrawCount = room.redrawCounts?.[playerId] ?? 0;

  room.redrawOffer = {
    playerId,
    cardId,
    offerId: `${room.roundId}:${playerId}:${cardId}:${redrawCount}`,
  };

  return room.redrawOffer;
}

export function spendGemsForRedraw(
  room: GameRoom,
  playerId: string,
  availableGems?: number
) {
  const costGems = getRedrawCost(room, playerId);

  if (availableGems !== undefined && availableGems < costGems) {
    throw new Error("Niet genoeg gems");
  }

  return costGems;
}

function assertCanRedrawLastDrawnCard(
  room: GameRoom,
  playerId: string,
  options: RedrawRequestOptions = {}
) {
  if (!room.started) {
    throw new Error("Spel is nog niet gestart");
  }

  if (room.turnState === "finished") {
    throw new Error("Spel is al klaar");
  }

  const currentPlayer = getCurrentPlayer(room);

  if (!currentPlayer || currentPlayer.id !== playerId) {
    throw new Error("Je bent niet aan de beurt");
  }

  if (currentPlayer.isBot) {
    throw new Error("Bots gebruiken geen gems");
  }

  if (room.turnState !== "after_draw") {
    throw new Error("Alleen direct na trekken.");
  }

  if (room.redrawOffer?.playerId !== playerId) {
    throw new Error("Alleen direct na trekken.");
  }

  if (options.offerId && options.offerId !== room.redrawOffer.offerId) {
    throw new Error("Alleen direct na trekken.");
  }

  spendGemsForRedraw(room, playerId, options.availableGems);

  return room.redrawOffer;
}

export function canRedrawLastDrawnCard(
  room: GameRoom,
  playerId: string,
  options: RedrawRequestOptions = {}
) {
  try {
    assertCanRedrawLastDrawnCard(room, playerId, options);
    return true;
  } catch {
    return false;
  }
}

function finishRoundIfHandEmpty(room: GameRoom, playerId: string) {
  if ((room.hands[playerId]?.length ?? 0) > 0) return false;

  if (!isRoundPlayer(room, playerId)) return false;

  if (!room.finishedPlayerIds.includes(playerId)) {
    room.finishedPlayerIds.push(playerId);
  }

  const remainingPlayers = getRemainingRoundPlayers(room);
  const loser =
    remainingPlayers.length === 1
      ? remainingPlayers[0]
      : remainingPlayers.find((player) => player.id !== playerId);

  room.winnerId = playerId;
  room.loserId = loser?.id;
  room.turnState = "finished";
  room.pendingDraw = 0;
  room.chosenSuit = undefined;
  room.sevenSuit = undefined;
  room.sevenStopAfterNext = false;
  room.redrawOffer = undefined;

  if (loser) {
    const loserIndex = room.players.findIndex((player) => player.id === loser.id);

    if (loserIndex !== -1) {
      room.currentPlayerIndex = loserIndex;
    }
  }

  room.lastMessage = `${getPlayerName(room, playerId)} is uit en wint de ronde.`;

  return true;
}

function penalizePestCardFinish(room: GameRoom, playerId: string) {
  drawAmountToPlayer(room, playerId, 2);

  room.lastMessage = `${getPlayerName(
    room,
    playerId
  )} probeerde te eindigen met een pestkaart en pakt 2 strafkaarten.`;
}

function clearSevenChain(room: GameRoom) {
  room.turnState = "normal";
  room.sevenSuit = undefined;
  room.sevenStopAfterNext = false;
}

function penalizeFailedSevenContinuation(
  room: GameRoom,
  playerId: string,
  message: string
) {
  drawAmountToPlayer(room, playerId, 1);
  room.lastMessage = message;
  clearSevenChain(room);
  moveToNextPlayer(room);
}

export function playCard(
  room: GameRoom,
  playerId: string,
  cardId: string,
  chosenSuit?: Suit
) {
  if (!room.started) {
    throw new Error("Spel is nog niet gestart");
  }

  if (room.turnState === "finished") {
    throw new Error("Spel is al klaar");
  }

  const currentPlayer = getCurrentPlayer(room);

  if (!currentPlayer || currentPlayer.id !== playerId) {
    throw new Error("Je bent niet aan de beurt");
  }

  const hand = room.hands[playerId];

  if (!hand) {
    throw new Error("Handkaarten niet gevonden");
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
    throw new Error("Kies een symbool bij de Boer.");
  }

  const wasSevenChain = room.turnState === "seven_chain";
  const wasSevenStopAfterNext = Boolean(room.sevenStopAfterNext);
  const wasSevenSameValueFinish = isSevenSameValueFinish(room, playerId, card);
  const wasMustPlayTurn = room.turnState === "must_play";

  hand.splice(cardIndex, 1);
  room.discardPile.push(card);
  room.lastMessage = undefined;
  room.redrawOffer = undefined;

  const effect = applyCardEffect(room, card, chosenSuit);
  const wasPestCardFinish = hand.length === 0 && isPestCard(card);

  if (wasPestCardFinish) {
    penalizePestCardFinish(room, playerId);
  }

  if (wasMustPlayTurn && card.value === "K") {
    room.turnState = "normal";

    if (finishRoundIfHandEmpty(room, playerId)) return;

    moveSteps(room, effect.steps);
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

    if (finishRoundIfHandEmpty(room, playerId)) return;

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

  if (finishRoundIfHandEmpty(room, playerId)) return;

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

    if (getRemainingRoundPlayers(room).length === 2) {
      steps = 2;
    }
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

  if (
    !hasCardOfSuit(room, playerId, card.suit) &&
    !hasCardOfValue(room, playerId, "7")
  ) {
    penalizeFailedSevenContinuation(
      room,
      playerId,
      `${getPlayerName(
        room,
        playerId
      )} legde een 7 maar kon geen kaart erbij leggen en pakt 1 strafkaart.`
    );
    return;
  }

  room.turnState = "seven_chain";
  room.sevenSuit = card.suit;
  room.sevenStopAfterNext = false;
  room.lastMessage = `${getPlayerName(
    room,
    playerId
  )} moet nu hetzelfde symbool of nog een 7 leggen.`;
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
    clearSevenChain(room);

    if (finishRoundIfHandEmpty(room, playerId)) return;

    moveSteps(room, steps);
    return;
  }

  if (card.value === "K") {
    room.turnState = "seven_chain";
    room.sevenStopAfterNext = true;
    room.lastMessage = hasPlayableCard(room, playerId)
      ? "Heer in 7-reeks: leg nog precies een kaart."
      : "Heer in 7-reeks: geen vervolgkaart, trek 1 kaart.";
    return;
  }

  if (card.value === "7") {
    const canContinueWithSuit = hasCardOfSuit(room, playerId, card.suit);
    const canContinueWithSeven = hasCardOfValue(room, playerId, "7");

    if (!canContinueWithSuit && !canContinueWithSeven) {
      penalizeFailedSevenContinuation(
        room,
        playerId,
        `${getPlayerName(
          room,
          playerId
        )} legde een 7 maar kon niet verder en pakt 1 strafkaart.`
      );
      return;
    }

    room.turnState = "seven_chain";
    room.sevenSuit = card.suit;
    room.sevenStopAfterNext = false;
    room.lastMessage = `${getPlayerName(
      room,
      playerId
    )} mag hetzelfde symbool of nog een 7 leggen.`;
    return;
  }

  if (isPestCard(card)) {
    clearSevenChain(room);

    if (finishRoundIfHandEmpty(room, playerId)) return;

    moveSteps(room, steps);
    return;
  }

  const topCard = getTopCard(room);
  const canContinueWithSuit = hasCardOfSuit(room, playerId, suit);
  const canContinueWithSeven = hasPlayableSevenInChain(room, playerId);
  const canFinishWithSameValue = hasCardOfValue(room, playerId, topCard?.value);

  if (canContinueWithSuit || canContinueWithSeven || canFinishWithSameValue) {
    room.turnState = "seven_chain";
    room.sevenStopAfterNext = false;

    if (!canContinueWithSuit && !canContinueWithSeven && canFinishWithSameValue) {
      room.lastMessage = `${getPlayerName(
        room,
        playerId
      )} mag nog dezelfde waarde leggen om af te sluiten.`;
    }

    return;
  }

  clearSevenChain(room);

  if (finishRoundIfHandEmpty(room, playerId)) return;

  room.lastMessage = `${getPlayerName(
    room,
    playerId
  )} sluit de 7-reeks af.`;
  moveSteps(room, steps);
}

function resolveMustPlayAfterKing(room: GameRoom, playerId: string) {
  if (!hasPlayableCard(room, playerId)) {
    room.lastMessage = `${getPlayerName(
      room,
      playerId
    )} legde een Heer maar heeft geen vervolgkaart. Trek 1 kaart.`;

    room.turnState = "must_play";
    return;
  }

  room.turnState = "must_play";
}

export function drawCards(room: GameRoom, playerId: string) {
  if (!room.started) {
    throw new Error("Spel is nog niet gestart");
  }

  if (room.turnState === "finished") {
    throw new Error("Spel is al klaar");
  }

  const currentPlayer = getCurrentPlayer(room);

  if (!currentPlayer || currentPlayer.id !== playerId) {
    throw new Error("Je bent niet aan de beurt");
  }

  if (room.turnState === "after_draw") {
    throw new Error("Je hebt al een kaart getrokken. Je mag nu leggen of passen.");
  }

  if (!canDrawNow(room, playerId)) {
    throw new Error("Je moet nu een kaart leggen.");
  }

  const amount = room.pendingDraw > 0 ? room.pendingDraw : 1;

  const drawnCards = drawAmountToPlayer(room, playerId, amount);

  room.pendingDraw = 0;
  room.sevenSuit = undefined;
  room.sevenStopAfterNext = false;
  room.redrawOffer = undefined;

  if (amount === 1 && drawnCards.length === 1) {
    room.turnState = "after_draw";
    createRedrawOffer(room, playerId, drawnCards[0].id);

    room.lastMessage = hasPlayableCard(room, playerId)
      ? `${getPlayerName(
          room,
          playerId
        )} trok 1 kaart en mag nu leggen, opnieuw trekken of passen.`
      : `${getPlayerName(
          room,
          playerId
        )} trok 1 kaart maar kan geen kaart leggen. Opnieuw trekken mogelijk.`;

    return;
  }

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
        )} pakte ${amount} kaarten maar kan geen kaart leggen.`
      : `${getPlayerName(
          room,
          playerId
        )} pakte 1 kaart maar kan geen kaart leggen.`;

  moveToNextPlayer(room);
}

export function passTurn(room: GameRoom, playerId: string) {
  if (!room.started) {
    throw new Error("Spel is nog niet gestart");
  }

  if (room.turnState === "finished") {
    throw new Error("Spel is al klaar");
  }

  const currentPlayer = getCurrentPlayer(room);

  if (!currentPlayer || currentPlayer.id !== playerId) {
    throw new Error("Je bent niet aan de beurt");
  }

  if (!canPassNow(room)) {
    throw new Error("Je mag alleen passen nadat je een kaart hebt getrokken.");
  }

  room.turnState = "normal";
  room.sevenSuit = undefined;
  room.sevenStopAfterNext = false;
  room.redrawOffer = undefined;
  room.lastMessage = `${getPlayerName(room, playerId)} past.`;

  moveToNextPlayer(room);
}

export function applyRedrawLastDrawnCard(
  room: GameRoom,
  playerId: string,
  options: RedrawRequestOptions = {}
) {
  const offer = assertCanRedrawLastDrawnCard(room, playerId, options);
  const costGems = getRedrawCost(room, playerId);
  const hand = room.hands[playerId];

  if (!hand) {
    throw new Error("Handkaarten niet gevonden");
  }

  const oldCardIndex = hand.findIndex((card) => card.id === offer.cardId);

  if (oldCardIndex === -1) {
    throw new Error("Alleen direct na trekken.");
  }

  const [oldCard] = hand.splice(oldCardIndex, 1);

  ensureDeckHasCards(room);

  const newCard = room.deck.shift();

  if (!newCard) {
    hand.splice(oldCardIndex, 0, oldCard);
    throw new Error("Er zijn geen kaarten meer om te trekken");
  }

  room.deck.push(oldCard);
  hand.push(newCard);
  room.redrawCounts[playerId] = (room.redrawCounts[playerId] ?? 0) + 1;
  const nextOffer = createRedrawOffer(room, playerId, newCard.id);
  room.turnState = "after_draw";
  room.lastMessage = `${getPlayerName(
    room,
    playerId
  )} trok opnieuw voor ${costGems} gems.`;

  return {
    costGems,
    oldCard,
    newCard,
    offerId: nextOffer.offerId,
  };
}

export function redrawDrawnCard(
  room: GameRoom,
  playerId: string,
  options: RedrawRequestOptions = {}
) {
  return applyRedrawLastDrawnCard(room, playerId, options);
}

export function reorderHand(room: GameRoom, playerId: string, cardIds: string[]) {
  const hand = room.hands[playerId];

  if (!hand) {
    throw new Error("Handkaarten niet gevonden");
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
  mode: "suit" | "value"
) {
  const hand = room.hands[playerId];

  if (!hand) {
    throw new Error("Handkaarten niet gevonden");
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
    const valueDiff = valueOrder[a.value] - valueOrder[b.value];

    if (mode === "value") {
      if (valueDiff !== 0) return valueDiff;
      return suitDiff;
    }

    if (suitDiff !== 0) return suitDiff;

    return valueDiff;
  });
}

export function playBotTurn(room: GameRoom, botId: string) {
  const currentPlayer = getCurrentPlayer(room);

  if (!currentPlayer?.isBot || currentPlayer.id !== botId) return false;
  if (!room.started || room.turnState === "finished") return false;

  for (let attempt = 0; attempt < 4; attempt++) {
    const activePlayer = getCurrentPlayer(room);

    if (activePlayer?.id !== botId || isRoomFinished(room)) {
      return true;
    }

    const hand = room.hands[botId] ?? [];
    const playableCards = hand.filter((card) => canPlayCard(room, card, botId));
    const chosenCard = chooseBotCard(room, botId, playableCards);

    if (chosenCard) {
      const chosenSuit =
        chosenCard.value === "J" ? chooseBotSuit(hand, chosenCard.id) : undefined;

      playCard(room, botId, chosenCard.id, chosenSuit);
      continue;
    }

    if (canDrawNow(room, botId)) {
      drawCards(room, botId);
      continue;
    }

    if (canPassNow(room)) {
      passTurn(room, botId);
      return true;
    }

    return true;
  }

  return true;
}

function isRoomFinished(room: GameRoom) {
  return room.turnState === "finished";
}

function chooseBotCard(room: GameRoom, botId: string, playableCards: Card[]) {
  if (playableCards.length === 0) return undefined;

  const hand = room.hands[botId] ?? [];
  const wouldEndRound = hand.length === 1;

  if (room.pendingDraw > 0) {
    return (
      playableCards.find((card) => card.value === "JOKER") ??
      playableCards.find((card) => card.value === "2")
    );
  }

  const safeCards = wouldEndRound
    ? playableCards.filter((card) => !isPestCard(card))
    : playableCards;
  const candidates = safeCards.length > 0 ? safeCards : playableCards;
  const preferredOrder: Card["value"][] =
    room.turnState === "must_play" || room.turnState === "seven_chain"
      ? ["3", "4", "5", "6", "9", "10", "Q", "2", "JOKER", "8", "A", "J", "K", "7"]
      : ["3", "4", "5", "6", "9", "10", "Q", "7", "K", "J", "8", "A", "2", "JOKER"];

  return [...candidates].sort(
    (cardA, cardB) =>
      preferredOrder.indexOf(cardA.value) - preferredOrder.indexOf(cardB.value)
  )[0];
}

function chooseBotSuit(hand: Card[], playedCardId: string): Suit {
  const suitScores = new Map<Suit, number>();

  for (const card of hand) {
    if (!card.suit || card.id === playedCardId) continue;

    suitScores.set(card.suit, (suitScores.get(card.suit) ?? 0) + 1);
  }

  return [...suitScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "hearts";
}

function drawAmountToPlayer(room: GameRoom, playerId: string, amount: number) {
  const hand = room.hands[playerId];
  const drawnCards: Card[] = [];

  if (!hand) {
    throw new Error("Handkaarten niet gevonden");
  }

  for (let index = 0; index < amount; index++) {
    ensureDeckHasCards(room);

    const card = room.deck.shift();

    if (card) {
      hand.push(card);
      drawnCards.push(card);
    }
  }

  return drawnCards;
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

  if (!room.started || room.turnState === "finished") {
    room.currentPlayerIndex =
      (room.currentPlayerIndex + room.direction + totalPlayers) % totalPlayers;
    return;
  }

  for (let attempt = 0; attempt < totalPlayers; attempt++) {
    room.currentPlayerIndex =
      (room.currentPlayerIndex + room.direction + totalPlayers) % totalPlayers;

    const currentPlayer = room.players[room.currentPlayerIndex];

    if (currentPlayer && isActiveTurnPlayer(room, currentPlayer)) return;
  }
}

export function clampCurrentPlayerIndex(room: GameRoom) {
  if (room.players.length === 0) {
    room.currentPlayerIndex = 0;
    return;
  }

  if (room.currentPlayerIndex >= room.players.length) {
    room.currentPlayerIndex = 0;
  }

  if (!room.started || room.turnState === "finished") return;

  const currentPlayer = room.players[room.currentPlayerIndex];

  if (currentPlayer && isActiveTurnPlayer(room, currentPlayer)) return;

  const nextActiveIndex = room.players.findIndex((player) =>
    isActiveTurnPlayer(room, player)
  );

  if (nextActiveIndex !== -1) {
    room.currentPlayerIndex = nextActiveIndex;
  }
}

export function getPublicRoomState(room: GameRoom, playerId: string) {
  const currentPlayerId =
    room.turnState === "finished" ? undefined : getCurrentPlayer(room)?.id;
  const isCurrentPlayer = currentPlayerId === playerId;
  const roundFinished = room.turnState === "finished";

  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map((player) => {
      const inRound = isRoundPlayer(room, player.id);
      const finished = isFinishedPlayer(room, player.id);

      return {
        id: player.id,
        name: player.name,
        connected: player.connected,
        ready: player.ready,
        isBot: player.isBot,
        cardCount: room.hands[player.id]?.length ?? 0,
        inRound,
        finished,
        waitingForNextRound: room.started && !inRound,
        rank: finished ? room.finishedPlayerIds.indexOf(player.id) + 1 : undefined,
      };
    }),
    started: room.started,
    roundId: room.roundId,
    visibility: room.visibility,
    mode: room.mode,
    maxPlayers: room.maxPlayers,
    status: room.started && room.turnState !== "finished" ? "in_game" : "waiting",
    region: room.region,
    createdAt: room.createdAt,

    hand: room.hands[playerId] ?? [],
    topCard: getTopCard(room),
    currentPlayerId,

    direction: room.direction,
    pendingDraw: room.pendingDraw,
    chosenSuit: room.chosenSuit,

    turnState: room.turnState,
    sevenSuit: room.sevenSuit,
    sevenStopAfterNext: room.sevenStopAfterNext,
    canRedrawDrawnCard:
      isCurrentPlayer &&
      !roundFinished &&
      room.turnState === "after_draw" &&
      room.redrawOffer?.playerId === playerId,
    redrawCostGems: getRedrawCost(room, playerId),
    redrawOfferId:
      room.redrawOffer?.playerId === playerId ? room.redrawOffer.offerId : undefined,

    canDraw:
      isCurrentPlayer &&
      !roundFinished &&
      canDrawNow(room, playerId),

    canPass:
      isCurrentPlayer &&
      !roundFinished &&
      canPassNow(room),

    winnerId: room.winnerId,
    loserId: room.loserId,
    finishedPlayerIds: room.finishedPlayerIds,
    lastMessage: room.lastMessage,

    rematchVotes: room.rematchVotes,
  };
}
