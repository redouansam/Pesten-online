import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";

import { styles } from "../styles";
import { PublicPlayer, PublicRoomState } from "../types";

export function WaitingRoom({
  room,
  playerId,
  isHost,
  startGame,
  toggleReady,
  leaveRoom,
  pendingAction,
  errorMessage,
  clearError,
}: {
  room: PublicRoomState;
  playerId: string;
  isHost: boolean;
  startGame: () => void;
  toggleReady: () => void;
  leaveRoom: () => void | Promise<void>;
  pendingAction: string | null;
  errorMessage: string | null;
  clearError: () => void;
}) {
  const me = room.players.find((player) => player.id === playerId);
  const connectedPlayers = room.players.filter((player) => player.connected);
  const connectedGuests = connectedPlayers.filter(
    (player) => player.id !== room.hostId
  );
  const readyPlayers = isHost ? connectedGuests : connectedPlayers;
  const readyCount = readyPlayers.filter((player) => player.ready).length;
  const readyTotal = readyPlayers.length;
  const readyPercent =
    readyTotal === 0 ? 0 : Math.round((readyCount / readyTotal) * 100);

  const guestsReady =
    connectedGuests.length > 0 &&
    connectedGuests.every((player) => player.ready);
  const hasEnoughPlayers = connectedPlayers.length >= 2;

  const canStart = isHost && hasEnoughPlayers && guestsReady;
  const readyPending = pendingAction === "ready";
  const startPending = pendingAction === "start";
  const startHint = !isHost
    ? "Klik klaar. De host start daarna de game."
    : !hasEnoughPlayers
    ? "Nodig minimaal een extra speler uit."
    : !guestsReady
    ? "Wacht tot alle gasten klaar zijn."
    : "Iedereen is klaar. Start wanneer je wilt.";

  const slots: Array<PublicPlayer | null> = [...room.players];

  while (slots.length < 4) {
    slots.push(null);
  }

  async function copyCode() {
    await Clipboard.setStringAsync(room.code);
    Haptics.selectionAsync().catch(() => {});
    Alert.alert("Gekopieerd", `Kamer code ${room.code} is gekopieerd.`);
  }

  async function shareCode() {
    Haptics.selectionAsync().catch(() => {});
    await Share.share({
      message: `Join mijn Pesten kamer met code: ${room.code}`,
    });
  }

  return (
    <ScrollView
      contentContainerStyle={styles.lobbyScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.lobbyPanel}>
        <View style={styles.lobbyHeader}>
          <View>
            <Text style={styles.lobbyEyebrow}>Wachtkamer</Text>
            <Text style={styles.lobbyTitle}>
              {isHost ? "Jij bent host" : "Bijna klaar"}
            </Text>
            <Text style={styles.lobbySubtitle}>{startHint}</Text>
          </View>

          <View style={styles.playerCountPill}>
            <Text style={styles.playerCountText}>
              {connectedPlayers.length}/4
            </Text>
          </View>
        </View>

        <View style={styles.codeHeroCard}>
          <View>
            <Text style={styles.codeLabel}>Kamer code</Text>
            <Text style={styles.codeValue}>{room.code}</Text>
          </View>

          <View style={styles.codeActionsVertical}>
            <Pressable style={styles.codeActionButton} onPress={copyCode}>
              <Text style={styles.codeActionText}>Kopieer</Text>
            </Pressable>

            <Pressable style={styles.codeActionButtonGold} onPress={shareCode}>
              <Text style={styles.codeActionTextGold}>Deel</Text>
            </Pressable>
          </View>
        </View>

        {errorMessage ? (
          <Pressable style={styles.errorBanner} onPress={clearError}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </Pressable>
        ) : null}

        {pendingAction ? (
          <View style={styles.loadingBanner}>
            <Text style={styles.loadingBannerText}>
              {readyPending
                ? "Klaarzetten..."
                : startPending
                ? "Game starten..."
                : "Even verwerken..."}
            </Text>
          </View>
        ) : null}

        <View style={styles.readyCard}>
          <View style={styles.readyTopRow}>
            <Text style={styles.readyTitle}>
              {isHost ? "Gasten klaar" : "Jouw status"}
            </Text>
            <Text style={styles.readyNumber}>
              {readyCount}/{readyTotal}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${readyPercent}%` }]} />
          </View>
        </View>

        <View style={styles.playersSection}>
          <View style={styles.playerListTitleRow}>
            <Text style={styles.playerListTitle}>Spelers</Text>
            <Text style={styles.playerListMeta}>
              {connectedPlayers.length} online
            </Text>
          </View>

          {slots.slice(0, 4).map((player, index) => {
            if (!player) {
              return (
                <View key={`empty-${index}`} style={styles.emptySlotRow}>
                  <View style={styles.emptyAvatar}>
                    <Text style={styles.emptyAvatarText}>+</Text>
                  </View>

                  <View style={styles.emptySlotCopy}>
                    <Text style={styles.emptySlotTitle}>Vrije plek</Text>
                    <Text style={styles.emptySlotText}>Nodig iemand uit</Text>
                  </View>
                </View>
              );
            }

            const isMe = player.id === playerId;
            const isRoomHost = player.id === room.hostId;

            return (
              <View
                key={player.id}
                style={[
                  styles.playerRowCard,
                  !player.connected && styles.playerSlotOffline,
                  player.ready && styles.playerSlotReady,
                ]}
              >
                <View style={styles.slotAvatar}>
                  <Text style={styles.slotAvatarText}>
                    {player.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.playerRowMain}>
                  <Text style={styles.slotName} numberOfLines={1}>
                    {player.name}
                  </Text>

                  <View style={styles.slotTags}>
                    {isRoomHost ? (
                      <View style={styles.hostTag}>
                        <Text style={styles.hostTagText}>Host</Text>
                      </View>
                    ) : null}

                    {isMe ? (
                      <View style={styles.youTag}>
                        <Text style={styles.youTagText}>Jij</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.playerRowRight}>
                  <View
                    style={[
                      styles.slotStatusDot,
                      player.connected
                        ? styles.slotStatusOnline
                        : styles.slotStatusOffline,
                    ]}
                  />

                  <View
                    style={[
                      styles.readyMiniBadge,
                      player.ready && styles.readyMiniBadgeOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.readyMiniBadgeText,
                        player.ready && styles.readyMiniBadgeTextOn,
                      ]}
                    >
                      {player.ready ? "Klaar" : "Wacht"}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.lobbyBottomPanel}>
          {!isHost ? (
            <Pressable
              style={[
                styles.readyCtaButton,
                me?.ready && styles.readyCtaButtonOn,
                readyPending && styles.disabledButton,
              ]}
              onPress={toggleReady}
              disabled={readyPending}
            >
              <Text
                style={[
                  styles.readyCtaText,
                  me?.ready && styles.readyCtaTextOn,
                ]}
              >
                {readyPending ? "Even wachten..." : me?.ready ? "Klaar" : "Ik ben klaar"}
              </Text>
            </Pressable>
          ) : null}

          {isHost ? (
            <Pressable
              style={[
                styles.startButton,
                (!canStart || startPending) && styles.disabledButton,
              ]}
              onPress={startGame}
              disabled={!canStart || startPending}
            >
              <Text style={styles.startButtonText}>
                {startPending ? "Starten..." : "Start game"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.hostWaitingBox}>
              <Text style={styles.hostWaitingText}>Wachten op de host</Text>
            </View>
          )}

          <Pressable style={styles.leaveButtonWide} onPress={leaveRoom}>
            <Text style={styles.leaveButtonText}>Kamer verlaten</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
