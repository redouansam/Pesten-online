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
import { GameButton, GameModalFrame } from "./GameChrome";
import type { ConnectionState } from "../hooks/useRoomSocket";
import type { CardSizeSetting, MotionSetting } from "../settings";
import { playGameSound } from "../soundFeedback";
import { styles } from "../styles";
import type { TableSkinOption } from "../tableSkins";
import type { AvatarFrameOption, AvatarOption } from "../cosmetics";
import { Card, PublicPlayer, PublicRoomState, Suit } from "../types";

type HandSortMode = "suit" | "value";

export function GameTable({
  room,
  playerId,
  isYourTurn,
  winnerName,
  loserName,
  finishRewards,
  drawCards,
  passTurn,
  playCard,
  playAgain,
  leaveRoom,
  connectionState,
  errorMessage,
  pendingAction,
  clearError,
  retryConnection,
  gems,
  cardBackImage,
  tableSkin,
  avatar,
  avatarFrame,
  hapticsEnabled,
  cardSize,
  motionLevel,
  redrawDrawnCard,
  sortHand,
}: {
  room: PublicRoomState;
  playerId: string;
  isYourTurn: boolean;
  winnerName?: string;
  loserName?: string;
  finishRewards?: {
    coins: number;
    xp: number;
    didWin: boolean;
    resultLabel: string;
    missionText: string;
  };
  drawCards: () => void;
  passTurn: () => void;
  playCard: (card: Card, chosenSuit?: Suit) => void;
  playAgain: (wantsAgain: boolean) => void;
  leaveRoom: () => void | Promise<void>;
  connectionState: ConnectionState;
  errorMessage: string | null;
  pendingAction: string | null;
  clearError: () => void;
  retryConnection: () => void;
  gems: number;
  cardBackImage: ImageSourcePropType;
  tableSkin: TableSkinOption;
  avatar: AvatarOption;
  avatarFrame: AvatarFrameOption;
  hapticsEnabled: boolean;
  cardSize: CardSizeSetting;
  motionLevel: MotionSetting;
  redrawDrawnCard: () => void;
  sortHand: (mode: HandSortMode) => void;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [pendingJackCard, setPendingJackCard] = useState<Card | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardHint, setCardHint] = useState<string | null>(null);
  const [handSortMode, setHandSortMode] = useState<HandSortMode>("suit");

  const handAnim = useRef(new Animated.Value(1)).current;
  const deckPulseAnim = useRef(new Animated.Value(0)).current;
  const discardAnim = useRef(new Animated.Value(1)).current;
  const invalidShakeAnim = useRef(new Animated.Value(0)).current;
  const turnPulseAnim = useRef(new Animated.Value(0)).current;
  const finishRevealAnim = useRef(new Animated.Value(1)).current;
  const wasYourTurnRef = useRef(false);
  const finishHapticRoundRef = useRef<number | null>(null);
  const previousHandCountRef = useRef(room.hand.length);
  const previousTopCardIdRef = useRef(room.topCard?.id);
  const roundFinished = room.turnState === "finished";

  useEffect(() => {
    if (isYourTurn && !wasYourTurnRef.current && !winnerName) {
      if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    }

    wasYourTurnRef.current = isYourTurn;
  }, [hapticsEnabled, isYourTurn, winnerName]);

  useEffect(() => {
    if (!isYourTurn || winnerName || motionLevel === "low") {
      turnPulseAnim.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(turnPulseAnim, {
          toValue: 1,
          duration: 820,
          useNativeDriver: true,
        }),
        Animated.timing(turnPulseAnim, {
          toValue: 0,
          duration: 820,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [isYourTurn, motionLevel, turnPulseAnim, winnerName]);

  useEffect(() => {
    setSelectedCardId((currentSelectedCardId) => {
      if (!currentSelectedCardId || !isYourTurn || roundFinished) return null;

      const selectedCard = room.hand.find(
        (card) => card.id === currentSelectedCardId
      );

      return selectedCard && isCardPlayable(room, selectedCard)
        ? currentSelectedCardId
        : null;
    });
  }, [
    isYourTurn,
    room.chosenSuit,
    room.currentPlayerId,
    room.hand,
    room.pendingDraw,
    room.sevenStopAfterNext,
    room.sevenSuit,
    room.topCard?.id,
    room.turnState,
    roundFinished,
  ]);

  useEffect(() => {
    if (!winnerName) {
      finishRevealAnim.setValue(0);
      return;
    }

    if (finishHapticRoundRef.current !== room.roundId) {
      finishHapticRoundRef.current = room.roundId;
      playGameSound("win");

      if (hapticsEnabled) {
        Haptics.notificationAsync(
          finishRewards?.didWin
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning
        ).catch(() => {});
      }
    }

    if (motionLevel === "low") {
      finishRevealAnim.setValue(1);
      return;
    }

    finishRevealAnim.setValue(0);

    Animated.spring(finishRevealAnim, {
      toValue: 1,
      friction: 8,
      tension: 88,
      useNativeDriver: true,
    }).start();
  }, [
    finishRevealAnim,
    finishRewards?.didWin,
    hapticsEnabled,
    motionLevel,
    room.roundId,
    winnerName,
  ]);

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

  const me = room.players.find((player) => player.id === playerId);
  const others = room.players.filter((player) => player.id !== playerId);
  const isWaitingForNextRound = Boolean(me?.waitingForNextRound);
  const finishedThisRound = Boolean(me?.finished);
  const sortedHand = useMemo(
    () =>
      [...room.hand].sort(
        handSortMode === "value" ? compareCardsByValue : compareCardsBySymbol
      ),
    [handSortMode, room.hand]
  );
  const selectedCard = selectedCardId
    ? sortedHand.find((card) => card.id === selectedCardId)
    : undefined;
  const selectedCardPlayable = Boolean(
    selectedCard &&
      isYourTurn &&
      !roundFinished &&
      isCardPlayable(room, selectedCard)
  );

  const currentPlayer = room.players.find(
    (player) => player.id === room.currentPlayerId
  );
  const endRanking = useMemo(() => getEndRanking(room), [room]);
  const compactControls = screenWidth < 390 || screenHeight < 720;
  const rematchPending = pendingAction === "rematch";
  const redrawBusy = pendingAction === "redraw";
  const canAffordRedraw = gems >= room.redrawCostGems;

  const handLayout = useMemo(() => {
    const maxGameWidth = Math.min(screenWidth, 560);
    const handAreaWidth = Math.max(
      compactControls ? 226 : 260,
      maxGameWidth - (compactControls ? 72 : 84)
    );
    const cardCount = Math.max(sortedHand.length, 1);
    const sizeScale =
      cardSize === "compact" ? 0.88 : cardSize === "large" ? 1.12 : 1;
    const baseCardWidth =
      Math.min(
        compactControls ? 92 : 102,
        Math.max(compactControls ? 64 : 74, maxGameWidth * 0.2)
      ) * sizeScale;
    const denseCardWidth =
      cardCount > 22
        ? 54
        : cardCount > 17
        ? 58
        : cardCount > 13
        ? 66
        : cardCount > 10
        ? 76
        : baseCardWidth;
    const cardWidth = Math.min(baseCardWidth, denseCardWidth);
    const cardHeight = cardWidth * 1.42;
    const cardStep =
      cardCount > 1
        ? Math.max(
            3,
            Math.min(
              cardWidth * (compactControls ? 0.36 : 0.42),
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
      angleStep:
        cardCount > 1 ? Math.min(compactControls ? 0.55 : 0.85, 6 / cardCount) : 0,
      handHeight: cardHeight + (compactControls ? 22 : 32),
    };
  }, [cardSize, compactControls, screenWidth, sortedHand.length]);

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
    (card) => isYourTurn && !roundFinished && isCardPlayable(room, card)
  ).length;
  const ruleBadges = useMemo(() => getRuleBadges(room), [room]);
  const ruleBanners = useMemo(
    () => getRuleBanners(room, connectionState),
    [connectionState, room]
  );
  const showRuleBadges = ruleBanners.length === 0;
  const topTurnText = getTopTurnText({
    room,
    currentPlayerName: currentPlayer?.name,
    currentPlayerIsBot: Boolean(currentPlayer?.isBot),
    isWaitingForNextRound,
    isYourTurn,
    winnerName,
  });
  const turnCoachText = getTurnCoachText({
    room,
    isYourTurn,
    currentPlayerName: currentPlayer?.name,
    currentPlayerIsBot: Boolean(currentPlayer?.isBot),
    playableCardsCount,
    selectedCardName: selectedCard ? getCardDisplayName(selectedCard) : undefined,
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
    if (roundFinished) return;

    if (!isYourTurn) {
      playGameSound("invalid");
      showCardHint("Wacht tot jij aan de beurt bent.");
      return;
    }

    if (!isCardPlayable(room, card)) {
      playGameSound("invalid");
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {}
        );
      }
      showCardHint(`Ongeldige kaart. ${getInvalidCardHint(room)}`);
      return;
    }

    if (selectedCardId === card.id) {
      playPlayableCard(card);
      return;
    }

    setSelectedCardId(card.id);
    playGameSound("card_select");

    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    showCardHint(`${getCardDisplayName(card)} geselecteerd. Tik Speel of tik nogmaals.`);
  }

  function handlePlaySelectedCard() {
    if (!selectedCard) {
      showCardHint("Kies eerst een speelbare kaart.");
      return;
    }

    if (!selectedCardPlayable) {
      playGameSound("invalid");
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {}
        );
      }
      showCardHint(`Ongeldige kaart. ${getInvalidCardHint(room)}`);
      return;
    }

    playPlayableCard(selectedCard);
  }

  function playPlayableCard(card: Card) {
    if (room.hand.length === 1 && isPestCard(card)) {
      playGameSound("invalid");
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
          () => {}
        );
      }
      showCardHint("Je mag niet eindigen met een pestkaart. Je pakt 2 strafkaarten.");
    }

    if (card.value === "J") {
      setPendingJackCard(card);
      return;
    }

    playGameSound("card_play");
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    setSelectedCardId(null);
    playCard(card);
  }

  function handleRedrawDrawnCard() {
    if (!room.canRedrawDrawnCard || redrawBusy) return;

    if (!canAffordRedraw) {
      showCardHint(`Niet genoeg gems. Je hebt ${room.redrawCostGems} gems nodig.`);
      return;
    }

    redrawDrawnCard();
  }

  function handleDrawCards() {
    playGameSound("draw");
    drawCards();
  }

  function chooseSuitForJack(suit: Suit) {
    if (!pendingJackCard) return;

    playGameSound("card_play");
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    playCard(pendingJackCard, suit);
    setPendingJackCard(null);
    setSelectedCardId(null);
  }

  function chooseHandSortMode(mode: HandSortMode) {
    if (mode === handSortMode) return;

    setHandSortMode(mode);
    sortHand(mode);
  }

  return (
    <View
      style={[
        styles.gameContainer,
        compactControls && styles.gameContainerCompact,
      ]}
    >
      <View
        style={[
          styles.gameTopBar,
          compactControls && styles.gameTopBarCompact,
        ]}
      >
        <View
          style={[
            styles.gameInfoPill,
            compactControls && styles.gameInfoPillCompact,
          ]}
        >
          <Text style={styles.gameInfoLabel}>Kamercode</Text>
          <Text style={styles.gameInfoValue}>{room.code}</Text>
        </View>

        <Animated.View
          style={[
            styles.turnBanner,
            compactControls && styles.turnBannerCompact,
            isYourTurn && !winnerName ? styles.turnBannerActive : null,
            isYourTurn && !winnerName
              ? {
                  transform: [
                    {
                      scale: turnPulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.018],
                      }),
                    },
                  ],
                }
              : null,
          ]}
        >
          <Text style={styles.turnBannerText}>{topTurnText}</Text>
        </Animated.View>

                        <Pressable
          style={[
            styles.exitMiniButton,
            compactControls && styles.exitMiniButtonCompact,
          ]}
          onPress={leaveRoom}
        >
          <Text style={styles.exitMiniText}>Verlaat</Text>
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
                ? "Verbinding herstellen..."
                : connectionState === "connecting"
                ? "Verbinden..."
                : "Offline. Tik om opnieuw te verbinden.")}
          </Text>
        </Pressable>
      ) : null}

      <View
        style={[
          styles.tableWrapper,
          compactControls && styles.tableWrapperCompact,
        ]}
      >
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
                        onPress={handleDrawCards}
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
                            : "Trek kaart"}
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
                    <Text style={styles.pileCaption}>Aflegstapel</Text>
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

      <View
        style={[
          styles.bottomPanel,
          compactControls && styles.bottomPanelCompact,
        ]}
      >
        <View
          style={[
            styles.playerControlRow,
            compactControls && styles.playerControlRowCompact,
          ]}
        >
          <View
            style={[
              styles.meAvatar,
              {
                backgroundColor: avatar.backgroundColor,
                borderColor: avatarFrame.borderColor,
                shadowColor: avatarFrame.borderColor,
              },
            ]}
          >
            <Text
              style={[
                styles.meAvatarText,
                {
                  color: avatar.textColor,
                },
              ]}
            >
              {avatar.badge || (me?.name ?? "J").slice(0, 1).toUpperCase()}
            </Text>
          </View>

          <View style={[styles.meInfo, compactControls && styles.meInfoCompact]}>
            <Text style={styles.meName}>{me?.name ?? "Jij"}</Text>
            <Text style={styles.meSub}>
              {isWaitingForNextRound
                ? "wacht op volgende ronde"
                : finishedThisRound
                ? "je bent uit"
                : `${room.hand.length} kaarten - ${isYourTurn ? "beurt" : "wacht"}`}
            </Text>
          </View>

          <View
            style={[
              styles.actionButtons,
              compactControls && styles.actionButtonsCompact,
            ]}
          >
            {room.canRedrawDrawnCard ? (
              <Pressable
                style={[
                  styles.redrawButton,
                  compactControls && styles.redrawButtonCompact,
                  (!canAffordRedraw || redrawBusy) && styles.disabledButton,
                ]}
                onPress={handleRedrawDrawnCard}
                disabled={redrawBusy}
              >
                <Text style={styles.redrawButtonText} numberOfLines={1}>
                  {redrawBusy ? "Trekken..." : "Opnieuw trekken"}
                </Text>
                <Text style={styles.redrawButtonSub} numberOfLines={1}>
                  {canAffordRedraw
                    ? `Nieuwe kaart voor ${room.redrawCostGems} gems`
                    : "Niet genoeg gems"}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[
                styles.playSelectedButton,
                compactControls && styles.playSelectedButtonCompact,
                selectedCardPlayable && styles.playSelectedButtonReady,
                !selectedCardPlayable && styles.disabledButton,
              ]}
              onPress={handlePlaySelectedCard}
            >
              <Text style={styles.playSelectedButtonText}>
                {selectedCard?.value === "J" ? "Kies" : "Speel"}
              </Text>
              <Text style={styles.playSelectedButtonSub} numberOfLines={1}>
                {selectedCard ? getCardShortName(selectedCard) : "kaart"}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.actionButton,
                compactControls && styles.actionButtonCompact,
                room.canDraw && isYourTurn && styles.actionButtonReady,
                !room.canDraw && styles.disabledButton,
              ]}
              onPress={handleDrawCards}
              disabled={!room.canDraw}
            >
              <Text style={styles.actionButtonText}>
                {room.pendingDraw > 0 ? `Pak ${room.pendingDraw}` : "Trek kaart"}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.passButton,
                compactControls && styles.passButtonCompact,
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

        <View
          style={[
            styles.handToolbar,
            compactControls && styles.handToolbarCompact,
          ]}
        >
          <Text style={styles.handTitle}>Handkaarten</Text>

          <View style={styles.handToolbarRight}>
            <View style={styles.handSortSegment}>
              <Pressable
                style={[
                  styles.handSortButton,
                  handSortMode === "suit" && styles.handSortButtonActive,
                ]}
                onPress={() => chooseHandSortMode("suit")}
              >
                <Text
                  style={[
                    styles.handSortButtonText,
                    handSortMode === "suit" && styles.handSortButtonTextActive,
                  ]}
                >
                  Symbool
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.handSortButton,
                  handSortMode === "value" && styles.handSortButtonActive,
                ]}
                onPress={() => chooseHandSortMode("value")}
              >
                <Text
                  style={[
                    styles.handSortButtonText,
                    handSortMode === "value" && styles.handSortButtonTextActive,
                  ]}
                >
                  Waarde
                </Text>
              </Pressable>
            </View>
            <Text style={styles.handMeta} numberOfLines={1}>
              {isYourTurn
                ? `${playableCardsCount} speelbaar`
                : "wacht"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.turnCoach,
            compactControls && styles.turnCoachCompact,
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

        {ruleBanners.length > 0 ? (
          <View style={styles.ruleBannerList}>
            {ruleBanners.map((banner) => (
              <View
                key={banner.label}
                style={[
                  styles.ruleBanner,
                  banner.tone === "danger" && styles.ruleBannerDanger,
                  banner.tone === "success" && styles.ruleBannerSuccess,
                  banner.tone === "warning" && styles.ruleBannerWarning,
                ]}
              >
                <Text style={styles.ruleBannerLabel}>{banner.label}</Text>
                <Text style={styles.ruleBannerText} numberOfLines={2}>
                  {banner.message}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {showRuleBadges ? (
          <View style={styles.ruleStatusRow}>
            {ruleBadges.map((badge) => (
              <View
                key={badge.label}
                style={[
                  styles.ruleStatusChip,
                  badge.tone === "danger" && styles.ruleStatusChipDanger,
                  badge.tone === "success" && styles.ruleStatusChipSuccess,
                  badge.tone === "warning" && styles.ruleStatusChipWarning,
                ]}
              >
                <Text style={styles.ruleStatusLabel}>{badge.label}</Text>
                <Text style={styles.ruleStatusValue} numberOfLines={1}>
                  {badge.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View
          style={[
            styles.handArea,
            compactControls && styles.handAreaCompact,
          ]}
        >
          {isWaitingForNextRound || finishedThisRound ? (
            <View style={styles.waitingHandCard}>
              <Text style={styles.waitingHandTitle}>
                {isWaitingForNextRound ? "Je kijkt mee" : "Je bent uit"}
              </Text>
              <Text style={styles.waitingHandText}>
                {isWaitingForNextRound
                  ? "Je zit klaar en speelt automatisch mee in de volgende ronde."
                  : "De ronde is klaar. Kies nog een potje of ga terug naar de lobby."}
              </Text>
            </View>
          ) : (
          <View
            style={[
              styles.handFanViewport,
              compactControls && styles.handFanViewportCompact,
            ]}
          >
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
                  isYourTurn && !roundFinished && isCardPlayable(room, card);
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
                    selected={selectedCardId === card.id}
                    isDragging={draggingCardId === card.id}
                    hapticsEnabled={hapticsEnabled}
                    motionLevel={motionLevel}
                    onPress={handleCardPress}
                    onPlay={playPlayableCard}
                    onDragStart={() => setDraggingCardId(card.id)}
                    onDragEnd={() => setDraggingCardId(null)}
                  />
                );
              })}
            </Animated.View>
          </View>
          )}
        </View>
      </View>

      <Modal visible={Boolean(pendingJackCard)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <GameModalFrame
            eyebrow="Boer gespeeld"
            title="Kies symbool"
            text="Dit wordt het nieuwe symbool op tafel."
          >

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

            <GameButton
              label="Annuleren"
              tone="secondary"
              onPress={() => setPendingJackCard(null)}
            />
          </GameModalFrame>
        </View>
      </Modal>

      <Modal visible={Boolean(winnerName)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <GameModalFrame
            eyebrow="Ronde klaar"
            title={finishRewards?.resultLabel ?? (winnerName ? `${winnerName} wint` : "Ronde klaar")}
            text={
              finishRewards?.didWin
                ? "Sterk gespeeld. Je beloning is toegevoegd."
                : winnerName
                ? `${winnerName} wint deze ronde.`
                : loserName
                ? `${loserName} bleef over.`
                : "Beloningen bijgewerkt."
            }
          >
            {finishRewards ? (
              <Animated.View
                style={[
                  styles.finishRewardGrid,
                  {
                    opacity: finishRevealAnim,
                    transform: [
                      {
                        scale: finishRevealAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.94, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.finishRewardTile}>
                  <Text style={styles.finishRewardLabel}>Coins</Text>
                  <Text style={styles.finishRewardValue}>+{finishRewards.coins}</Text>
                </View>
                <View style={styles.finishRewardTile}>
                  <Text style={styles.finishRewardLabel}>XP</Text>
                  <Text style={styles.finishRewardValue}>+{finishRewards.xp}</Text>
                </View>
              </Animated.View>
            ) : null}

            {finishRewards?.missionText ? (
              <Text style={styles.finishMissionText}>{finishRewards.missionText}</Text>
            ) : null}

            <View style={styles.rankingList}>
              {endRanking.map((entry) => (
                <View
                  key={entry.player.id}
                  style={[
                    styles.rankingRow,
                    entry.isLoser && styles.rankingRowLoser,
                  ]}
                >
                  <Text style={styles.rankingPlace}>{entry.label}</Text>
                  <Text style={styles.rankingName}>{entry.player.name}</Text>
                  <Text style={styles.rankingMeta}>
                    {entry.isLoser ? "verliezer" : `${entry.player.cardCount} kaarten`}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.rematchPanel}>
              <Text style={styles.rematchTitle}>Volgende stap</Text>
              <Text style={styles.finishMissionText}>
                Nog een potje zet de tafel terug naar de lobby. De host kan daarna opnieuw starten.
              </Text>
            </View>

            <GameButton
              label={rematchPending ? "Even wachten" : "Nog een potje"}
              onPress={() => playAgain(true)}
              disabled={rematchPending}
            />

            <GameButton
              label="Terug naar lobby"
              onPress={() => playAgain(false)}
              tone="secondary"
              disabled={rematchPending}
            />

            <GameButton
              label="Naar home"
              onPress={leaveRoom}
              tone="secondary"
              disabled={rematchPending}
            />
          </GameModalFrame>
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

type RuleBadge = {
  label: string;
  value: string;
  tone: "neutral" | "danger" | "success" | "warning";
};

type RuleBanner = {
  label: string;
  message: string;
  tone: "neutral" | "danger" | "success" | "warning";
};

function getRuleBadges(room: PublicRoomState): RuleBadge[] {
  const activeSuit = room.chosenSuit ?? room.topCard?.suit;
  const badges: RuleBadge[] = [];

  if (activeSuit) {
    badges.push({
      label: room.chosenSuit ? "Boer" : "Symbool",
      value: suitLabels[activeSuit],
      tone: room.chosenSuit ? "success" : "neutral",
    });
  }

  if (room.pendingDraw > 0) {
    badges.push({
      label: "Straf",
      value: `+${room.pendingDraw}`,
      tone: "danger",
    });
  }

  if (room.turnState === "seven_chain") {
    badges.push({
      label: "7-reeks",
      value: room.sevenStopAfterNext
        ? "extra kaart"
        : room.sevenSuit
        ? suitLabels[room.sevenSuit]
        : "actief",
      tone: "warning",
    });
  } else if (room.turnState === "must_play") {
    badges.push({
      label: "Heer",
      value: room.canDraw ? "trek 1" : "extra",
      tone: "warning",
    });
  } else if (room.turnState === "after_draw") {
    badges.push({
      label: "Na trekken",
      value: room.canPass ? "leg/pas" : "leg",
      tone: "success",
    });
  }

  return badges.slice(0, 3);
}

function getRuleBanners(
  room: PublicRoomState,
  connectionState: ConnectionState
): RuleBanner[] {
  const banners: RuleBanner[] = [];

  if (connectionState !== "online") {
    banners.push({
      label: "Verbinding",
      message: "Verbinding herstellen...",
      tone: "warning",
    });
  }

  if (room.lastMessage?.toLowerCase().includes("pestkaart")) {
    banners.push({
      label: "Laatste kaart",
      message: "Je mag niet eindigen met een pestkaart.",
      tone: "danger",
    });
  }

  if (room.pendingDraw > 0) {
    banners.push({
      label: "Strafstapel",
      message: `Pak ${room.pendingDraw} of stapel met 2/Joker.`,
      tone: "danger",
    });
  }

  if (room.chosenSuit) {
    banners.push({
      label: "Boer",
      message: `Symbool gekozen: ${suitLabels[room.chosenSuit]}.`,
      tone: "success",
    });
  }

  if (room.turnState === "seven_chain") {
    banners.push({
      label: "Alles geven",
      message: room.sevenStopAfterNext
        ? "Heer in 7: speel nog precies 1 kaart."
        : "Speel hetzelfde symbool of sluit de reeks correct af.",
      tone: "warning",
    });
  }

  if (room.turnState === "must_play") {
    banners.push({
      label: "Heer",
      message: room.canDraw
        ? "Geen passende extra kaart: trek 1 kaart."
        : "Speel nog precies 1 extra kaart.",
      tone: "warning",
    });
  }

  return banners.slice(0, 3);
}

function getEndRanking(room: PublicRoomState) {
  const rankedPlayers: {
    label: string;
    player: PublicPlayer;
    isLoser: boolean;
  }[] = [];
  const usedPlayerIds = new Set<string>();

  for (const playerId of room.finishedPlayerIds) {
    const player = room.players.find((item) => item.id === playerId);

    if (!player) continue;

    rankedPlayers.push({
      label: `#${rankedPlayers.length + 1}`,
      player,
      isLoser: false,
    });
    usedPlayerIds.add(player.id);
  }

  const remainingPlayers = [
    room.players.find((player) => player.id === room.loserId),
    ...room.players.filter((player) => !usedPlayerIds.has(player.id)),
  ].filter((player): player is PublicPlayer => Boolean(player));
  const uniqueRemainingPlayers = remainingPlayers.filter(
    (player, index, players) =>
      !usedPlayerIds.has(player.id) &&
      players.findIndex((item) => item.id === player.id) === index
  );

  for (const loser of uniqueRemainingPlayers) {
    rankedPlayers.push({
      label: uniqueRemainingPlayers.length === 1 ? "Laatste" : "Niet uit",
      player: loser,
      isLoser: true,
    });
  }

  return rankedPlayers;
}

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

function compareCardsByValue(cardA: Card, cardB: Card) {
  const valueDiff = valueSortOrder[cardA.value] - valueSortOrder[cardB.value];

  if (valueDiff !== 0) return valueDiff;

  return (
    (cardA.suit ? symbolSortOrder[cardA.suit] : 99) -
    (cardB.suit ? symbolSortOrder[cardB.suit] : 99)
  );
}

function getTopTurnText({
  room,
  isYourTurn,
  isWaitingForNextRound,
  currentPlayerName,
  currentPlayerIsBot,
  winnerName,
}: {
  room: PublicRoomState;
  isYourTurn: boolean;
  isWaitingForNextRound: boolean;
  currentPlayerName?: string;
  currentPlayerIsBot: boolean;
  winnerName?: string;
}) {
  if (winnerName) return "Ronde klaar";
  if (isWaitingForNextRound) return "Je kijkt mee";
  if (isYourTurn) return getTurnText(room);
  if (currentPlayerIsBot) return `${currentPlayerName ?? "Bot"} denkt...`;

  return `Wachten op ${currentPlayerName ?? "speler"}`;
}

function getTurnCoachText({
  room,
  isYourTurn,
  currentPlayerName,
  currentPlayerIsBot,
  playableCardsCount,
  selectedCardName,
  winnerName,
}: {
  room: PublicRoomState;
  isYourTurn: boolean;
  currentPlayerName?: string;
  currentPlayerIsBot: boolean;
  playableCardsCount: number;
  selectedCardName?: string;
  winnerName?: string;
}) {
  if (winnerName) {
    return `${winnerName} wint.`;
  }

  if (!isYourTurn) {
    if (currentPlayerIsBot) {
      return `${currentPlayerName ?? "Bot"} denkt na...`;
    }

    return `Wachten op ${currentPlayerName ?? "speler"}.`;
  }

  if (selectedCardName) {
    return `${selectedCardName} geselecteerd. Tik Speel of tik nogmaals.`;
  }

  if (room.pendingDraw > 0) {
    return `Pak ${room.pendingDraw} of stapel met 2/Joker.`;
  }

  if (room.turnState === "after_draw") {
    if (room.canRedrawDrawnCard) {
      return `Nieuwe kaart voor ${room.redrawCostGems} gems. Speel of pas daarna.`;
    }

    return room.canPass
      ? "Speel of pas."
      : "Leg je getrokken kaart.";
  }

  if (room.turnState === "seven_chain") {
    if (room.sevenStopAfterNext) {
      if (room.canDraw) {
        return "Geen vervolgkaart: trek 1 kaart.";
      }

      return "Heer in 7: speel nog precies 1 kaart.";
    }

    return room.sevenSuit
      ? `Alles geven: speel ${suitLabels[room.sevenSuit]}.`
      : "Alles geven: speel hetzelfde symbool.";
  }

  if (room.turnState === "must_play") {
    if (room.canDraw) {
      return "Geen vervolgkaart: trek 1 kaart.";
    }

    return "Heer: speel nog precies 1 kaart.";
  }

  if (room.chosenSuit) {
    return `Symbool gekozen: ${suitLabels[room.chosenSuit]}.`;
  }

  if (playableCardsCount > 0) {
    return "Tik of sleep een speelbare kaart.";
  }

  if (room.canDraw) {
    return "Trek een kaart.";
  }

  if (room.canPass) {
    return "Passen mag.";
  }

  return "Even wachten.";
}

function getInvalidCardHint(room: PublicRoomState) {
  if (room.pendingDraw > 0) {
    return `+${room.pendingDraw}: stapel met 2/Joker of pak de straf.`;
  }

  if (room.turnState === "seven_chain") {
    if (room.sevenStopAfterNext) {
      return "Heer in 7: speel precies 1 passende kaart.";
    }

    return room.sevenSuit
      ? `7-reeks: speel ${suitLabels[room.sevenSuit]} of sluit correct af.`
      : "7-reeks: speel een geldige vervolgkaart.";
  }

  if (room.turnState === "must_play") {
    return "Heer: speel precies 1 passende extra kaart.";
  }

  if (room.chosenSuit) {
    return `Boer vraagt ${suitLabels[room.chosenSuit]}.`;
  }

  return "Deze kaart past nu niet.";
}

function getCardDisplayName(card: Card) {
  if (card.value === "JOKER") return "Joker";

  const valueLabels: Record<Card["value"], string> = {
    A: "Aas",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",
    "10": "10",
    J: "Boer",
    Q: "Vrouw",
    K: "Heer",
    JOKER: "Joker",
  };

  return card.suit
    ? `${valueLabels[card.value]} ${suitLabels[card.suit]}`
    : valueLabels[card.value];
}

function getCardShortName(card: Card) {
  if (card.value === "JOKER") return "Joker";

  return `${card.value}${card.suit ? suitShortLabels[card.suit] : ""}`;
}

function isPestCard(card: Card) {
  return ["A", "2", "7", "8", "J", "K", "JOKER"].includes(card.value);
}

function HandCard({
  card,
  index,
  playable,
  layout,
  fanAngle,
  selected,
  isDragging,
  hapticsEnabled,
  motionLevel,
  onPress,
  onPlay,
  onDragStart,
  onDragEnd,
}: {
  card: Card;
  index: number;
  playable: boolean;
  layout: HandLayout;
  fanAngle: number;
  selected: boolean;
  isDragging: boolean;
  hapticsEnabled: boolean;
  motionLevel: MotionSetting;
  onPress: (card: Card) => void;
  onPlay: (card: Card) => void;
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
              onPlay(card);
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
    [card, hapticsEnabled, onDragEnd, onDragStart, onPlay, pan, playable]
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.handCardButton,
        playable ? styles.playableCard : styles.notPlayableCard,
        selected && styles.selectedCard,
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
            { translateY: selected ? -18 : playable ? -10 : 0 },
            { translateY: pan.y },
            { rotate: `${fanAngle}deg` },
            { scale: selected ? 1.09 : playable ? 1.04 : 1 },
          ],
        },
      ]}
    >
      <Pressable hitSlop={8} onPress={() => onPress(card)}>
        {playable ? (
          <View style={[styles.playablePip, selected && styles.playablePipSelected]}>
            <Text
              style={[
                styles.playablePipText,
                selected && styles.playablePipTextSelected,
              ]}
            >
              {selected ? "Speel" : "OK"}
            </Text>
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
        player.waitingForNextRound && styles.offlineSeat,
        player.finished && styles.finishedSeat,
      ]}
    >
      {isCurrent ? (
        <View style={styles.nowBadge}>
          <Text style={styles.nowBadgeText}>NU</Text>
        </View>
      ) : null}

      {player.waitingForNextRound ? (
        <View style={styles.spectatorBadge}>
          <Text style={styles.spectatorBadgeText}>Kijkt mee</Text>
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
          {player.waitingForNextRound
            ? "volgende ronde"
            : player.finished
            ? `uit${player.rank ? ` #${player.rank}` : ""}`
            : `${player.cardCount} kaarten`}
        </Text>
      </View>

      {player.finished ? (
        <View style={styles.oneCardBadge}>
          <Text style={styles.oneCardBadgeText}>Uit</Text>
        </View>
      ) : player.cardCount === 1 && player.inRound ? (
        <View style={styles.oneCardBadge}>
          <Text style={styles.oneCardBadgeText}>Nog 1!</Text>
        </View>
      ) : null}

      {!hideStack && player.inRound && !player.finished ? (
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
