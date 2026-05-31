import type { LoginProvider } from "./onboarding";

export type PlatformFeatureKey =
  | "matchmaking"
  | "publicRooms"
  | "friends"
  | "invites"
  | "profiles";

export type HubPlayModeKey =
  | "quick"
  | "friends"
  | "publicRooms"
  | "ranked"
  | "tournament";

export type HubPlayMode = {
  key: HubPlayModeKey;
  title: string;
  subtitle: string;
  icon: string;
  badge?: string;
  tone: "blue" | "purple" | "gold";
  availability: "live" | "locked";
};

export type PlatformLoginPlaceholder = {
  provider: Exclude<LoginProvider, "guest">;
  title: string;
  subtitle: string;
};

export type MonetizationPlaceholder = {
  key: "rewardedAds" | "premiumPass" | "gemPacks" | "coinPacks" | "cosmetics";
  title: string;
  text: string;
  actionLabel: string;
};

export type PlatformFeatureCard = {
  key: PlatformFeatureKey;
  title: string;
  subtitle: string;
  icon: string;
  badge?: string;
  tone: "blue" | "purple" | "gold";
};

export type SocialAction = {
  key: PlatformFeatureKey;
  label: string;
  icon: string;
};

export type PreviewFriend = {
  name: string;
  status: string;
  cta: string;
};

export type PublicRoomPreview = {
  id: string;
  title: string;
  ruleset: string;
  region: string;
  seatsTaken: number;
  seatsTotal: number;
  statusLabel: string;
};

export type MatchmakingPreview = {
  title: string;
  region: string;
  ruleset: string;
  estimatedWaitSeconds: number;
  statusLabel: string;
  steps: string[];
};

export const platformFeatureCards: PlatformFeatureCard[] = [
  {
    key: "matchmaking",
    title: "Online zoeken",
    subtitle: "Snel een tafel vinden",
    icon: "NL",
    badge: "Live",
    tone: "blue",
  },
  {
    key: "publicRooms",
    title: "Open tafels",
    subtitle: "Publieke tafels",
    icon: "4",
    badge: "Live",
    tone: "gold",
  },
  {
    key: "friends",
    title: "Vrienden",
    subtitle: "Profielen en uitnodigingen",
    icon: "+",
    badge: "2",
    tone: "purple",
  },
  {
    key: "invites",
    title: "Uitnodigingen",
    subtitle: "Direct uitnodigen",
    icon: "@",
    tone: "blue",
  },
  {
    key: "profiles",
    title: "Profiel",
    subtitle: "Statistieken en badges",
    icon: "?",
    tone: "gold",
  },
];

export const socialActions: SocialAction[] = [
  {
    key: "matchmaking",
    label: "Snelspel",
    icon: "NL",
  },
  {
    key: "publicRooms",
    label: "Tafels",
    icon: "4",
  },
  {
    key: "friends",
    label: "Uitnodigen",
    icon: "+",
  },
  {
    key: "invites",
    label: "Code",
    icon: "@",
  },
  {
    key: "profiles",
    label: "Profiel",
    icon: "?",
  },
];

export const hubPlayModes: HubPlayMode[] = [
  {
    key: "quick",
    title: "Snelspel",
    subtitle: "Vind automatisch een open tafel",
    icon: "NL",
    badge: "Live",
    tone: "blue",
    availability: "live",
  },
  {
    key: "friends",
    title: "Vriendentafel",
    subtitle: "Maak een privetafel met code",
    icon: "P",
    badge: "Code",
    tone: "gold",
    availability: "live",
  },
  {
    key: "publicRooms",
    title: "Open tafels",
    subtitle: "Bekijk publieke tafels",
    icon: "4",
    badge: "Live",
    tone: "gold",
    availability: "live",
  },
  {
    key: "ranked",
    title: "Liga",
    subtitle: "Ranked seizoenen komen later",
    icon: "L",
    badge: "Later",
    tone: "purple",
    availability: "locked",
  },
  {
    key: "tournament",
    title: "Toernooi",
    subtitle: "Toernooien komen later",
    icon: "T",
    badge: "Later",
    tone: "gold",
    availability: "locked",
  },
];

export const platformLoginPlaceholders: PlatformLoginPlaceholder[] = [
  {
    provider: "apple",
    title: "Log in met Apple",
    subtitle: "Binnenkort beschikbaar in de app-release",
  },
  {
    provider: "google",
    title: "Google Play Games",
    subtitle: "Binnenkort beschikbaar in de app-release",
  },
];

export const monetizationPlaceholders: MonetizationPlaceholder[] = [
  {
    key: "rewardedAds",
    title: "Beloningsadvertenties",
    text: "Advertenties later beschikbaar, geen trackingprompt nu.",
    actionLabel: "Later beschikbaar",
  },
  {
    key: "premiumPass",
    title: "Premium pass",
    text: "Voorbeeld van kaartbacks, badges, extra missies en premium dagbeloning.",
    actionLabel: "Binnenkort via App Store / Google Play",
  },
  {
    key: "gemPacks",
    title: "Gem-pakketten",
    text: "Betaalde aankopen worden pas gekoppeld in de app-release.",
    actionLabel: "Binnenkort via App Store / Google Play",
  },
  {
    key: "coinPacks",
    title: "Coin-pakketten",
    text: "Valuta-shop is voorbereid zonder echte betaling.",
    actionLabel: "Binnenkort via App Store / Google Play",
  },
  {
    key: "cosmetics",
    title: "Cosmetica",
    text: "Kaartbacks, tafels, avatars en frames zijn uitbreidbaar.",
    actionLabel: "Bekijk markt",
  },
];

export const publicRoomPreviews: PublicRoomPreview[] = [
  {
    id: "casual-nl",
    title: "Casual NL",
    ruleset: "Normale regels",
    region: "Nederland",
    seatsTaken: 2,
    seatsTotal: 4,
    statusLabel: "Voorbeeld",
  },
  {
    id: "fast-table",
    title: "Snelle tafel",
    ruleset: "Kort potje",
    region: "Europa",
    seatsTaken: 1,
    seatsTotal: 4,
    statusLabel: "Binnenkort",
  },
];

export const previewFriends: PreviewFriend[] = [
  {
    name: "Rival_24",
    status: "Online - uitnodiging klaar",
    cta: "Uitnodigen",
  },
  {
    name: "Kaartbaas",
    status: "Profiel bekijken",
    cta: "Binnenkort",
  },
  {
    name: "Nieuwe speler",
    status: "Na potje toevoegen",
    cta: "Binnenkort",
  },
];

export const matchmakingPreview: MatchmakingPreview = {
  title: "Online zoeken",
  region: "Nederland",
  ruleset: "Casual tafel",
  estimatedWaitSeconds: 30,
  statusLabel: "Live",
  steps: [
    "Zoek open tafels",
    "Maak een tafel als dat nodig is",
    "Voeg leuke spelers later toe",
  ],
};
