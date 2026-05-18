import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Keyboard, SafeAreaView } from "react-native";

import { getCardBackImage } from "./src/cardBackImages";
import { GameTable } from "./src/components/GameTable";
import { LobbyScreen } from "./src/components/LobbyScreen";
import { WaitingRoom } from "./src/components/WaitingRoom";
import { MATCH_ENTRY_COINS, REDRAW_COST_GEMS } from "./src/economy";
import { useEconomy } from "./src/hooks/useEconomy";
import { useRoomSocket } from "./src/hooks/useRoomSocket";
import { useAppSettings } from "./src/settings";
import { styles } from "./src/styles";
import { getTableSkinOption } from "./src/tableSkins";

export default function App() {
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
    pendingAction,
    errorMessage,
    clearError,
    retryConnection,
    createRoom,
    joinRoom,
    toggleReady,
    startGame,
    leaveRoom,
    playCard,
    drawCards,
    passTurn,
    redrawDrawnCard,
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
    recordGameResult,
    claimSeasonReward,
    claimMilestoneReward,
  } = useEconomy();

  const isHost = room?.hostId === playerId;
  const isYourTurn = room?.currentPlayerId === playerId;
  const winner = room?.players.find((player) => player.id === room.winnerId);
  const screenKey = !room ? "home" : room.started ? "game" : "room";
  const screenAnim = useRef(new Animated.Value(1)).current;
  const pendingEntrySpendRef = useRef(false);
  const pendingRedrawSpendRef = useRef(false);
  const selectedTableSkin = getTableSkinOption(wallet.selectedTableSkinId);

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
    if (!room?.winnerId || !room.roundId) return;

    recordGameResult(`${room.code}-${room.roundId}`, room.winnerId === playerId);
  }, [
    playerId,
    recordGameResult,
    room?.code,
    room?.roundId,
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

  return (
    <SafeAreaView style={styles.screen}>
      <LinearGradient
        colors={["#06140f", "#10281f", "#2a2114", "#07110d"]}
        style={styles.background}
      >
        <Animated.View
          key={screenKey}
          style={[
            styles.screenTransition,
            {
              opacity: screenAnim,
              transform: [
                {
                  translateY: screenAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
                {
                  scale: screenAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.985, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {!room ? (
            <LobbyScreen
              name={name}
              hasSavedName={hasSavedName}
              setName={setName}
              roomCodeInput={roomCodeInput}
              setRoomCodeInput={setRoomCodeInput}
              createRoom={createRoomWithEntry}
              joinRoom={joinRoomWithEntry}
              connected={connected}
              connectionState={connectionState}
              pendingAction={pendingAction}
              errorMessage={errorMessage}
              clearError={clearError}
              retryConnection={retryConnection}
              wallet={wallet}
              season={season}
              settings={settings}
              updateSettings={updateSettings}
              economyNotice={economyNotice}
              clearEconomyNotice={clearNotice}
              entryCostCoins={MATCH_ENTRY_COINS}
              buyCoinsWithGems={buyCoinsWithGems}
              claimDailyGems={claimDailyGems}
              canClaimDailyGems={canClaimDailyGems}
              previewPremiumPass={previewPremiumPass}
              previewGemPurchase={previewGemPurchase}
              buyCardBack={buyCardBack}
              selectCardBack={selectCardBack}
              buyTableSkin={buyTableSkin}
              selectTableSkin={selectTableSkin}
              claimSeasonReward={claimSeasonReward}
              claimMilestoneReward={claimMilestoneReward}
            />
          ) : room.started ? (
            <GameTable
              room={room}
              playerId={playerId}
              isYourTurn={Boolean(isYourTurn)}
              winnerName={winner?.name}
              drawCards={drawCards}
              passTurn={passTurn}
              playCard={playCard}
              playAgain={playAgain}
              leaveRoom={leaveRoom}
              connectionState={connectionState}
              errorMessage={errorMessage}
              clearError={clearError}
              retryConnection={retryConnection}
              gems={wallet.gems}
              cardBackImage={getCardBackImage(wallet.selectedCardBackId)}
              tableSkin={selectedTableSkin}
              hapticsEnabled={settings.hapticsEnabled}
              cardSize={settings.cardSize}
              motionLevel={settings.motionLevel}
              redrawDrawnCard={redrawDrawnCardWithGems}
            />
          ) : (
            <WaitingRoom
              room={room}
              playerId={playerId}
              isHost={Boolean(isHost)}
              startGame={startGame}
              toggleReady={toggleReady}
              leaveRoom={leaveRoom}
              connectionState={connectionState}
              retryConnection={retryConnection}
              pendingAction={pendingAction}
              errorMessage={errorMessage}
              clearError={clearError}
              hapticsEnabled={settings.hapticsEnabled}
            />
          )}
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
}
