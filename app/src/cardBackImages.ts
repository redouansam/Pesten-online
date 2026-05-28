import { ImageSourcePropType } from "react-native";

export type CardBackOption = {
  id: string;
  title: string;
  description: string;
  rarity: "Starter" | "Common" | "Rare" | "Epic" | "Premium";
  image: ImageSourcePropType;
  premium?: boolean;
  priceCoins?: number;
  unlockLevel?: number;
};

export const defaultCardBackId = "classic-blue";
export const starterCardBackIds = [defaultCardBackId];
export const defaultCardBackImage: ImageSourcePropType = require("../assets/card backs/card-back-blue.png");

export const cardBackOptions: CardBackOption[] = [
  {
    id: "classic-blue",
    title: "Classic Blue",
    description: "De standaard online tafel-look.",
    rarity: "Starter",
    image: require("../assets/card backs/card-back-blue.png"),
  },
  {
    id: "classic-red",
    title: "Classic Red",
    description: "Een klassieke rode back voor vaste spelers.",
    rarity: "Rare",
    image: require("../assets/card backs/card-back-red.png"),
    unlockLevel: 5,
  },
  {
    id: "royal-black",
    title: "Royal Black",
    description: "Strak, donker en duidelijk zichtbaar op tafel.",
    rarity: "Common",
    image: require("../assets/card backs/card-back-black.png"),
    priceCoins: 150,
  },
  {
    id: "emerald-table",
    title: "Emerald Table",
    description: "Groene casino-stijl voor een rustige hand.",
    rarity: "Common",
    image: require("../assets/card backs/card-back-green.png"),
    priceCoins: 200,
  },
  {
    id: "sunset-orange",
    title: "Sunset Orange",
    description: "Warme kleur, valt lekker op tussen de stapels.",
    rarity: "Rare",
    image: require("../assets/card backs/card-back-orange.png"),
    priceCoins: 250,
  },
  {
    id: "violet-royal",
    title: "Violet Royal",
    description: "Een premium-feeling paarse back zonder premium pass.",
    rarity: "Rare",
    image: require("../assets/card backs/card-back-purple.png"),
    priceCoins: 300,
  },
  {
    id: "black-gold-stars",
    title: "Black Gold",
    description: "Gouden sterren op zwart, gemaakt voor win streaks.",
    rarity: "Premium",
    image: require("../assets/card backs/black-gold-stars.jpg"),
    premium: true,
  },
  {
    id: "black-sun-hand",
    title: "Sun Hand",
    description: "Mystieke tafelenergie met een luxe occult patroon.",
    rarity: "Premium",
    image: require("../assets/card backs/black-sun-hand.jpg"),
    premium: true,
  },
  {
    id: "blue-moon-star",
    title: "Moon Star",
    description: "Nachtblauw met maanaccenten voor een chique deck.",
    rarity: "Premium",
    image: require("../assets/card backs/blue-moon-star.jpg"),
    premium: true,
  },
  {
    id: "green-circle-pattern",
    title: "Green Pattern",
    description: "Subtiel geometrisch groen, rustig maar niet saai.",
    rarity: "Premium",
    image: require("../assets/card backs/green-circle-pattern.jpg"),
    premium: true,
  },
  {
    id: "mint-radiance",
    title: "Mint Radiance",
    description: "Frisse mint-look met een zachte kaarttafel vibe.",
    rarity: "Premium",
    image: require("../assets/card backs/mint-radiance.jpg"),
    premium: true,
  },
  {
    id: "navy-gold-cubes",
    title: "Navy Cubes",
    description: "Navy met gouden lijnen, strak en premium.",
    rarity: "Premium",
    image: require("../assets/card backs/navy-gold-cubes.jpg"),
    premium: true,
  },
  {
    id: "purple-lattice",
    title: "Purple Lattice",
    description: "Diep paars raster met een echte collector-look.",
    rarity: "Premium",
    image: require("../assets/card backs/purple-lattice.jpg"),
    premium: true,
  },
  {
    id: "purple-moon-sun",
    title: "Moon Phases",
    description: "Maanfases en zonlijnen voor een magische tafel.",
    rarity: "Premium",
    image: require("../assets/card backs/purple-moon-sun.jpg"),
    premium: true,
  },
  {
    id: "rose-cube-pattern",
    title: "Rose Cubes",
    description: "Zachte rose pattern, clean en classy.",
    rarity: "Premium",
    image: require("../assets/card backs/rose-cube-pattern.jpg"),
    premium: true,
  },
  {
    id: "rose-stars",
    title: "Rose Stars",
    description: "Rose sterrenkaart met een zachte vintage sfeer.",
    rarity: "Premium",
    image: require("../assets/card backs/rose-stars.jpg"),
    premium: true,
  },
];

export function getCardBackOption(cardBackId?: string) {
  return (
    cardBackOptions.find((cardBack) => cardBack.id === cardBackId) ??
    cardBackOptions[0]
  );
}

export function getCardBackImage(cardBackId?: string) {
  return getCardBackOption(cardBackId)?.image ?? defaultCardBackImage;
}
