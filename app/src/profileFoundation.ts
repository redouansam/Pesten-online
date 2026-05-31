import type { Wallet } from "./economy";
import type { LoginProvider, PlatformIdentity } from "./onboarding";

export type PlayerProfileFoundation = {
  playerId: string;
  guestId: string | null;
  appleGameCenterId: string | null;
  googlePlayGamesId: string | null;
  platformUserId: string | null;
  loginProvider: LoginProvider;
  hasAcceptedTerms: boolean;
  hasCompletedTutorial: boolean;
  playerName: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  favoriteCardback: string;
  level: number;
  xp: number;
  coins: number;
  gems: number;
  onlineStatus: "online" | "offline" | "reconnecting";
};

export type RecentPlayer = {
  playerId: string;
  name: string;
  lastPlayedAt: number;
  result: "win" | "loss" | "played";
};

export type FriendFoundation = {
  playerId: string;
  name: string;
  onlineStatus: "online" | "offline";
  relationship: "recent" | "placeholder";
};

export const RECENT_PLAYERS_STORAGE_KEY = "pesten.recentPlayers.v1";

export function buildProfileFoundation({
  connected,
  level,
  name,
  playerId,
  wallet,
  identity,
}: {
  connected: boolean;
  identity?: PlatformIdentity | null;
  level: number;
  name: string;
  playerId: string;
  wallet: Wallet;
}): PlayerProfileFoundation {
  return {
    playerId,
    guestId: identity?.guestId ?? null,
    appleGameCenterId: identity?.appleGameCenterId ?? null,
    googlePlayGamesId: identity?.googlePlayGamesId ?? null,
    platformUserId: identity?.platformUserId ?? null,
    loginProvider: identity?.loginProvider ?? "guest",
    hasAcceptedTerms: Boolean(
      identity?.hasAcceptedTerms && identity?.hasAcceptedPrivacy
    ),
    hasCompletedTutorial: Boolean(identity?.hasCompletedTutorial),
    playerName: name,
    wins: wallet.wins,
    losses: wallet.losses,
    gamesPlayed: wallet.gamesPlayed,
    favoriteCardback: wallet.selectedCardBackId,
    level,
    xp: wallet.xp,
    coins: wallet.coins,
    gems: wallet.gems,
    onlineStatus: connected ? "online" : "reconnecting",
  };
}
