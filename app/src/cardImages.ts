import { ImageSourcePropType } from "react-native";
import { Card } from "./types";

export function getCardImage(card: Card): ImageSourcePropType {
  if (card.value === "JOKER") {
    return require("../assets/cards/PNG-cards-1.3/red_joker.png");
  }

  const key = `${card.value}_of_${card.suit}`;

  const images: Record<string, ImageSourcePropType> = {
    "A_of_clubs": require("../assets/cards/PNG-cards-1.3/ace_of_clubs.png"),
    "A_of_diamonds": require("../assets/cards/PNG-cards-1.3/ace_of_diamonds.png"),
    "A_of_hearts": require("../assets/cards/PNG-cards-1.3/ace_of_hearts.png"),
    "A_of_spades": require("../assets/cards/PNG-cards-1.3/ace_of_spades.png"),

    "2_of_clubs": require("../assets/cards/PNG-cards-1.3/2_of_clubs.png"),
    "2_of_diamonds": require("../assets/cards/PNG-cards-1.3/2_of_diamonds.png"),
    "2_of_hearts": require("../assets/cards/PNG-cards-1.3/2_of_hearts.png"),
    "2_of_spades": require("../assets/cards/PNG-cards-1.3/2_of_spades.png"),

    "3_of_clubs": require("../assets/cards/PNG-cards-1.3/3_of_clubs.png"),
    "3_of_diamonds": require("../assets/cards/PNG-cards-1.3/3_of_diamonds.png"),
    "3_of_hearts": require("../assets/cards/PNG-cards-1.3/3_of_hearts.png"),
    "3_of_spades": require("../assets/cards/PNG-cards-1.3/3_of_spades.png"),

    "4_of_clubs": require("../assets/cards/PNG-cards-1.3/4_of_clubs.png"),
    "4_of_diamonds": require("../assets/cards/PNG-cards-1.3/4_of_diamonds.png"),
    "4_of_hearts": require("../assets/cards/PNG-cards-1.3/4_of_hearts.png"),
    "4_of_spades": require("../assets/cards/PNG-cards-1.3/4_of_spades.png"),

    "5_of_clubs": require("../assets/cards/PNG-cards-1.3/5_of_clubs.png"),
    "5_of_diamonds": require("../assets/cards/PNG-cards-1.3/5_of_diamonds.png"),
    "5_of_hearts": require("../assets/cards/PNG-cards-1.3/5_of_hearts.png"),
    "5_of_spades": require("../assets/cards/PNG-cards-1.3/5_of_spades.png"),

    "6_of_clubs": require("../assets/cards/PNG-cards-1.3/6_of_clubs.png"),
    "6_of_diamonds": require("../assets/cards/PNG-cards-1.3/6_of_diamonds.png"),
    "6_of_hearts": require("../assets/cards/PNG-cards-1.3/6_of_hearts.png"),
    "6_of_spades": require("../assets/cards/PNG-cards-1.3/6_of_spades.png"),

    "7_of_clubs": require("../assets/cards/PNG-cards-1.3/7_of_clubs.png"),
    "7_of_diamonds": require("../assets/cards/PNG-cards-1.3/7_of_diamonds.png"),
    "7_of_hearts": require("../assets/cards/PNG-cards-1.3/7_of_hearts.png"),
    "7_of_spades": require("../assets/cards/PNG-cards-1.3/7_of_spades.png"),

    "8_of_clubs": require("../assets/cards/PNG-cards-1.3/8_of_clubs.png"),
    "8_of_diamonds": require("../assets/cards/PNG-cards-1.3/8_of_diamonds.png"),
    "8_of_hearts": require("../assets/cards/PNG-cards-1.3/8_of_hearts.png"),
    "8_of_spades": require("../assets/cards/PNG-cards-1.3/8_of_spades.png"),

    "9_of_clubs": require("../assets/cards/PNG-cards-1.3/9_of_clubs.png"),
    "9_of_diamonds": require("../assets/cards/PNG-cards-1.3/9_of_diamonds.png"),
    "9_of_hearts": require("../assets/cards/PNG-cards-1.3/9_of_hearts.png"),
    "9_of_spades": require("../assets/cards/PNG-cards-1.3/9_of_spades.png"),

    "10_of_clubs": require("../assets/cards/PNG-cards-1.3/10_of_clubs.png"),
    "10_of_diamonds": require("../assets/cards/PNG-cards-1.3/10_of_diamonds.png"),
    "10_of_hearts": require("../assets/cards/PNG-cards-1.3/10_of_hearts.png"),
    "10_of_spades": require("../assets/cards/PNG-cards-1.3/10_of_spades.png"),

    "J_of_clubs": require("../assets/cards/PNG-cards-1.3/jack_of_clubs.png"),
    "J_of_diamonds": require("../assets/cards/PNG-cards-1.3/jack_of_diamonds.png"),
    "J_of_hearts": require("../assets/cards/PNG-cards-1.3/jack_of_hearts.png"),
    "J_of_spades": require("../assets/cards/PNG-cards-1.3/jack_of_spades.png"),

    "Q_of_clubs": require("../assets/cards/PNG-cards-1.3/queen_of_clubs.png"),
    "Q_of_diamonds": require("../assets/cards/PNG-cards-1.3/queen_of_diamonds.png"),
    "Q_of_hearts": require("../assets/cards/PNG-cards-1.3/queen_of_hearts.png"),
    "Q_of_spades": require("../assets/cards/PNG-cards-1.3/queen_of_spades.png"),

    "K_of_clubs": require("../assets/cards/PNG-cards-1.3/king_of_clubs.png"),
    "K_of_diamonds": require("../assets/cards/PNG-cards-1.3/king_of_diamonds.png"),
    "K_of_hearts": require("../assets/cards/PNG-cards-1.3/king_of_hearts.png"),
    "K_of_spades": require("../assets/cards/PNG-cards-1.3/king_of_spades.png"),
  };

  return images[key];
}
