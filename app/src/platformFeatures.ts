export type PlatformFeatureKey =
  | "matchmaking"
  | "publicRooms"
  | "friends"
  | "invites"
  | "profiles";

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
    subtitle: "Publieke kamers",
    icon: "4",
    badge: "Live",
    tone: "gold",
  },
  {
    key: "friends",
    title: "Vrienden",
    subtitle: "Profielen & invites",
    icon: "+",
    badge: "2",
    tone: "purple",
  },
  {
    key: "invites",
    title: "Invites",
    subtitle: "Direct uitnodigen",
    icon: "@",
    tone: "blue",
  },
  {
    key: "profiles",
    title: "Profiel",
    subtitle: "Stats & badges",
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
    label: "Invite",
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

export const publicRoomPreviews: PublicRoomPreview[] = [
  {
    id: "casual-nl",
    title: "Casual NL",
    ruleset: "Normale regels",
    region: "Nederland",
    seatsTaken: 2,
    seatsTotal: 4,
    statusLabel: "Preview",
  },
  {
    id: "fast-table",
    title: "Snelle tafel",
    ruleset: "Kort potje",
    region: "Europa",
    seatsTaken: 1,
    seatsTotal: 4,
    statusLabel: "Soon",
  },
];

export const previewFriends: PreviewFriend[] = [
  {
    name: "Rival_24",
    status: "Online - invite klaar",
    cta: "Invite",
  },
  {
    name: "Kaartbaas",
    status: "Profiel bekijken",
    cta: "Soon",
  },
  {
    name: "Nieuwe speler",
    status: "Na potje toevoegen",
    cta: "Soon",
  },
];

export const matchmakingPreview: MatchmakingPreview = {
  title: "Online zoeken",
  region: "Nederland",
  ruleset: "Casual tafel",
  estimatedWaitSeconds: 30,
  statusLabel: "Live",
  steps: ["Zoek open tafels", "Maak tafel als nodig", "Voeg leuke spelers later toe"],
};
