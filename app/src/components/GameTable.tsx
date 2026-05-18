import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ImageSourcePropType,
  StyleProp,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";

import { getCardImage } from "../cardImages";
import {
  suitColors,
  suitLabels,
  suitOptions,
  suitShortLabels,
} from "../constants";
import { getTurnText, isCardPlayable } from "../gameRules";
import type { ConnectionState } from "../hooks/useRoomSocket";
import type { CardSizeSetting, MotionSetting } from "../settings";
import { styles } from "../styles";
import type { TableSkinOption } from "../tableSkins";
import { Card, PublicPlayer, PublicRoomState, Suit } from "../types";

export function GameTable({
  room,
  playerId,
  isYourTurn,
  winnerName,
  drawCards,
  passTurn,
  playCard,
  playAgain,
  leaveRoom,
  connectionState,
  errorMessage,
  clearError,
  retryConnection,
  gems,
  cardBackImage,
  tableSkin,
  hapticsEnabled,
  cardSize,
  motionLevel,
  redrawDrawnCard,
}: {
  room: PublicRoomState;
  playerId: string;
  isYourTurn: boolean;
  winnerName?: string;
  drawCards: () => void;
  passTurn: () => void;
  playCard: (card: Card, chosenSuit?: Suit) => void;
  playAgain: (wantsAgain: boolean) => void;
  leaveRoom: () => void | Promise<void>;
  connectionState: ConnectionState;
  errorMessage: string | null;
  clearError: () => void;
  retryConnection: () => void;
  gems: number;
  cardBackImage: ImageSourcePropType;
  tableSkin: TableSkinOption;
  hapticsEnabled: boolean;
  cardSize: CardSizeSetting;
  motionLevel: MotionSetting;
  redrawDrawnCard: () => void;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [pendingJackCard, setPendingJackCard] = useState<Card | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [cardHint, setCardHint] = useState<string | null>(null);

  const handAnim = useRef(new Animated.Value(1)).current;
  const deckPulseAnim = useRef(new Animated.Value(0)).current;
  const discardAnim = useRef(new Animated.Value(1)).current;
  const invalidShakeAnim = useRef(new Animated.Value(0)).current;
  const wasYourTurnRef = useRef(false);
  const previousHandCountRef = useRef(room.hand.length);
  const previousTopCardIdRef = useRef(room.topCard?.id);
  const autoPassNoGemsRef = useRef(false);

  useEffect(() => {
    if (isYourTurn && !wasYourTurnRef.current && !winnerName) {
      if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    }

    wasYourTurnRef.current = isYourTurn;
  }, [hapticsEnabled, isYourTurn, winnerName]);

  useEffect(() => {
    if (motionLevel === "low") {
      handAnim.setValue(1);
      return;
    }

    handAnim.setValue(0);

    Animated.timing(handAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [handAnim, motionLevel, room.hand.length]);

  useEffect(() => {
    const previousCount = previousHandCountRef.current;

    previousHandCountRef.current = room.hand.length;

    if (room.hand.length <= previousCount || motionLevel === "low") return;

    deckPulseAnim.setValue(0);

    Animated.sequence([
      Animated.timing(deckPulseAnim, {
        toValue: 1,
        duration: 130,
        useNativeDriver: true,
      }),
      Animated.timing(deckPulseAnim, {
        toValue: 0,
        duration: 210,
        useNativeDriver: true,
      }),
    ]).start();
  }, [deckPulseAnim, motionLevel, room.hand.length]);

  useEffect(() => {
    const topCardId = room.topCard?.id;

    if (!topCardId || previousTopCardIdRef.current === topCardId) return;

    previousTopCardIdRef.current = topCardId;

    if (motionLevel === "low") {
      discardAnim.setValue(1);
      return;
    }

    discardAnim.setValue(0);

    Animated.spring(discardAnim, {
      toValue: 1,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [discardAnim, motionLevel, room.topCard?.id]);

  useEffect(() => {
    if (!cardHint) return;

    const timer = setTimeout(() => setCardHint(null), 2200);

    return () => clearTimeout(timer);
  }, [cardHint]);

  useEffect(() => {
    if (
      !isYourTurn ||
      !room.canRedrawDrawnCard ||
      room.winnerId ||
      gems >= room.redrawCostGems
    ) {
      autoPassNoGemsRef.current = false;
      return;
    }

    if (autoPassNoGemsRef.current) return;

    autoPassNoGemsRef.current = true;
    showCardHint("Geen speelbare pakkaart en te weinig gems. Beurt gaat door.");

    const timer = setTimeout(() => {
      passTurn();
    }, 650);

    return () => clearTimeout(timer);
  }, [
    gems,
    isYourTurn,
    passTurn,
    room.canRedrawDrawnCard,
    room.redrawCostGems,
    room.winnerId,
  ]);

  const me = room.players.find((player) => player.id === playerId);
  const others = room.players.filter((player) => player.id !== playerId);
  const sortedHand = useMemo(
    () => [...room.hand].sort(compareCardsBySymbol),
    [room.hand]
  );

  const currentPlayer = room.players.find(
    (player) => player.id === room.currentPlayerId
  );

  const handLayout = useMemo(() => {
    const maxGameWidth = Math.min(screenWidth, 560);
    const handAreaWidth = Math.max(280, maxGameWidth - 58);
    const cardCount = Math.max(sortedHand.length, 1);
    const sizeScale =
      cardSize === "compact" ? 0.88 : cardSize === "large" ? 1.12 : 1;
    const baseCardWidth =
      Math.min(102, Math.max(74, maxGameWidth * 0.2)) * sizeScale;
    const denseCardWidth =
      cardCount > 17
        ? 62
        : cardCount > 13
        ? 70
        : cardCount > 10
        ? 80
        : baseCardWidth;
    const cardWidth = Math.min(baseCardWidth, denseCardWidth);
    const cardHeight = cardWidth * 1.42;
    const cardStep =
      cardCount > 1
        ? Math.max(
            4,
            Math.min(
              cardWidth * 0.48,
              (handAreaWidth - cardWidth) / (cardCount - 1)
            )
          )
        : 0;
    const fanWidth = cardWidth + cardStep * (cardCount - 1);

    return {
      cardWidth,
      cardHeight,
      fanWidth,
      cardStep,
      angleStep: cardCount > 1 ? Math.min(1.2, 8 / cardCount) : 0,
      handHeight: cardHeight + 36,
    };
  }, [cardSize, screenWidth, sortedHand.length]);

  const opponentLayout =
    others.length <= 1
      ? styles.opponentSeatSingle
      : others.length === 2
      ? styles.opponentSeatDouble
      : styles.opponentSeatTriple;
  const compactTable =
    screenHeight < 780 || screenWidth < 460 || others.length >= 3;
  const hideOpponentStacks = screenWidth < 460 && others.length >= 3;

  const playableCardsCount = room.hand.filter(
    (card) => isYourTurn && !room.winnerId && isCardPlayable(room, card)
  ).length;
  const turnCoachText = getTurnCoachText({
    room,
    isYourTurn,
    currentPlayerName: currentPlayer?.name,
    playableCardsCount,
    winnerName,
  });

  function showCardHint(message: string) {
    setCardHint(message);
    invalidShakeAnim.setValue(0);

    if (motionLevel === "low") return;

    Animated.sequence([
      Animated.timing(invalidShakeAnim, {
        toValue: 1,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(invalidShakeAnim, {
        toValue: -1,
        duration: 85,
        useNativeDriver: true,
      }),
      Animated.timing(invalidShakeAnim, {
        toValue: 0,
        duration: 75,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function handleCardPress(card: Card) {
    if (room.winnerId) return;

    if (!isYourTurn) {
      showCardHint("Wacht tot jij aan de beurt bent.");
      return;
    }

    if (!isCardPlayable(room, card)) {
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {}
        );
      }
      showCardHint("Deze kaart mag nu niet op de stapel.");
      return;
    }

    if (card.value === "J") {
      setPendingJackCard(card);
      return;
    }

    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    playCard(card);
  }

  function handleRedrawDrawnCard() {
    if (!room.canRedrawDrawnCard) return;

    if (gems < room.redrawCostGems) {
      showCardHint("Niet genoeg gems. Je beurt wordt gepast.");
      passTurn();
      return;
    }

    redrawDrawnCard();
  }

  function chooseSuitForJack(suit: Suit) {
    if (!pendingJackCard) return;

    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    playCard(pendingJackCard, suit);
    setPendingJackCard(null);
  }

  return (
    <View style={styles.gameContainer}>
      <View style={styles.gameTopBar}>
        <View style={styles.gameInfoPill}>
          <Text style={styles.gameInfoLabel}>Kamer</Text>
          <Text style={styles.gameInfoValue}>{room.code}</Text>
        </View>

        <View
          style={[
            styles.turnBanner,
            isYourTurn && !winnerName ? styles.turnBannerActive : null,
          ]}
        >
          <Text style={styles.turnBannerText}>
            {winnerName
              ? `${winnerName} wint`
              : isYourTurn
              ? getTurnText(room)
              : `${currentPlayer?.name ?? "Speler"} is aan de beurt`}
          </Text>
        </View>

        <Pressable style={styles.exitMiniButton} onPress={leaveRoom}>
          <Text style={styles.exitMiniText}>Exit</Text>
        </Pressable>
      </View>

      {connectionState !== "online" || errorMessage ? (
        <Pressable
          style={styles.gameConnectionBanner}
          onPress={errorMessage ? clearError : retryConnection}
        >
          <Text style={styles.gameConnectionText} numberOfLines={1}>
            {errorMessage ??
              (connectionState === "reconnecting"
                ? "Opnieuw verbinden..."
                : connectionState === "connecting"
                ? "Verbinden..."
                : "Offline - tik om opnieuw te verbinden")}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.tableWrapper}>
        <LinearGradient
          colors={tableSkin.railColors}
          style={styles.woodTable}
        >
          <View style={styles.tableShadow}>
            <LinearGradient
              colors={tableSkin.feltColors}
              style={[
                styles.greenTable,
                {
                  borderColor: tableSkin.accentColor,
                },
              ]}
            >
              <View pointerEvents="none" style={styles.tableGlow} />
              <View pointerEvents="none" style={styles.tableInnerLine} />

              <View
                style={[
                  styles.opponentRail,
                  compactTable && styles.opponentRailCompact,
                ]}
              >
                {others.map((player) => (
                  <OpponentSeat
                    key={player.id}
                    player={player}
                    isCurrent={player.id === room.currentPlayerId}
                    compact={compactTable}
                    layoutStyle={opponentLayout}
                    hideStack={hideOpponentStacks}
                    cardBackImage={cardBackImage}
                  />
                ))}
              </View>

              <View
                style={[
                  styles.tableCenterZone,
                  compactTable && styles.tableCenterZoneCompact,
                ]}
              >
                <View
                  style={[
                    styles.pileStage,
                    draggingCardId && styles.pileStageActive,
                    compactTable && styles.pileStageCompact,
                  ]}
                >
                  {draggingCardId ? (
                    <View style={styles.tableDropHint}>
                      <Text style={styles.tableDropHintText}>
                        Laat los om te spelen
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.pileSlot}>
                    <Animated.View
                      style={{
                        transform: [
                          {
                            scale: deckPulseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 0.94],
                            }),
                          },
                        ],
                      }}
                    >
                      <Pressable
                        style={[
                          styles.deckCard,
                          room.canDraw && isYourTurn && styles.deckCardReady,
                          compactTable && styles.deckCardCompact,
                          !room.canDraw && styles.disabledDeck,
                        ]}
                        onPress={drawCards}
                        disabled={!room.canDraw}
                      >
                        <Image
                          source={cardBackImage}
                          style={[
                            styles.deckBackImage,
                            compactTable && styles.deckBackImageCompact,
                          ]}
                          resizeMode="cover"
                        />
                        <Text style={styles.deckLabel}>
                          {room.pendingDraw > 0
                            ? `Pak ${room.pendingDraw}`
                            : "Pak"}
                        </Text>
                      </Pressable>
                    </Animated.View>
                    <Text style={styles.pileCaption}>Trekstapel</Text>
                  </View>

                  <View
                    style={[
                      styles.pileDivider,
                      compactTable && styles.pileDividerCompact,
                    ]}
                  />

                  <View style={styles.pileSlot}>
                    <Animated.View
                      style={[
                        styles.discardCard,
                        compactTable && styles.discardCardCompact,
                        {
                          opacity: discardAnim,
                          transform: [
                            {
                              translateY: discardAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-18, 0],
                              }),
                            },
                            {
                              scale: discardAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.84, 1],
                              }),
                            },
                            {
                              rotate: discardAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ["-6deg", "0deg"],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      {room.topCard ? (
                        <Image
                          source={getCardImage(room.topCard)}
                          style={[
                            styles.tableCardImage,
                            compactTable && styles.tableCardImageCompact,
                          ]}
                          resizeMode="contain"
                        />
                      ) : null}
                    </Animated.View>
                    <Text style={styles.pileCaption}>Op tafel</Text>
                  </View>
                </View>
              </View>

              <View style={styles.tableHud}>
                <View style={styles.tableHudPill}>
                  <Text style={styles.directionText}>
                    {room.direction === 1 ? "Mee" : "Terug"}
                  </Text>
                </View>

                <View style={styles.tableHudStatus}>
                  <Text style={styles.statusInfoText} numberOfLines={1}>
                    {room.lastMessage
                      ? room.lastMessage
                      : room.chosenSuit
                      ? suitLabels[room.chosenSuit]
                      : room.sevenSuit
                      ? `7-reeks: ${suitLabels[room.sevenSuit]}`
                      : "Open tafel"}
                  </Text>
                </View>

                {room.pendingDraw > 0 ? (
                  <View style={styles.penaltyBubble}>
                    <Text style={styles.penaltyBubbleText}>
                      +{room.pendingDraw}
                    </Text>
                  </View>
                ) : null}
              </View>

              {winnerName ? (
                <View style={styles.winRibbon}>
                  <Text style={styles.winRibbonText}>
                    {winnerName} is alle kaarten kwijt!
                  </Text>
                </View>
              ) : null}
            </LinearGradient>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.playerControlRow}>
          <View style={styles.meAvatar}>
            <Text style={styles.meAvatarText}>
              {(me?.name ?? "J").slice(0, 1).toUpperCase()}
            </Text>
          </View>

          <View style={styles.meInfo}>
            <Text style={styles.meName}>{me?.name ?? "Jij"}</Text>
            <Text style={styles.meSub}>
              {room.hand.length} kaarten - {isYourTurn ? "beurt" : "wacht"}
            </Text>
          </View>

          <View style={styles.actionButtons}>
            {room.canRedrawDrawnCard ? (
              <Pressable
                style={[
                  styles.redrawButton,
                  gems < room.redrawCostGems && styles.disabledButton,
                ]}
                onPress={handleRedrawDrawnCard}
              >
                <Text style={styles.redrawButtonText}>Nieuw</Text>
                <Text style={styles.redrawButtonSub}>
                  {room.redrawCostGems} gems
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[
                styles.actionButton,
                room.canDraw && isYourTurn && styles.actionButtonReady,
                !room.canDraw && styles.disabledButton,
              ]}
              onPress={drawCards}
              disabled={!room.canDraw}
            >
              <Text style={styles.actionButtonText}>
                {room.pendingDraw > 0 ? `Pak ${room.pendingDraw}` : "Pak"}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.passButton,
                room.canPass && isYourTurn && styles.passButtonReady,
                !room.canPass && styles.disabledButton,
              ]}
              onPress={passTurn}
              disabled={!room.canPass}
            >
              <Text style={styles.passButtonText}>Pas</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.handToolbar}>
          <Text style={styles.handTitle}>Hand</Text>

          <View style={styles.handToolbarRight}>
            <Text style={styles.handSortLabel}>Symbool</Text>
            <Text style={styles.handMeta}>
              {isYourTurn
                ? `${playableCardsCount} speelbaar`
                : "wacht"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.turnCoach,
            isYourTurn && styles.turnCoachActive,
            cardHint && styles.turnCoachWarning,
          ]}
        >
          <Text
            style={[
              styles.turnCoachText,
              cardHint && styles.turnCoachTextWarning,
            ]}
          >
            {cardHint ?? turnCoachText}
          </Text>
        </View>

        <View style={styles.handArea}>
          <View style={styles.handFanViewport}>
            <Animated.View
              style={[
                styles.handFan,
                {
                  width: handLayout.fanWidth,
                  height: handLayout.handHeight,
                  opacity: handAnim,
                  transform: [
                    {
                      translateX: invalidShakeAnim.interpolate({
                        inputRange: [-1, 0, 1],
                        outputRange: [-8, 0, 8],
                      }),
                    },
                    {
                      translateY: handAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [14, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {sortedHand.map((card, index) => {
                const playable =
                  isYourTurn && !room.winnerId && isCardPlayable(room, card);
                const centerIndex = (sortedHand.length - 1) / 2;
                const distanceFromCenter = index - centerIndex;
                const fanAngle = distanceFromCenter * handLayout.angleStep;

                return (
                  <HandCard
                    key={card.id}
                    card={card}
                    index={index}
                    playable={playable}
                    layout={handLayout}
                    fanAngle={fanAngle}
                    isDragging={draggingCardId === card.id}
                    hapticsEnabled={hapticsEnabled}
                    motionLevel={motionLevel}
                    onPress={handleCardPress}
                    onDragStart={() => setDraggingCardId(card.id)}
                    onDragEnd={() => setDraggingCardId(null)}
                  />
                );
              })}
            </Animated.View>
          </View>
        </View>
      </View>

      <Modal visible={Boolean(pendingJackCard)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Kies een symbool</Text>

            <Text style={styles.modalText}>
              Boer gespeeld.
            </Text>

            <View style={styles.modalSuitGrid}>
              {suitOptions.map((suit) => (
                <Pressable
                  key={suit}
                  style={styles.modalSuitButton}
                  onPress={() => chooseSuitForJack(suit)}
                >
                  <Text
                    style={[
                      styles.modalSuitIcon,
                      {
                        color: suitColors[suit],
                      },
                    ]}
                  >
                    {suitShortLabels[suit]}
                  </Text>

                  <Text style={styles.modalSuitText}>{suitLabels[suit]}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={styles.cancelButton}
              onPress={() => setPendingJackCard(null)}
            >
              <Text style={styles.cancelButtonText}>Annuleren</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(winnerName)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.winnerHero}>
              <Text style={styles.winnerHeroEyebrow}>Winnaar</Text>
              <Text style={styles.winnerHeroTitle}>{winnerName}</Text>
              <Text style={styles.winnerHeroText}>
                Beloningen bijgewerkt.
              </Text>
            </View>

            <Text style={styles.modalText}>
              Nog een potje?
            </Text>

            <Pressable
              style={styles.modalYesButton}
              onPress={() => playAgain(true)}
            >
              <Text style={styles.modalYesButtonText}>Opnieuw</Text>
            </Pressable>

            <Pressable style={styles.cancelButton} onPress={() => playAgain(false)}>
              <Text style={styles.cancelButtonText}>Lobby</Text>
            </Pressable>

            <Text style={styles.voteText}>
              Stemmen:{" "}
              {room.players.filter((player) => room.rematchVotes[player.id])
                .length}
              /{room.players.filter((player) => player.connected).length}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type HandLayout = {
  cardWidth: number;
  cardHeight: number;
  fanWidth: number;
  cardStep: number;
  angleStep: number;
  handHeight: number;
};

const symbolSortOrder: Record<Suit, number> = {
  hearts: 0,
  diamonds: 1,
  clubs: 2,
  spades: 3,
};

const valueSortOrder: Record<Card["value"], number> = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  JOKER: 14,
};

function compareCardsBySymbol(cardA: Card, cardB: Card) {
  const symbolDiff =
    (cardA.suit ? symbolSortOrder[cardA.suit] : 99) -
    (cardB.suit ? symbolSortOrder[cardB.suit] : 99);

  if (symbolDiff !== 0) return symbolDiff;

  return valueSortOrder[cardA.value] - valueSortOrder[cardB.value];
}

function getTurnCoachText({
  room,
  isYourTurn,
  currentPlayerName,
  playableCardsCount,
  winnerName,
}: {
  room: PublicRoomState;
  isYourTurn: boolean;
  currentPlayerName?: string;
  playableCardsCount: number;
  winnerName?: string;
}) {
  if (winnerName) {
    return `${winnerName} wint.`;
  }

  if (!isYourTurn) {
    return `${currentPlayerName ?? "Speler"} is bezig.`;
  }

  if (room.pendingDraw > 0) {
    return `+${room.pendingDraw} pakken of stapelen.`;
  }

  if (room.turnState === "after_draw") {
    if (room.canRedrawDrawnCard) {
      return `Nieuwe kaart: ${room.redrawCostGems} gems of pas.`;
    }

    return room.canPass
      ? "Speel of pas."
      : "Leg je pakkaart.";
  }

  if (room.turnState === "seven_chain") {
    return "7-reeks: zelfde symbool of 7.";
  }

  if (playableCardsCount > 0) {
    return "Tik of sleep speelbaar.";
  }

  if (room.canDraw) {
    return "Pak een kaart.";
  }

  if (room.canPass) {
    return "Passen mag.";
  }

  return "Even wachten.";
}

function HandCard({
  card,
  index,
  playable,
  layout,
  fanAngle,
  isDragging,
  hapticsEnabled,
  motionLevel,
  onPress,
  onDragStart,
  onDragEnd,
}: {
  card: Card;
  index: number;
  playable: boolean;
  layout: HandLayout;
  fanAngle: number;
  isDragging: boolean;
  hapticsEnabled: boolean;
  motionLevel: MotionSetting;
  onPress: (card: Card) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const entryAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (motionLevel === "low") {
      entryAnim.setValue(1);
      return;
    }

    entryAnim.setValue(0);

    Animated.spring(entryAnim, {
      toValue: 1,
      friction: 8,
      tension: 95,
      useNativeDriver: true,
    }).start();
  }, [card.id, entryAnim, motionLevel]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          playable &&
          Math.abs(gesture.dy) > 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 0.45,
        onPanResponderGrant: () => {
          onDragStart();
          if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gesture) => {
          if (playable && gesture.dy < -64) {
            if (hapticsEnabled) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => {}
              );
            }

            Animated.timing(pan, {
              toValue: {
                x: gesture.dx * 0.25,
                y: -190,
              },
              duration: 150,
              useNativeDriver: true,
            }).start(() => {
              pan.setValue({ x: 0, y: 0 });
              onDragEnd();
              onPress(card);
            });

            return;
          }

          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            tension: 95,
            useNativeDriver: true,
          }).start(onDragEnd);
        },
        onPanResponderTerminate: () => {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            tension: 95,
            useNativeDriver: true,
          }).start(onDragEnd);
        },
      }),
    [card, hapticsEnabled, onDragEnd, onDragStart, onPress, pan, playable]
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.handCardButton,
        playable ? styles.playableCard : styles.notPlayableCard,
        isDragging && styles.draggingCard,
        {
          width: layout.cardWidth,
          height: layout.cardHeight,
          marginLeft: index === 0 ? 0 : layout.cardStep - layout.cardWidth,
          zIndex: isDragging ? 300 : playable ? 100 + index : index,
          opacity: entryAnim,
          transform: [
            {
              translateY: entryAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
            { translateX: pan.x },
            { translateY: playable ? -10 : 0 },
            { translateY: pan.y },
            { rotate: `${fanAngle}deg` },
            { scale: playable ? 1.04 : 1 },
          ],
        },
      ]}
    >
      <Pressable hitSlop={8} onPress={() => onPress(card)}>
        {playable ? (
          <View style={styles.playablePip}>
            <Text style={styles.playablePipText}>OK</Text>
          </View>
        ) : null}

        <Image
          source={getCardImage(card)}
          style={{
            width: layout.cardWidth,
            height: layout.cardHeight,
          }}
          resizeMode="contain"
        />
      </Pressable>
    </Animated.View>
  );
}

function OpponentSeat({
  player,
  isCurrent,
  compact,
  layoutStyle,
  hideStack,
  cardBackImage,
}: {
  player: PublicPlayer;
  isCurrent: boolean;
  compact: boolean;
  layoutStyle: StyleProp<ViewStyle>;
  hideStack: boolean;
  cardBackImage: ImageSourcePropType;
}) {
  return (
    <View
      style={[
        styles.opponentSeat,
        layoutStyle,
        compact && styles.opponentSeatCompact,
        isCurrent && styles.activeSeat,
        !player.connected && styles.offlineSeat,
      ]}
    >
      {isCurrent ? (
        <View style={styles.nowBadge}>
          <Text style={styles.nowBadgeText}>NU</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.playerAvatar,
          compact && styles.playerAvatarCompact,
          !player.connected && styles.playerAvatarOffline,
        ]}
      >
        <Text
          style={[
            styles.playerAvatarText,
            compact && styles.playerAvatarTextCompact,
          ]}
        >
          {player.name.slice(0, 1).toUpperCase()}
        </Text>
      </View>

      <View style={styles.opponentSeatMain}>
        <Text
          style={[
            styles.playerSeatName,
            compact && styles.playerSeatNameCompact,
          ]}
          numberOfLines={1}
        >
          {player.name}
        </Text>
        <Text
          style={[
            styles.playerSeatCards,
            compact && styles.playerSeatCardsCompact,
          ]}
        >
          {player.cardCount} kaarten
        </Text>
      </View>

      {player.cardCount === 1 ? (
        <View style={styles.oneCardBadge}>
          <Text style={styles.oneCardBadgeText}>Nog 1!</Text>
        </View>
      ) : null}

      {!hideStack ? (
        <View style={[styles.backCards, compact && styles.backCardsCompact]}>
          <Image
            source={cardBackImage}
            style={[
              styles.smallBackCard,
              compact && styles.smallBackCardCompact,
            ]}
            resizeMode="cover"
          />
          <Image
            source={cardBackImage}
            style={[
              styles.smallBackCard,
              styles.smallBackCardTwo,
              compact && styles.smallBackCardCompact,
            ]}
            resizeMode="cover"
          />
          <Image
            source={cardBackImage}
            style={[
              styles.smallBackCard,
              styles.smallBackCardThree,
              compact && styles.smallBackCardCompact,
            ]}
            resizeMode="cover"
          />
        </View>
      ) : null}
    </View>
  );
}
