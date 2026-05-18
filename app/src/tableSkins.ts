export type TableSkinOption = {
  id: string;
  title: string;
  rarity: "Starter" | "Common" | "Rare" | "Epic" | "Premium";
  priceCoins?: number;
  premium?: boolean;
  feltColors: [string, string, string];
  railColors: [string, string, string];
  accentColor: string;
};

export const defaultTableSkinId = "royal-green";
export const starterTableSkinIds = [defaultTableSkinId];

export const tableSkinOptions: TableSkinOption[] = [
  {
    id: "royal-green",
    title: "Royal Green",
    rarity: "Starter",
    feltColors: ["#0f704a", "#0a4c35", "#06291f"],
    railColors: ["#4a3324", "#1d1510", "#4a3324"],
    accentColor: "#c9a45c",
  },
  {
    id: "dark-casino",
    title: "Dark Casino",
    rarity: "Common",
    priceCoins: 180,
    feltColors: ["#16413b", "#0c2928", "#041716"],
    railColors: ["#2e261d", "#0e0b08", "#3a2d20"],
    accentColor: "#8fc9a6",
  },
  {
    id: "red-velvet",
    title: "Red Velvet",
    rarity: "Rare",
    priceCoins: 260,
    feltColors: ["#7f1d1d", "#451313", "#210809"],
    railColors: ["#5f3828", "#24110d", "#6b3b2b"],
    accentColor: "#f4c36b",
  },
  {
    id: "gold-table",
    title: "Gold Table",
    rarity: "Epic",
    priceCoins: 420,
    feltColors: ["#7a531c", "#4a2f0d", "#1d1305"],
    railColors: ["#6f4e27", "#241708", "#8c6b33"],
    accentColor: "#facc15",
  },
  {
    id: "midnight-premium",
    title: "Midnight",
    rarity: "Premium",
    premium: true,
    feltColors: ["#16213f", "#0b1228", "#030712"],
    railColors: ["#312e81", "#111827", "#4338ca"],
    accentColor: "#c4b5fd",
  },
];

export function getTableSkinOption(tableSkinId?: string) {
  return (
    tableSkinOptions.find((tableSkin) => tableSkin.id === tableSkinId) ??
    tableSkinOptions[0]
  );
}
