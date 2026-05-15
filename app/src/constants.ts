import { Suit } from "./types";

export const STORAGE_PLAYER_ID = "pesten_player_id";
export const STORAGE_ROOM_CODE = "pesten_room_code";
export const STORAGE_PLAYER_NAME = "pesten_player_name";

export const suitOptions: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

export const suitLabels: Record<Suit, string> = {
  hearts: "♥ Harten",
  diamonds: "♦ Ruiten",
  clubs: "♣ Klaveren",
  spades: "♠ Schoppen",
};

export const suitShortLabels: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

export const suitColors: Record<Suit, string> = {
  hearts: "#dc2626",
  diamonds: "#dc2626",
  clubs: "#111827",
  spades: "#111827",
};
