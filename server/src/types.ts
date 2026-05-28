export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type CardValue =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "JOKER";

export type Card = {
  id: string;
  suit?: Suit;
  value: CardValue;
};

export type Player = {
  id: string;
  socketId: string;
  name: string;
  connected: boolean;
  disconnectedAt?: number;
  ready: boolean;
  isBot?: boolean;
};

export type RoomVisibility = "private" | "public";
export type RoomMode = "friends" | "casual" | "quick";
export type RoomStatus = "waiting" | "in_game";

export type TurnState =
  | "normal"
  | "after_draw"
  | "must_play"
  | "seven_chain"
  | "finished";

export type GameRoom = {
  code: string;
  hostId: string;
  players: Player[];
  started: boolean;
  roundId: number;
  visibility: RoomVisibility;
  mode: RoomMode;
  maxPlayers: number;
  region: "NL";
  createdAt: number;

  deck: Card[];
  discardPile: Card[];
  hands: Record<string, Card[]>;

  currentPlayerIndex: number;
  direction: 1 | -1;

  pendingDraw: number;
  chosenSuit?: Suit;

  turnState: TurnState;
  sevenSuit?: Suit;
  sevenStopAfterNext?: boolean;
  redrawOffer?: {
    playerId: string;
    cardId: string;
    attempts: number;
  };

  winnerId?: string;
  loserId?: string;
  roundPlayerIds: string[];
  finishedPlayerIds: string[];
  lastMessage?: string;

  rematchVotes: Record<string, boolean>;
};

export type PublicPlayer = {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  isBot?: boolean;
  cardCount: number;
  inRound: boolean;
  finished: boolean;
  waitingForNextRound: boolean;
  rank?: number;
};

export type PublicRoomSummary = {
  code: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: RoomStatus;
  region: "NL";
  mode: RoomMode;
  createdAt: number;
};

export type PublicRoomState = {
  code: string;
  hostId: string;
  players: PublicPlayer[];
  started: boolean;
  roundId: number;
  visibility: RoomVisibility;
  mode: RoomMode;
  maxPlayers: number;
  status: RoomStatus;
  region: "NL";
  createdAt: number;

  hand: Card[];
  topCard?: Card;
  currentPlayerId?: string;

  direction: 1 | -1;
  pendingDraw: number;
  chosenSuit?: Suit;

  turnState: TurnState;
  sevenSuit?: Suit;
  sevenStopAfterNext?: boolean;
  canRedrawDrawnCard: boolean;
  redrawCostGems: number;

  canDraw: boolean;
  canPass: boolean;

  winnerId?: string;
  loserId?: string;
  finishedPlayerIds: string[];
  lastMessage?: string;

  rematchVotes: Record<string, boolean>;
};
