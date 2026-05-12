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
  ready: boolean;
};

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

  winnerId?: string;
  lastMessage?: string;

  rematchVotes: Record<string, boolean>;
};

export type PublicPlayer = {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  cardCount: number;
};

export type PublicRoomState = {
  code: string;
  hostId: string;
  players: PublicPlayer[];
  started: boolean;

  hand: Card[];
  topCard?: Card;
  currentPlayerId?: string;

  direction: 1 | -1;
  pendingDraw: number;
  chosenSuit?: Suit;

  turnState: TurnState;
  sevenSuit?: Suit;
  sevenStopAfterNext?: boolean;

  canDraw: boolean;
  canPass: boolean;

  winnerId?: string;
  lastMessage?: string;

  rematchVotes: Record<string, boolean>;
};