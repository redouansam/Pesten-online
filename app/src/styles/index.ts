import { gameStyles } from "./game";
import { lobbyStyles } from "./lobby";
import { modalStyles } from "./modal";
import { sharedStyles } from "./shared";

export const styles = {
  ...sharedStyles,
  ...lobbyStyles,
  ...gameStyles,
  ...modalStyles,
};
