import { ImageSourcePropType } from "react-native";

export type CardBackOption = {
  id: string;
  title: string;
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
    image: require("../assets/card backs/card-back-blue.png"),
  },
  {
    id: "classic-red",
    title: "Classic Red",
    image: require("../assets/card backs/card-back-red.png"),
    unlockLevel: 5,
  },
  {
    id: "royal-black",
    title: "Royal Black",
    image: require("../assets/card backs/card-back-black.png"),
    priceCoins: 150,
  },
  {
    id: "emerald-table",
    title: "Emerald Table",
    image: require("../assets/card backs/card-back-green.png"),
    priceCoins: 200,
  },
  {
    id: "sunset-orange",
    title: "Sunset Orange",
    image: require("../assets/card backs/card-back-orange.png"),
    priceCoins: 250,
  },
  {
    id: "violet-royal",
    title: "Violet Royal",
    image: require("../assets/card backs/card-back-purple.png"),
    priceCoins: 300,
  },
  {
    id: "black-gold-stars",
    title: "Black Gold",
    image: require("../assets/card backs/black-gold-stars.jpg"),
    premium: true,
  },
  {
    id: "black-sun-hand",
    title: "Sun Hand",
    image: require("../assets/card backs/black-sun-hand.jpg"),
    premium: true,
  },
  {
    id: "blue-moon-star",
    title: "Moon Star",
    image: require("../assets/card backs/blue-moon-star.jpg"),
    premium: true,
  },
  {
    id: "green-circle-pattern",
    title: "Green Pattern",
    image: require("../assets/card backs/green-circle-pattern.jpg"),
    premium: true,
  },
  {
    id: "mint-radiance",
    title: "Mint Radiance",
    image: require("../assets/card backs/mint-radiance.jpg"),
    premium: true,
  },
  {
    id: "navy-gold-cubes",
    title: "Navy Cubes",
    image: require("../assets/card backs/navy-gold-cubes.jpg"),
    premium: true,
  },
  {
    id: "purple-lattice",
    title: "Purple Lattice",
    image: require("../assets/card backs/purple-lattice.jpg"),
    premium: true,
  },
  {
    id: "purple-moon-sun",
    title: "Moon Phases",
    image: require("../assets/card backs/purple-moon-sun.jpg"),
    premium: true,
  },
  {
    id: "rose-cube-pattern",
    title: "Rose Cubes",
    image: require("../assets/card backs/rose-cube-pattern.jpg"),
    premium: true,
  },
  {
    id: "rose-stars",
    title: "Rose Stars",
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
