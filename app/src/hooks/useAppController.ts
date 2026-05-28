import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Keyboard } from "react-native";

import { getCardBackImage } from "../cardBackImages";
import { getAvatarFrameOption, getAvatarOption } from "../cosmetics";
import { MATCH_ENTRY_COINS, REDRAW_COST_GEMS } from "../economy";
import {
  RECENT_PLAYERS_STORAGE_KEY,
  RecentPlayer,
  buildProfileFoundation,
} from "../profileFoundation";
import { useAppSettings } from "../settings";
import { getTableSkinOption } from "../tableSkins";
import type { Card, Suit } from "../types";
import { useEconomy } from "./useEconomy";
import { useRoomSocket } from "./useRoomSocket";

export function useAppController() {
  const { settings, updateSettings } = useAppSettings();
  const {
    connected,
    connectionState,
    playerId,
    name,
    hasSavedName,
    setName,
    roomCodeInput,
    setRoomCodeInput,
    room,
    publicRooms,
    matchmakingStatus,
    pendingAction,
    errorMessage,
    clearError,
    retryConnection,
    createRoom,
    joinRoom,
    quickPlay,
    listPublicRooms,
    joinPublicRoom,
    addBot,
    startGame,
    leaveRoom,
    playCard,
    drawCards,
    passTurn,
    redrawDrawnCard,
    sortHand,
    playAgain,
  } = useRoomSocket(settings.hapticsEnabled);
  const {
    wallet,
    season,
    canClaimDailyGems,
    notice: economyNotice,
    clearNotice,
    spendCoins,
    refundCoins,
    spendGems,
    refundGems,
    buyCoinsWithGems,
    claimDailyGems,
    previewPremiumPass,
    previewGemPurchase,
    buyCardBack,
    selectCardBack,
    buyTableSkin,
    selectTableSkin,
    buyAvatar,
    selectAvatar,
    buyAvatarFrame,
    selectAvatarFrame,
    recordGameResult,
    recordPestCardPlayed,
    claimDailyMission,
    claimSeasonReward,
    claimMilestoneReward,
  } = useEconomy();

  const isHost = room?.hostId === playerId;
  const isYourTurn = room?.currentPlayerId === playerId;
  const roundFinished = room?.turnState === "finished";
  const winner = roundFinished
    ? room?.players.find((player) => player.id === room.winnerId)
    : undefined;
  const loser = roundFinished
    ? room?.players.find((player) => player.id === room.loserId)
    : undefined;
  const screenKey = !room ? "home" : room.started ? "game" : "room";
  const screenAnim = useRef(new Animated.Value(1)).current;
  const pendingEntrySpendRef = useRef(false);
  const pendingRedrawSpendRef = useRef(false);
  const selectedTableSkin = getTableSkinOption(wallet.selectedTableSkinId);
  const selectedAvatar = getAvatarOption(wallet.selectedAvatarId);
  const selectedAvatarFrame = getAvatarFrameOption(wallet.selectedAvatarFrameId);
  const [recentPlayers, setRecentPlayers] = useState<RecentPlayer[]>([]);
  const recentRoundRef = useRef<string | null>(null);
  const profileFoundation = useMemo(
    () =>
      buildProfileFoundation({
        connected,
        level: season.level,
        name,
        playerId,
        wallet,
      }),
    [connected, name, playerId, season.level, wallet]
  );

  useEffect(() => {
    screenAnim.setValue(0);

    Animated.timing(screenAnim, {
      toValue: 1,
      duration: settings.motionLevel === "low" ? 120 : 240,
      useNativeDriver: true,
    }).start();
  }, [screenAnim, screenKey, settings.motionLevel]);

  useEffect(() => {
    if (!room || !pendingEntrySpendRef.current) return;

    pendingEntrySpendRef.current = false;
  }, [room?.code, room]);

  useEffect(() => {
    if (!errorMessage) return;

    if (pendingEntrySpendRef.current) {
      pendingEntrySpendRef.current = false;
      refundCoins(MATCH_ENTRY_COINS);
    }

    if (pendingRedrawSpendRef.current) {
      pendingRedrawSpendRef.current = false;
      refundGems(room?.redrawCostGems ?? REDRAW_COST_GEMS);
    }
  }, [errorMessage, refundCoins, refundGems, room?.redrawCostGems]);

  useEffect(() => {
    if (pendingAction !== null || errorMessage || !pendingRedrawSpendRef.current) {
      return;
    }

    pendingRedrawSpendRef.current = false;
  }, [errorMessage, pendingAction, room?.lastMessage]);

  useEffect(() => {
    if (!room?.winnerId || room.turnState !== "finished" || !room.roundId) return;

    recordGameResult(`${room.code}-${room.roundId}`, room.winnerId === playerId);
  }, [
    playerId,
    recordGameResult,
    room?.code,
    room?.roundId,
    room?.turnState,
    room?.winnerId,
  ]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_PLAYERS_STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;

        setRecentPlayers(JSON.parse(stored) as RecentPlayer[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!room?.winnerId || room.turnState !== "finished" || !room.roundId) return;

    const roundKey = `${room.code}-${room.roundId}`;

    if (recentRoundRef.current === roundKey) return;

    recentRoundRef.current = roundKey;

    const result: RecentPlayer["result"] =
      room.winnerId === playerId ? "win" : "loss";
    const nextRecentPlayers = room.players
      .filter((player) => player.id !== playerId && !player.isBot)
      .map((player) => ({
        playerId: player.id,
        name: player.name,
        lastPlayedAt: Date.now(),
        result,
      }));

    if (nextRecentPlayers.length === 0) return;

    setRecentPlayers((currentRecentPlayers) => {
      const merged = [
        ...nextRecentPlayers,
        ...currentRecentPlayers.filter(
          (currentPlayer) =>
            !nextRecentPlayers.some(
              (nextPlayer) => nextPlayer.playerId === currentPlayer.playerId
            )
        ),
      ].slice(0, 8);

      AsyncStorage.setItem(
        RECENT_PLAYERS_STORAGE_KEY,
        JSON.stringify(merged)
      ).catch(() => {});

      return merged;
    });
  }, [
    playerId,
    room?.code,
    room?.players,
    room?.roundId,
    room?.turnState,
    room?.winnerId,
  ]);

  function createRoomWithEntry() {
    Keyboard.dismiss();

    if (!connected) {
      createRoom();
      return;
    }

    if (!spendCoins(MATCH_ENTRY_COINS, "Tafelinzet")) return;

    pendingEntrySpendRef.current = true;
    createRoom();
  }

  function joinRoomWithEntry() {
    Keyboard.dismiss();

    if (!connected || roomCodeInput.trim().length < 5) {
      joinRoom();
      return;
    }

    if (!spendCoins(MATCH_ENTRY_COINS, "Tafelinzet")) return;

    pendingEntrySpendRef.current = true;
    joinRoom();
  }

  function redrawDrawnCardWithGems() {
    const redrawCost = room?.redrawCostGems ?? REDRAW_COST_GEMS;

    if (!spendGems(redrawCost, "Nieuwe pakkaart")) return;

    pendingRedrawSpendRef.current = true;
    redrawDrawnCard();
  }

  function playCardWithTracking(card: Card, chosenSuit?: Suit) {
    if (["A", "2", "7", "8", "J", "K", "JOKER"].includes(card.value)) {
      recordPestCardPlayed();
    }

    playCard(card, chosenSuit);
  }

  return {
    screenAnim,
    screenKey,
    room,
    lobbyProps: {
      name,
      hasSavedName,
      setName,
      roomCodeInput,
      setRoomCodeInput,
      createRoom: createRoomWithEntry,
      joinRoom: joinRoomWithEntry,
      quickPlay,
      listPublicRooms,
      joinPublicRoom,
      publicRooms,
      matchmakingStatus,
      profileFoundation,
      recentPlayers,
      connected,
      connectionState,
      pendingAction,
      errorMessage,
      clearError,
      retryConnection,
      wallet,
      season,
      settings,
      updateSettings,
      economyNotice,
      clearEconomyNotice: clearNotice,
      entryCostCoins: MATCH_ENTRY_COINS,
      buyCoinsWithGems,
      claimDailyGems,
      canClaimDailyGems,
      previewPremiumPass,
      previewGemPurchase,
      buyCardBack,
      selectCardBack,
      buyTableSkin,
      selectTableSkin,
      buyAvatar,
      selectAvatar,
      buyAvatarFrame,
      selectAvatarFrame,
      claimDailyMission,
      claimSeasonReward,
      claimMilestoneReward,
    },
    gameProps: room
      ? {
          room,
          playerId,
          isYourTurn: Boolean(isYourTurn),
          winnerName: winner?.name,
          loserName: loser?.name,
          drawCards,
          passTurn,
          playCard: playCardWithTracking,
          playAgain,
          leaveRoom,
          connectionState,
          errorMessage,
          pendingAction,
          clearError,
          retryConnection,
          gems: wallet.gems,
          cardBackImage: getCardBackImage(wallet.selectedCardBackId),
          tableSkin: selectedTableSkin,
          avatar: selectedAvatar,
          avatarFrame: selectedAvatarFrame,
          hapticsEnabled: settings.hapticsEnabled,
          cardSize: settings.cardSize,
          motionLevel: settings.motionLevel,
          redrawDrawnCard: redrawDrawnCardWithGems,
          sortHand,
        }
      : null,
    waitingRoomProps: room
      ? {
          room,
          playerId,
          isHost: Boolean(isHost),
          startGame,
          addBot,
          leaveRoom,
          connectionState,
          retryConnection,
          pendingAction,
          errorMessage,
          clearError,
          hapticsEnabled: settings.hapticsEnabled,
        }
      : null,
  };
}
