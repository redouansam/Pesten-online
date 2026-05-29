export type GameSoundEvent =
  | "card_select"
  | "card_play"
  | "invalid"
  | "draw"
  | "win";

export function playGameSound(_event: GameSoundEvent) {
  // Sound assets are not bundled yet. Keep this no-op hook so the game table
  // can gain audio later without touching gameplay code.
}
