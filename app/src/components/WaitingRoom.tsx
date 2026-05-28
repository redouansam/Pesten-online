import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Alert, Pressable, ScrollView, Share, Text, View } from "react-native";

import { styles } from "../styles";
import type { ConnectionState } from "../hooks/useRoomSocket";
import { PublicPlayer, PublicRoomState } from "../types";

export function WaitingRoom({
  room,
  playerId,
  isHost,
  startGame,
  addBot,
  leaveRoom,
  connectionState,
  retryConnection,
  pendingAction,
  errorMessage,
  clearError,
  hapticsEnabled,
}: {
  room: PublicRoomState;
  playerId: string;
  isHost: boolean;
  startGame: () => void;
  addBot: () => void;
  leaveRoom: () => void | Promise<void>;
  connectionState: ConnectionState;
  retryConnection: () => void;
  pendingAction: string | null;
  errorMessage: string | null;
  clearError: () => void;
  hapticsEnabled: boolean;
}) {
  const connectedPlayers = room.players.filter((player) => player.connected);
  const seatCount = room.players.length;
  const readyPercent = Math.round((seatCount / room.maxPlayers) * 100);
  const hasEnoughPlayers = connectedPlayers.length >= 2;

  const canStart = isHost && hasEnoughPlayers;
  const startPending = pendingAction === "start";
  const tableStatus = !hasEnoughPlayers
    ? "Minimaal 2 spelers nodig"
    : canStart
    ? "Klaar om te starten"
    : "Wachten op host";
  const actionHint = !isHost
    ? "Wachten op host."
    : canStart
    ? "Start wanneer je wilt."
    : !hasEnoughPlayers
    ? "Deel je code."
    : "Wacht op spelers.";

  const slots: Array<PublicPlayer | null> = [...room.players];

  while (slots.length < room.maxPlayers) {
    slots.push(null);
  }

  async function copyCode() {
    await Clipboard.setStringAsync(room.code);
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    Alert.alert("Gekopieerd", `Kamercode ${room.code} is gekopieerd.`);
  }

  async function shareCode() {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    await Share.share({
      message: `Doe mee met mijn Pesten-kamer met code: ${room.code}`,
    });
  }

  function handleAddBot() {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    addBot();
  }

  function handleStartGame() {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    startGame();
  }

  function handleLeaveRoom() {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    leaveRoom();
  }

  return (
    <ScrollView
      contentContainerStyle={styles.lobbyScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.lobbyPanel}>
        <View style={styles.lobbyHeader}>
          <View style={styles.lobbyHeaderCopy}>
            <Text style={styles.lobbyEyebrow}>Wachtkamer</Text>
            <Text style={styles.lobbyTitle} numberOfLines={1}>
              Wacht op spelers
            </Text>
            <Text style={styles.lobbySubtitle} numberOfLines={2}>
              {actionHint}
            </Text>
          </View>

          <View style={styles.playerCountPill}>
            <Text style={styles.playerCountText}>
              {connectedPlayers.length}/{room.maxPlayers}
            </Text>
          </View>
        </View>

        <RoomCodeCard code={room.code} onCopy={copyCode} onShare={shareCode} />

        {connectionState !== "online" ? (
          <View style={styles.connectionHelpCard}>
            <View style={styles.connectionHelpCopy}>
              <Text style={styles.connectionHelpTitle}>
                {connectionState === "reconnecting"
                  ? "Opnieuw verbinden"
                  : connectionState === "connecting"
                  ? "Verbinden..."
                  : "Offline"}
              </Text>
              <Text style={styles.connectionHelpText}>
                Room blijft bewaard. Op gratis hosting kan wakker worden 30-60 sec duren.
              </Text>
            </View>
            <Pressable
              style={styles.connectionRetryButton}
              onPress={retryConnection}
            >
              <Text style={styles.connectionRetryText}>Opnieuw</Text>
            </Pressable>
          </View>
        ) : null}

        {errorMessage ? (
          <Pressable style={styles.errorBanner} onPress={clearError}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </Pressable>
        ) : null}

        {pendingAction ? (
          <View style={styles.loadingBanner}>
            <Text style={styles.loadingBannerText}>
              {pendingAction === "bot"
                ? "Bot toevoegen..."
                : startPending
                ? "Game starten..."
                : "Even verwerken..."}
            </Text>
          </View>
        ) : null}

        <View style={styles.readyCard}>
          <View style={styles.readyTopRow}>
            <View style={styles.readyCopy}>
              <Text style={styles.readyTitle}>Tafelstatus</Text>
              <Text style={styles.readyHelper} numberOfLines={1}>
                {tableStatus}
              </Text>
            </View>
            <View style={styles.lobbyOnlinePill}>
              <Text style={styles.lobbyOnlinePillText} numberOfLines={1}>
                {connectedPlayers.length}/{room.maxPlayers} online
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${readyPercent}%` }]} />
          </View>
        </View>

        <View style={styles.playersSection}>
          <View style={styles.playerListTitleRow}>
            <Text style={styles.playerListTitle}>Spelers</Text>
            <Text style={styles.playerListMeta}>
              {connectedPlayers.length}/{room.maxPlayers} online
            </Text>
          </View>

          {slots.slice(0, room.maxPlayers).map((player, index) => {
            if (!player) {
              return <EmptyPlayerSlot key={`empty-${index}`} />;
            }

            const isMe = player.id === playerId;
            const isRoomHost = player.id === room.hostId;

            return (
              <LobbyPlayerSlot
                key={player.id}
                player={player}
                isMe={isMe}
                isRoomHost={isRoomHost}
              />
            );
          })}
        </View>

        <View style={styles.lobbyBottomPanel}>
          {isHost && room.players.length < room.maxPlayers ? (
            <Pressable
              style={[
                styles.readyCtaButton,
                pendingAction === "bot" && styles.disabledButton,
              ]}
              onPress={handleAddBot}
              disabled={pendingAction === "bot"}
            >
              <Text style={styles.readyCtaText}>
                {pendingAction === "bot" ? "..." : "Bot erbij"}
              </Text>
            </Pressable>
          ) : null}

          {isHost ? (
            <Pressable
              style={[
                styles.startButton,
                (!canStart || startPending) && styles.disabledButton,
              ]}
              onPress={handleStartGame}
              disabled={!canStart || startPending}
            >
              <Text style={styles.startButtonText}>
                {startPending
                  ? "Start..."
                  : canStart
                  ? "Start spel"
                  : "Minimaal 2 spelers nodig"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.hostWaitingBox}>
              <Text style={styles.hostWaitingText}>Wachten op host</Text>
            </View>
          )}

          <Pressable style={styles.leaveButtonWide} onPress={handleLeaveRoom}>
            <Text style={styles.leaveButtonText}>Verlaat tafel</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function RoomCodeCard({
  code,
  onCopy,
  onShare,
}: {
  code: string;
  onCopy: () => void;
  onShare: () => void;
}) {
  return (
    <View style={styles.codeHeroCard}>
      <View style={styles.codeHeroCopy}>
        <Text style={styles.codeLabel}>Kamercode</Text>
        <Text
          style={styles.codeValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.74}
        >
          {code}
        </Text>
      </View>

      <View style={styles.codeActionsVertical}>
        <Pressable style={styles.codeActionButton} onPress={onCopy}>
          <Text style={styles.codeActionText}>Kopieer</Text>
        </Pressable>

        <Pressable style={styles.codeActionButtonGold} onPress={onShare}>
          <Text style={styles.codeActionTextGold}>Delen</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LobbyPlayerSlot({
  player,
  isMe,
  isRoomHost,
}: {
  player: PublicPlayer;
  isMe: boolean;
  isRoomHost: boolean;
}) {
  return (
    <View
      style={[
        styles.playerRowCard,
        !player.connected && styles.playerSlotOffline,
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
            player.connected ? styles.slotStatusOnline : styles.slotStatusOffline,
          ]}
        />

        <View style={styles.readyMiniBadge}>
          <Text style={styles.readyMiniBadgeText}>
            {player.isBot ? "Bot" : player.connected ? "Online" : "Offline"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function EmptyPlayerSlot() {
  return (
    <View style={styles.emptySlotRow}>
      <View style={styles.emptyAvatar}>
        <Text style={styles.emptyAvatarText}>+</Text>
      </View>

      <View style={styles.emptySlotCopy}>
        <Text style={styles.emptySlotTitle}>Open plek</Text>
      </View>
    </View>
  );
}
