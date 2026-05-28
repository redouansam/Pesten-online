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

export type TurnState =
  | "normal"
  | "after_draw"
  | "must_play"
  | "seven_chain"
  | "finished";

export type PublicPlayer = {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  cardCount: number;
  inRound: boolean;
  finished: boolean;
  waitingForNextRound: boolean;
  rank?: number;
};

export type PublicRoomState = {
  code: string;
  hostId: string;
  players: PublicPlayer[];
  started: boolean;
  roundId: number;

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
