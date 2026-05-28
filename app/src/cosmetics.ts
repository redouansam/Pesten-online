export type AvatarOption = {
  id: string;
  title: string;
  description: string;
  rarity: "Starter" | "Common" | "Rare" | "Epic" | "Premium";
  badge: string;
  priceCoins?: number;
  premium?: boolean;
  unlockLevel?: number;
  backgroundColor: string;
  textColor: string;
};

export type AvatarFrameOption = {
  id: string;
  title: string;
  description: string;
  rarity: "Starter" | "Common" | "Rare" | "Epic" | "Premium";
  priceCoins?: number;
  premium?: boolean;
  unlockLevel?: number;
  borderColor: string;
  backgroundColor: string;
  glowColor: string;
};

export const defaultAvatarId = "initial";
export const defaultAvatarFrameId = "plain";
export const starterAvatarIds = [defaultAvatarId];
export const starterAvatarFrameIds = [defaultAvatarFrameId];

export const avatarOptions: AvatarOption[] = [
  {
    id: "initial",
    title: "Initial",
    description: "Je eigen beginletter, clean en duidelijk.",
    rarity: "Starter",
    badge: "",
    backgroundColor: "#c9a45c",
    textColor: "#ffffff",
  },
  {
    id: "seven",
    title: "Seven Player",
    description: "Voor spelers die graag doorleggen.",
    rarity: "Common",
    badge: "7",
    priceCoins: 120,
    backgroundColor: "#1f7a54",
    textColor: "#f5efe4",
  },
  {
    id: "jack",
    title: "Boer Boss",
    description: "Suit control met een scherpe look.",
    rarity: "Rare",
    badge: "J",
    priceCoins: 220,
    backgroundColor: "#7f1d1d",
    textColor: "#fff7ed",
  },
  {
    id: "king",
    title: "Royal King",
    description: "Een royale avatar voor de tafelbaas.",
    rarity: "Epic",
    priceCoins: 360,
    badge: "K",
    backgroundColor: "#3b2f16",
    textColor: "#facc15",
  },
  {
    id: "ace",
    title: "Ace",
    description: "Season reward voor vaste spelers.",
    rarity: "Premium",
    premium: true,
    badge: "A",
    backgroundColor: "#111827",
    textColor: "#93c5fd",
  },
];

export const avatarFrameOptions: AvatarFrameOption[] = [
  {
    id: "plain",
    title: "Classic",
    description: "Rustige standaard rand.",
    rarity: "Starter",
    borderColor: "#17352a",
    backgroundColor: "#c9a45c",
    glowColor: "rgba(201,164,92,0.28)",
  },
  {
    id: "emerald",
    title: "Emerald",
    description: "Groene casino-rand.",
    rarity: "Common",
    priceCoins: 160,
    borderColor: "#1f7a54",
    backgroundColor: "#d9f7e8",
    glowColor: "rgba(31,122,84,0.32)",
  },
  {
    id: "red-velvet",
    title: "Red Velvet",
    description: "Rode rand voor agressieve spelers.",
    rarity: "Rare",
    priceCoins: 240,
    borderColor: "#ef4444",
    backgroundColor: "#fee2e2",
    glowColor: "rgba(239,68,68,0.34)",
  },
  {
    id: "gold",
    title: "Gold Frame",
    description: "Unlock op level 10 of via premium rewards.",
    rarity: "Epic",
    unlockLevel: 10,
    borderColor: "#facc15",
    backgroundColor: "#3b2f16",
    glowColor: "rgba(250,204,21,0.42)",
  },
  {
    id: "midnight",
    title: "Midnight",
    description: "Premium frame met donkere tafelenergie.",
    rarity: "Premium",
    premium: true,
    borderColor: "#818cf8",
    backgroundColor: "#111827",
    glowColor: "rgba(129,140,248,0.38)",
  },
];

export function getAvatarOption(avatarId?: string) {
  return (
    avatarOptions.find((avatar) => avatar.id === avatarId) ?? avatarOptions[0]
  );
}

export function getAvatarFrameOption(frameId?: string) {
  return (
    avatarFrameOptions.find((frame) => frame.id === frameId) ??
    avatarFrameOptions[0]
  );
}
