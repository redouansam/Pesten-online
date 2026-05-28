import { Card, PublicRoomState } from "./types";

export function getTurnText(room: PublicRoomState) {
  if (room.pendingDraw > 0) {
    return `Pak +${room.pendingDraw} of stapel`;
  }

  if (room.turnState === "after_draw") {
    return "Leg een kaart of pas";
  }

  if (room.turnState === "must_play") {
    return room.canDraw ? "Heer: pak 1 kaart" : "Heer: leg nog een kaart";
  }

  if (room.turnState === "seven_chain") {
    if (room.sevenStopAfterNext) {
      return room.canDraw
        ? "Heer in 7: pak 1 kaart"
        : "Heer in 7: leg nog een kaart";
    }

    return "7 actief: zelfde symbool, 7 of afsluiten met dezelfde waarde";
  }

  return "Jij bent aan de beurt";
}

export function isCardPlayable(room: PublicRoomState, card: Card) {
  const topCard = room.topCard;

  if (!topCard) return true;

  if (room.turnState === "seven_chain") {
    if (room.sevenStopAfterNext) {
      return isNormalTurnCardPlayable(room, card);
    }

    if (card.suit === room.sevenSuit) return true;
    if (card.value === "7" && topCard.value === "7") return true;

    if (!room.sevenSuit) return false;

    const stillHasSevenSuit = room.hand.some(
      (item) => item.id !== card.id && item.suit === room.sevenSuit
    );
    const stillHasPlayableSeven = room.hand.some(
      (item) =>
        item.id !== card.id &&
        item.value === "7" &&
        (item.suit === room.sevenSuit || topCard.value === "7")
    );

    return (
      !stillHasSevenSuit &&
      !stillHasPlayableSeven &&
      card.value === topCard.value
    );
  }

  return isNormalTurnCardPlayable(room, card);
}

function isNormalTurnCardPlayable(room: PublicRoomState, card: Card) {
  const topCard = room.topCard;

  if (!topCard) return true;

  if (room.pendingDraw > 0) {
    return card.value === "2" || card.value === "JOKER";
  }

  if (topCard.value === "JOKER") {
    return true;
  }

  if (card.value === "JOKER") return true;

  const activeSuit = room.chosenSuit ?? topCard.suit;

  if (card.value === "J") {
    return (
      topCard.value === "J" ||
      Boolean(card.suit && activeSuit && card.suit === activeSuit)
    );
  }

  return card.value === topCard.value || card.suit === activeSuit;
}
