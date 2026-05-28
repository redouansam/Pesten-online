import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  ImageSourcePropType,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import {
  BottomNav,
  GameButton,
  GameModalFrame,
  GameModeCard,
  PlayerHeader,
  SectionHeader,
  SurfaceCard,
} from "./GameChrome";
import type { BottomNavKey } from "./GameChrome";
import {
  COINS_PER_GEM_PACK,
  DAILY_GEMS,
  DailyMission,
  GEM_PACK_COST,
  MilestoneReward,
  Wallet,
  dailyMissions,
  getDailyMissionProgress,
  getMilestoneProgress,
  milestoneRewards,
  seasonRewards,
} from "../economy";
import { cardBackOptions } from "../cardBackImages";
import type { CardBackOption } from "../cardBackImages";
import {
  avatarFrameOptions,
  avatarOptions,
  getAvatarFrameOption,
  getAvatarOption,
} from "../cosmetics";
import type { AvatarFrameOption, AvatarOption } from "../cosmetics";
import { coinImage, gemImage } from "../currencyImages";
import type { ConnectionState } from "../hooks/useRoomSocket";
import {
  matchmakingPreview,
  platformFeatureCards,
  previewFriends,
  type PlatformFeatureKey,
} from "../platformFeatures";
import type {
  AppSettings,
  CardSizeSetting,
  LanguageSetting,
  MotionSetting,
} from "../settings";
import { styles } from "../styles";
import { tableSkinOptions } from "../tableSkins";
import type { TableSkinOption } from "../tableSkins";
import type { PublicRoomSummary } from "../types";
import type {
  PlayerProfileFoundation,
  RecentPlayer,
} from "../profileFoundation";

type SeasonProgress = {
  level: number;
  progressXp: number;
  nextLevelXp: number;
  progressPercent: number;
};

type ShopTab =
  | "wallet"
  | "cardbacks"
  | "tables"
  | "avatars"
  | "frames"
  | "season";
type CardBackFilter = "all" | "buyable" | "owned" | "locked";
type ShopPreview =
  | {
      kind: "cardback";
      item: CardBackOption;
    }
  | {
      kind: "table";
      item: TableSkinOption;
    }
  | {
      kind: "avatar";
      item: AvatarOption;
    }
  | {
      kind: "frame";
      item: AvatarFrameOption;
    };

type RuleSection = {
  title: string;
  intro: string;
  rules: Array<{
    label: string;
    title: string;
    text: string;
  }>;
};

const shopTabs: Array<{ key: ShopTab; label: string }> = [
  { key: "wallet", label: "Munten" },
  { key: "cardbacks", label: "Backs" },
  { key: "tables", label: "Tafels" },
  { key: "avatars", label: "Avatars" },
  { key: "frames", label: "Frames" },
  { key: "season", label: "Season" },
];

const pestenRuleSections: RuleSection[] = [
  {
    title: "Basis",
    intro: "Leg alleen kaarten die passen bij de situatie op tafel.",
    rules: [
      {
        label: "Leg",
        title: "Geldige kaart",
        text: "Een kaart mag alleen gelegd worden als kleur/symbool, waarde of het actieve gekozen symbool klopt.",
      },
      {
        label: "Boer",
        title: "Gekozen symbool is leidend",
        text: "Na een Boer telt het gekozen symbool. Het symbool dat op de Boer staat is dan niet leidend.",
      },
      {
        label: "Pak",
        title: "Geen geldige kaart",
        text: "Als je geen geldige kaart hebt, pak je volgens de bestaande gameflow en kun je daarna spelen of passen als dat mag.",
      },
      {
        label: "Stapel",
        title: "Trekstapel leeg",
        text: "Als de trekstapel leeg is, wordt de aflegstapel geschud en speel je gewoon door.",
      },
    ],
  },
  {
    title: "Straf Stapelen",
    intro: "Pakstraffen blijven actief tot iemand de straf pakt.",
    rules: [
      {
        label: "2",
        title: "Pak 2",
        text: "De volgende speler pakt 2 kaarten, tenzij die speler stapelt met een 2 of Joker.",
      },
      {
        label: "Joker",
        title: "Pak 5",
        text: "De volgende speler pakt 5 kaarten. Ook Joker mag gestapeld worden met 2 of Joker.",
      },
      {
        label: "+",
        title: "Straf telt op",
        text: "Bij stapelen telt de straf op. Een 2 en Joker samen maken dus een hogere pakstraf.",
      },
      {
        label: "Na pak",
        title: "Daarna verder",
        text: "Na het pakken van strafkaarten mag de speler daarna verder volgens de actieve regel en symboolsituatie.",
      },
    ],
  },
  {
    title: "Speciale Kaarten",
    intro: "Pestkaarten veranderen beurt, richting of wat je hierna moet doen.",
    rules: [
      {
        label: "7",
        title: "Alles geven",
        text: "Na een 7 mag je doorgaan met kaarten van hetzelfde symbool. Je mag niet zomaar elke kaart leggen.",
      },
      {
        label: "7",
        title: "7-reeks beperken",
        text: "Bij een 7-reeks mag alleen hetzelfde symbool of een geldige vervolgkaart volgens de regel. Een verkeerde kaart stopt niet zomaar de reeks.",
      },
      {
        label: "8",
        title: "Slaan",
        text: "De volgende speler wordt overgeslagen.",
      },
      {
        label: "J",
        title: "Boer kiest symbool",
        text: "De speler kiest een nieuw symbool. Dat gekozen symbool bepaalt wat hierna geldig is.",
      },
      {
        label: "K",
        title: "Heer extra kaart",
        text: "Na een Heer moet je precies 1 extra kaart leggen.",
      },
      {
        label: "K",
        title: "Geen extra kaart",
        text: "Kun je na een Heer geen extra kaart leggen, dan moet je 1 kaart pakken.",
      },
      {
        label: "A",
        title: "Aas draait",
        text: "De speelrichting draait om.",
      },
    ],
  },
  {
    title: "Eindigen",
    intro: "Uitgaan mag, maar niet met een pestkaart.",
    rules: [
      {
        label: "Pest",
        title: "Niet eindigen met pest",
        text: "Je mag niet eindigen met een pestkaart.",
      },
      {
        label: "A 2 7 8 J K",
        title: "Pestkaarten",
        text: "Pestkaarten zijn minimaal Aas, 2, 7, 8, Boer/Jack, Heer/King en Joker.",
      },
      {
        label: "Uit",
        title: "Straf bij verkeerd uitgaan",
        text: "Als je probeert te eindigen met een pestkaart, moet je strafkaarten pakken volgens onze game-regel.",
      },
    ],
  },
];

export function LobbyScreen({
  name,
  hasSavedName,
  setName,
  roomCodeInput,
  setRoomCodeInput,
  createRoom,
  joinRoom,
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
  clearEconomyNotice,
  entryCostCoins,
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
}: {
  name: string;
  hasSavedName: boolean;
  setName: (value: string) => void;
  roomCodeInput: string;
  setRoomCodeInput: (value: string) => void;
  createRoom: () => void;
  joinRoom: () => void;
  quickPlay: () => void;
  listPublicRooms: () => void;
  joinPublicRoom: (code: string) => void;
  publicRooms: PublicRoomSummary[];
  matchmakingStatus: string | null;
  profileFoundation: PlayerProfileFoundation;
  recentPlayers: RecentPlayer[];
  connected: boolean;
  connectionState: ConnectionState;
  pendingAction: string | null;
  errorMessage: string | null;
  clearError: () => void;
  retryConnection: () => void;
  wallet: Wallet;
  season: SeasonProgress;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  economyNotice: string | null;
  clearEconomyNotice: () => void;
  entryCostCoins: number;
  buyCoinsWithGems: () => void;
  claimDailyGems: () => void;
  canClaimDailyGems: boolean;
  previewPremiumPass: () => void;
  previewGemPurchase: () => void;
  buyCardBack: (cardBackId: string) => void;
  selectCardBack: (cardBackId: string) => void;
  buyTableSkin: (tableSkinId: string) => void;
  selectTableSkin: (tableSkinId: string) => void;
  buyAvatar: (avatarId: string) => void;
  selectAvatar: (avatarId: string) => void;
  buyAvatarFrame: (frameId: string) => void;
  selectAvatarFrame: (frameId: string) => void;
  claimDailyMission: (missionId: string) => void;
  claimSeasonReward: (rewardId: string) => void;
  claimMilestoneReward: (rewardId: string) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const compactHome = screenWidth < 380;
  const scrollRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState<BottomNavKey>("play");
  const [showShop, setShowShop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showSocial, setShowSocial] = useState(false);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string | null>(
    null
  );

  const normalizedRoomCode = roomCodeInput
    .trim()
    .toUpperCase()
    .replace(/\s/g, "");
  const roomCodeReady = normalizedRoomCode.length === 5;
  const creatingRoom = pendingAction === "create";
  const joiningRoom = pendingAction === "join";
  const quickPlaying = pendingAction === "quick";
  const listingPublicRooms = pendingAction === "listPublic";
  const joiningPublicRoom = pendingAction === "joinPublic";
  const isBusy = pendingAction !== null;
  const profileReady = hasSavedName && name.trim().length > 0;
  const draftNameReady = draftName.trim().length > 0;
  const playDisabled = !connected || isBusy || !profileReady;
  const selectedCardBack =
    cardBackOptions.find((cardBack) => cardBack.id === wallet.selectedCardBackId) ??
    cardBackOptions[0];
  const selectedTableSkin =
    tableSkinOptions.find((tableSkin) => tableSkin.id === wallet.selectedTableSkinId) ??
    tableSkinOptions[0];
  const selectedAvatar = getAvatarOption(wallet.selectedAvatarId);
  const selectedAvatarFrame = getAvatarFrameOption(wallet.selectedAvatarFrameId);
  const displayName = profileReady ? name : "Nieuwe speler";
  const avatarLabel =
    selectedAvatar.badge || name.slice(0, 1).toUpperCase() || "P";

  useEffect(() => {
    setDraftName(name);
  }, [name]);

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!settingsSavedMessage) return;

    const timer = setTimeout(() => setSettingsSavedMessage(null), 2200);

    return () => clearTimeout(timer);
  }, [settingsSavedMessage]);

  useEffect(() => {
    if (activeTab !== "social" || !connected || !profileReady) return;

    listPublicRooms();
  }, [activeTab, connected, profileReady]);

  useEffect(() => {
    const timer = setTimeout(() => scrollToTop(false), 0);

    return () => clearTimeout(timer);
  }, [activeTab]);

  function runLightHaptic() {
    if (!settings.hapticsEnabled) return;

    Haptics.selectionAsync().catch(() => {});
  }

  function goToTab(tab: BottomNavKey) {
    Keyboard.dismiss();
    if (activeTab === tab) {
      scrollToTop(true);
      return;
    }

    runLightHaptic();
    setActiveTab(tab);
  }

  function scrollToTop(animated: boolean) {
    scrollRef.current?.scrollTo({
      y: 0,
      animated,
    });
  }

  function saveProfileName() {
    if (!draftNameReady) return;

    runLightHaptic();
    Keyboard.dismiss();
    setName(draftName);
    setShowSettings(false);
    setActiveTab("play");
  }

  function updateDraftSettings(patch: Partial<AppSettings>) {
    setSettingsSavedMessage(null);
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      ...patch,
    }));
  }

  function saveProfileSettings() {
    if (!draftNameReady) return;

    runLightHaptic();
    Keyboard.dismiss();
    setName(draftName);
    updateSettings(draftSettings);
    setSettingsSavedMessage("Opgeslagen");
  }

  function openShop() {
    goToTab("shop");
  }

  function openSettings() {
    goToTab("profile");
  }

  function openRules() {
    goToTab("rules");
  }

  function openSocial() {
    goToTab("social");
  }

  function openMatchmaking() {
    goToTab("social");
    if (!connected || isBusy || !profileReady) return;

    quickPlay();
  }

  function openFriendsPreview() {
    goToTab("social");
    setShowSocial(true);
  }

  function handlePlatformFeaturePress(feature: PlatformFeatureKey) {
    if (feature === "matchmaking") {
      openMatchmaking();
      return;
    }

    if (feature === "publicRooms") {
      goToTab("social");
      listPublicRooms();
      return;
    }

    if (feature === "profiles") {
      goToTab("profile");
      return;
    }

    openFriendsPreview();
  }

  function claimDailyRewardFromHome() {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    claimDailyGems();
  }

  function createRoomFromHome() {
    Keyboard.dismiss();
    if (playDisabled) return;

    createRoom();
  }

  function joinRoomFromHome() {
    Keyboard.dismiss();
    if (!connected || !roomCodeReady || isBusy || !profileReady) return;

    joinRoom();
  }

  function joinPublicTable(code: string) {
    if (!connected || isBusy || !profileReady) return;

    joinPublicRoom(code);
  }

  const activeMission =
    dailyMissions.find((mission) => {
      const progress = getDailyMissionProgress(wallet, mission);
      return (
        progress >= mission.target &&
        !wallet.dailyMissionClaims.includes(mission.id)
      );
    }) ??
    dailyMissions.find(
      (mission) => !wallet.dailyMissionClaims.includes(mission.id)
    );
  const activeMissionProgress = activeMission
    ? getDailyMissionProgress(wallet, activeMission)
    : 0;
  const activeMissionPercent = activeMission
    ? Math.min(
        100,
        Math.round((activeMissionProgress / activeMission.target) * 100)
      )
    : 100;
  const activeMissionReady =
    !!activeMission &&
    activeMissionProgress >= activeMission.target &&
    !wallet.dailyMissionClaims.includes(activeMission.id);
  const homeFeatureCards = platformFeatureCards.filter((feature) =>
    ["publicRooms", "friends"].includes(feature.key)
  );
  const tabOrder: BottomNavKey[] = ["play", "social", "shop", "rules", "profile"];
  const tabSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 28 && Math.abs(gesture.dy) < 24,
        onPanResponderRelease: (_, gesture) => {
          const index = tabOrder.indexOf(activeTab);
          if (gesture.dx < -52) {
            const nextTab = tabOrder[Math.min(tabOrder.length - 1, index + 1)];
            if (nextTab) goToTab(nextTab);
          }
          if (gesture.dx > 52) {
            const nextTab = tabOrder[Math.max(0, index - 1)];
            if (nextTab) goToTab(nextTab);
          }
        },
      }),
    [activeTab, settings.hapticsEnabled]
  );

  const lobbyContent = (
    <View style={styles.homeShell}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.homeScroll,
          compactHome && styles.homeScrollCompact,
        ]}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        showsVerticalScrollIndicator={false}
        bounces
      >
      <View style={[styles.homeCard, compactHome && styles.homeCardCompact]}>
        <PlayerHeader
          avatarBackgroundColor={selectedAvatar.backgroundColor}
          avatarFrameColor={selectedAvatarFrame.borderColor}
          avatarLabel={avatarLabel}
          avatarTextColor={selectedAvatar.textColor}
          coins={wallet.coins}
          gems={wallet.gems}
          level={season.level}
          name={displayName}
          onCurrencyPress={openShop}
          onProfilePress={openSettings}
          xpPercent={season.progressPercent}
        />

        <View style={[styles.gameBrandRow, compactHome && styles.gameBrandRowCompact]}>
          <View>
            <Text style={styles.gameBrandEyebrow}>Live arena</Text>
            <Text
              style={[
                styles.gameBrandTitle,
                compactHome && styles.gameBrandTitleCompact,
              ]}
            >
              Pesten Online
            </Text>
          </View>

          <View style={styles.gameOnlinePill}>
            <View
              style={[
                styles.connectionDot,
                connected ? styles.connectionDotOn : styles.connectionDotOff,
              ]}
            />
            <Text style={styles.gameOnlineText}>
              {connected ? "Online" : "Offline"}
            </Text>
          </View>
        </View>

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
                Server wordt wakker of je verbinding herstelt. Dit kan 30-60 sec duren.
              </Text>
            </View>
            <Pressable style={styles.connectionRetryButton} onPress={retryConnection}>
              <Text style={styles.connectionRetryText}>Opnieuw</Text>
            </Pressable>
          </View>
        ) : null}

        {errorMessage ? (
          <Pressable style={styles.errorBanner} onPress={clearError}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </Pressable>
        ) : null}

        {isBusy ? (
          <View style={styles.loadingBanner}>
            <Text style={styles.loadingBannerText}>
              {creatingRoom
                ? "Kamer openen..."
                : joiningRoom
                ? "Kamer zoeken..."
                : quickPlaying
                ? "Online tafel zoeken..."
                : joiningPublicRoom
                ? "Open tafel joinen..."
                : "Even verwerken..."}
            </Text>
          </View>
        ) : null}

        {economyNotice && activeTab !== "shop" ? (
          <Pressable style={styles.economyNotice} onPress={clearEconomyNotice}>
            <Text style={styles.economyNoticeText}>{economyNotice}</Text>
          </Pressable>
        ) : null}

        {!profileReady ? (
          <ProfileSetup
            draftName={draftName}
            draftNameReady={draftNameReady}
            setDraftName={(value) => {
              clearError();
              setDraftName(value);
            }}
            saveProfileName={saveProfileName}
          />
        ) : (
          <View style={styles.homeBody} {...tabSwipeResponder.panHandlers}>
            {activeTab === "play" ? (
              <View style={[styles.tabPage, compactHome && styles.tabPageCompact]}>
                <LinearGradient
                  colors={["#10201d", "#152823", "#10201d"]}
                  style={[
                    styles.gameModeHero,
                    compactHome && styles.gameModeHeroCompact,
                  ]}
                >
                  <View
                    style={[
                      styles.gameModeHeader,
                      compactHome && styles.gameModeHeaderCompact,
                    ]}
                  >
                    <View style={styles.gameModeBadge}>
                      <Text style={styles.gameModeBadgeText}>Vriendentafel</Text>
                    </View>

                    <View style={styles.gameEntryBadge}>
                      <Text style={styles.gameEntryLabel}>Inzet</Text>
                      <Text style={styles.gameEntryValue}>{entryCostCoins}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.gameModeBody,
                      compactHome && styles.gameModeBodyCompact,
                    ]}
                  >
                    <View
                      style={[
                        styles.gameArenaStage,
                        compactHome && styles.gameArenaStageCompact,
                      ]}
                    >
                      <View
                        style={[
                          styles.gameArenaPlate,
                          compactHome && styles.gameArenaPlateCompact,
                          {
                            borderColor: "rgba(210,168,78,0.42)",
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.gameTableSkinPreview,
                            compactHome && styles.gameTableSkinPreviewCompact,
                            {
                              borderColor: "rgba(210,168,78,0.38)",
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.gameTableSkinRail,
                              compactHome && styles.gameTableSkinRailCompact,
                              {
                                backgroundColor: selectedTableSkin.railColors[0],
                                borderColor: "rgba(210,168,78,0.34)",
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.gameTableSkinFelt,
                              compactHome && styles.gameTableSkinFeltCompact,
                              {
                                backgroundColor: selectedTableSkin.feltColors[0],
                                borderColor: "rgba(247,243,236,0.18)",
                              },
                            ]}
                          />
                        </View>

                        <View
                          style={[
                            styles.gameDeckStack,
                            styles.gameDeckStackLeft,
                          ]}
                        >
                          <Image
                            source={selectedCardBack.image}
                            style={[
                              styles.gameDeckPreview,
                              styles.gameDeckPreviewBack,
                              compactHome && styles.gameDeckPreviewCompact,
                            ]}
                            resizeMode="cover"
                          />
                          <Image
                            source={selectedCardBack.image}
                            style={[
                              styles.gameDeckPreview,
                              compactHome && styles.gameDeckPreviewCompact,
                            ]}
                            resizeMode="cover"
                          />
                        </View>

                        <View style={styles.gameDeckStack}>
                          <Image
                            source={selectedCardBack.image}
                            style={[
                              styles.gameDeckPreview,
                              styles.gameDeckPreviewBack,
                              compactHome && styles.gameDeckPreviewCompact,
                            ]}
                            resizeMode="cover"
                          />
                          <Image
                            source={selectedCardBack.image}
                            style={[
                              styles.gameDeckPreview,
                              compactHome && styles.gameDeckPreviewCompact,
                            ]}
                            resizeMode="cover"
                          />
                        </View>
                      </View>
                    </View>

                    <View style={styles.gameModeCopy}>
                      <Text
                        style={[
                          styles.gameModeTitle,
                          compactHome && styles.gameModeTitleCompact,
                        ]}
                      >
                        Speel nu
                      </Text>
                      <Text
                        style={[
                          styles.gameModeText,
                          compactHome && styles.gameModeTextCompact,
                        ]}
                        numberOfLines={2}
                      >
                        Maak een tafel, deel je code en speel direct met vrienden.
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    style={[
                      styles.gameStartButton,
                      compactHome && styles.gameStartButtonCompact,
                      playDisabled && styles.disabledButton,
                    ]}
                    onPress={createRoomFromHome}
                    disabled={playDisabled}
                  >
                    <Text style={styles.gameStartButtonText}>
                      {creatingRoom ? "Tafel openen..." : "Nieuwe tafel"}
                    </Text>
                    <Text style={styles.gameStartButtonSub}>2-4 spelers</Text>
                  </Pressable>
                </LinearGradient>

                <Pressable
                  style={[
                    styles.homeQuickPlayCard,
                    quickPlaying && styles.homeQuickPlayCardActive,
                    (!connected || isBusy || !profileReady) && styles.disabledButton,
                  ]}
                  onPress={openMatchmaking}
                  disabled={!connected || isBusy || !profileReady}
                >
                  <View style={styles.homeQuickPlayCopy}>
                    <View style={styles.homeQuickPlayTitleRow}>
                      <Text style={styles.homeQuickPlayTitle}>
                        Snel online spelen
                      </Text>
                      <View style={styles.homeQuickPlayBadge}>
                        <Text style={styles.homeQuickPlayBadgeText}>Live</Text>
                      </View>
                    </View>
                    <Text style={styles.homeQuickPlayText}>
                      {quickPlaying
                        ? "Online tafel zoeken..."
                        : matchmakingStatus ?? "Zoek automatisch een beschikbare tafel."}
                    </Text>
                  </View>

                  <View style={styles.homeQuickPlayButton}>
                    <Text style={styles.homeQuickPlayButtonText}>
                      {quickPlaying ? "..." : "Snelspel"}
                    </Text>
                  </View>
                </Pressable>

                <View
                  style={[
                    styles.gameJoinPanel,
                    compactHome && styles.gameJoinPanelCompact,
                  ]}
                >
                  <View style={styles.gameJoinHeader}>
                    <Text style={styles.gameJoinTitle}>Kamercode</Text>
                    <Text style={styles.gameJoinHint}>5 tekens</Text>
                  </View>

                  <View style={styles.gameJoinInlineRow}>
                    <TextInput
                      style={[
                        styles.gameCodeInput,
                        compactHome && styles.gameCodeInputCompact,
                      ]}
                      value={roomCodeInput}
                      onChangeText={(value) => {
                        clearError();
                        setRoomCodeInput(
                          value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                        );
                      }}
                      placeholder="ABC12"
                      placeholderTextColor="#7f8797"
                      autoCapitalize="characters"
                      autoComplete="off"
                      autoCorrect={false}
                      maxLength={5}
                      returnKeyType="join"
                      blurOnSubmit
                      onSubmitEditing={joinRoomFromHome}
                    />

                    <Pressable
                      style={[
                        styles.gameJoinButton,
                        compactHome && styles.gameJoinButtonCompact,
                        (!connected || !roomCodeReady || isBusy || !profileReady) &&
                          styles.disabledButton,
                      ]}
                      onPress={joinRoomFromHome}
                      disabled={!connected || !roomCodeReady || isBusy || !profileReady}
                    >
                      <Text style={styles.gameJoinButtonText}>
                        {joiningRoom ? "..." : "Join"}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <SurfaceCard
                  subdued
                  style={[
                    styles.homeSection,
                    compactHome && styles.homeSectionCompact,
                  ]}
                >
                  <SectionHeader
                    title="Online opties"
                    subtitle="Zoeken, open tafels en vrienden blijven klaar voor later."
                    actionLabel="Sociaal"
                    onAction={openSocial}
                  />

                  <View style={styles.gameModeGrid}>
                    {homeFeatureCards.map((feature) => (
                      <GameModeCard
                        key={feature.key}
                        badge={feature.badge}
                        icon={feature.icon}
                        tone={feature.tone}
                        onPress={() => handlePlatformFeaturePress(feature.key)}
                        subtitle={feature.subtitle}
                        title={feature.title}
                      />
                    ))}
                  </View>
                </SurfaceCard>

                <SurfaceCard
                  subdued
                  style={[
                    styles.homeSection,
                    compactHome && styles.homeSectionCompact,
                  ]}
                >
                  <SectionHeader
                    title="Vandaag"
                    subtitle="Beloningen en voortgang zonder drukte."
                    actionLabel="Shop"
                    onAction={openShop}
                  />

                  <View
                    style={[
                      styles.gameRewardGrid,
                      compactHome && styles.gameRewardGridCompact,
                    ]}
                  >
                    <Pressable
                      style={[
                        styles.gameRewardTile,
                        !canClaimDailyGems && styles.gameRewardTileMuted,
                      ]}
                      onPress={claimDailyRewardFromHome}
                      disabled={!canClaimDailyGems}
                    >
                      <Image source={gemImage} style={styles.gameRewardIcon} />
                      <View style={styles.gameRewardCopy}>
                        <Text style={styles.gameRewardTitle}>Daily</Text>
                        <Text style={styles.gameRewardText}>
                          {canClaimDailyGems
                            ? `+${DAILY_GEMS} gems klaar`
                            : "Morgen weer"}
                        </Text>
                      </View>
                      {canClaimDailyGems ? (
                        <View style={styles.gameNoticeDot}>
                          <Text style={styles.gameNoticeDotText}>1</Text>
                        </View>
                      ) : null}
                    </Pressable>

                    {activeMission ? (
                    <Pressable
                      style={styles.gameMissionTile}
                      onPress={() => {
                        if (activeMissionReady) {
                          claimDailyMission(activeMission.id);
                        } else {
                          openShop();
                        }
                      }}
                    >
                      <View style={styles.gameMissionTopRow}>
                        <Text style={styles.gameMissionTitle} numberOfLines={1}>
                          {activeMission.title}
                        </Text>
                        <Text style={styles.gameMissionCount}>
                          {Math.min(activeMissionProgress, activeMission.target)}/
                          {activeMission.target}
                        </Text>
                      </View>
                      <View style={styles.gameMissionTrack}>
                        <View
                          style={[
                            styles.gameMissionFill,
                            {
                              width: `${activeMissionPercent}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.gameMissionReward}>
                        {activeMissionReady ? "Claim reward" : "Missie"}
                      </Text>
                    </Pressable>
                    ) : null}
                  </View>
                </SurfaceCard>
              </View>
            ) : null}

            {activeTab === "social" ? (
              <View style={styles.tabPage}>
                <SurfaceCard subdued style={styles.tabHeroCard}>
                  <SectionHeader
                    title="Online spelen"
                    subtitle="Vind automatisch een tafel of sluit aan bij open tafels."
                  />

                  <Pressable
                    style={[
                      styles.matchmakingStatusCard,
                      (quickPlaying || matchmakingStatus) && styles.milestoneCardReady,
                    ]}
                    onPress={openMatchmaking}
                    disabled={!connected || quickPlaying || !profileReady}
                  >
                    <View style={styles.matchmakingPulse} />
                    <View style={styles.matchmakingStatusCopy}>
                      <Text style={styles.matchmakingStatusTitle}>
                        {quickPlaying ? "Online tafel zoeken..." : "Snelspel"}
                      </Text>
                      <Text style={styles.matchmakingStatusText}>
                        {matchmakingStatus ??
                          `${matchmakingPreview.region} - ${matchmakingPreview.ruleset}`}
                      </Text>
                    </View>
                    <Text style={styles.matchmakingWaitText}>
                      {quickPlaying ? "..." : "Start"}
                    </Text>
                  </Pressable>
                </SurfaceCard>

                <SurfaceCard subdued style={styles.publicRoomPreviewList}>
                  <View style={styles.publicRoomPreviewHeader}>
                    <Text style={styles.publicRoomPreviewTitle}>Open tafels</Text>
                    <Pressable onPress={listPublicRooms} disabled={listingPublicRooms}>
                      <Text style={styles.publicRoomPreviewMeta}>
                        {listingPublicRooms ? "Laden..." : "Refresh"}
                      </Text>
                    </Pressable>
                  </View>

                  {publicRooms.length === 0 ? (
                    <View style={styles.publicRoomPreviewRow}>
                      <View style={styles.publicRoomIcon}>
                        <Text style={styles.publicRoomIconText}>0/4</Text>
                      </View>
                      <View style={styles.friendPreviewCopy}>
                        <Text style={styles.friendPreviewName}>Geen open tafels</Text>
                        <Text style={styles.friendPreviewStatus}>
                          Start snelspel om er een te maken.
                        </Text>
                      </View>
                      <Pressable
                        style={styles.friendPreviewButton}
                        onPress={openMatchmaking}
                        disabled={quickPlaying}
                      >
                        <Text style={styles.friendPreviewButtonText}>Snelspel</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {publicRooms.map((publicRoom) => (
                    <Pressable
                      key={publicRoom.code}
                      style={styles.publicRoomPreviewRow}
                      onPress={() => joinPublicTable(publicRoom.code)}
                      disabled={joiningPublicRoom}
                    >
                      <View style={styles.publicRoomIcon}>
                        <Text style={styles.publicRoomIconText}>
                          {publicRoom.playerCount}/{publicRoom.maxPlayers}
                        </Text>
                      </View>
                      <View style={styles.friendPreviewCopy}>
                        <Text style={styles.friendPreviewName}>
                          {publicRoom.hostName}
                        </Text>
                        <Text style={styles.friendPreviewStatus}>
                          {publicRoom.mode === "quick" ? "Snelspel" : "Casual"} - {publicRoom.region}
                        </Text>
                      </View>
                      <View style={styles.friendPreviewButton}>
                        <Text style={styles.friendPreviewButtonText}>
                          Join
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </SurfaceCard>

                <SurfaceCard subdued style={styles.friendPreviewList}>
                  <View style={styles.publicRoomPreviewHeader}>
                    <View>
                      <Text style={styles.publicRoomPreviewTitle}>Vrienden</Text>
                      <Text style={styles.friendPreviewStatus}>
                        Vrienden komen later met accounts.
                      </Text>
                    </View>
                    <Pressable
                      style={styles.friendPreviewButton}
                      onPress={() => goToTab("profile")}
                    >
                      <Text style={styles.friendPreviewButtonText}>Profiel</Text>
                    </Pressable>
                  </View>

                  <View style={styles.socialProfileCard}>
                    <View style={styles.socialProfileLevel}>
                      <Text style={styles.socialProfileLevelText}>
                        Lv {season.level}
                      </Text>
                    </View>
                    <View style={styles.socialProfileCopy}>
                      <Text style={styles.socialProfileName}>{displayName}</Text>
                      <Text style={styles.socialProfileText}>
                        Lokale stats zijn actief. Invites komen later.
                      </Text>
                    </View>
                  </View>

                  {recentPlayers.length > 0 ? (
                    <View style={styles.publicRoomPreviewHeader}>
                      <Text style={styles.publicRoomPreviewTitle}>Recent gespeeld</Text>
                      <Text style={styles.publicRoomPreviewMeta}>Lokaal</Text>
                    </View>
                  ) : null}

                  {recentPlayers.map((recentPlayer) => (
                    <View key={recentPlayer.playerId} style={styles.friendPreviewRow}>
                      <View style={styles.friendPreviewAvatar}>
                        <Text style={styles.friendPreviewAvatarText}>
                          {recentPlayer.name.slice(0, 1)}
                        </Text>
                      </View>
                      <View style={styles.friendPreviewCopy}>
                        <Text style={styles.friendPreviewName}>
                          {recentPlayer.name}
                        </Text>
                        <Text style={styles.friendPreviewStatus}>
                          {recentPlayer.result === "win"
                            ? "Laatste potje gewonnen"
                            : "Laatste potje gespeeld"}
                        </Text>
                      </View>
                      <View style={styles.friendPreviewButton}>
                        <Text style={styles.friendPreviewButtonText}>Invite later</Text>
                      </View>
                    </View>
                  ))}

                  {previewFriends.map((friend) => (
                    <View key={friend.name} style={styles.friendPreviewRow}>
                      <View style={styles.friendPreviewAvatar}>
                        <Text style={styles.friendPreviewAvatarText}>
                          {friend.name.slice(0, 1)}
                        </Text>
                      </View>
                      <View style={styles.friendPreviewCopy}>
                        <Text style={styles.friendPreviewName}>{friend.name}</Text>
                        <Text style={styles.friendPreviewStatus}>
                          {friend.status}
                        </Text>
                      </View>
                      <View style={styles.friendPreviewButton}>
                        <Text style={styles.friendPreviewButtonText}>
                          {friend.cta}
                        </Text>
                      </View>
                    </View>
                  ))}
                </SurfaceCard>
              </View>
            ) : null}

            {activeTab === "shop" ? (
              <View style={styles.tabPage}>
                <SurfaceCard subdued style={styles.tabHeroCard}>
                  <SectionHeader
                    title="Markt"
                    subtitle="Cosmetics, rewards en valuta overzichtelijk bij elkaar."
                  />
                </SurfaceCard>

                {economyNotice ? (
                  <Pressable style={styles.shopNotice} onPress={clearEconomyNotice}>
                    <Text style={styles.shopNoticeText}>{economyNotice}</Text>
                  </Pressable>
                ) : null}

                <EconomyPanel
                  wallet={wallet}
                  season={season}
                  hapticsEnabled={settings.hapticsEnabled}
                  buyCoinsWithGems={buyCoinsWithGems}
                  claimDailyGems={claimDailyGems}
                  canClaimDailyGems={canClaimDailyGems}
                  previewPremiumPass={previewPremiumPass}
                  previewGemPurchase={previewGemPurchase}
                  buyCardBack={buyCardBack}
                  selectCardBack={selectCardBack}
                  buyTableSkin={buyTableSkin}
                  selectTableSkin={selectTableSkin}
                  buyAvatar={buyAvatar}
                  selectAvatar={selectAvatar}
                  buyAvatarFrame={buyAvatarFrame}
                  selectAvatarFrame={selectAvatarFrame}
                  claimDailyMission={claimDailyMission}
                  claimSeasonReward={claimSeasonReward}
                  claimMilestoneReward={claimMilestoneReward}
                />
              </View>
            ) : null}

            {activeTab === "rules" ? (
              <View style={[styles.tabPage, styles.rulesList]}>
                <SurfaceCard subdued style={styles.tabHeroCard}>
                  <SectionHeader
                    title="Spelregels"
                    subtitle="Volledige Pesten-variant, kort en scanbaar."
                  />
                </SurfaceCard>
                {pestenRuleSections.map((section) => (
                  <RuleSectionView key={section.title} section={section} />
                ))}
              </View>
            ) : null}

            {activeTab === "profile" ? (
              <View style={styles.tabPage}>
                <SurfaceCard subdued style={styles.tabHeroCard}>
                  <SectionHeader
                    title="Profiel"
                    subtitle="Stats lokaal bewaard; vrienden komen later met accounts."
                  />
                </SurfaceCard>

                <SurfaceCard subdued style={styles.friendPreviewList}>
                  <View style={styles.socialProfileCard}>
                    <View style={styles.socialProfileLevel}>
                      <Text style={styles.socialProfileLevelText}>
                        Lv {profileFoundation.level}
                      </Text>
                    </View>
                    <View style={styles.socialProfileCopy}>
                      <Text style={styles.socialProfileName}>
                        {profileFoundation.playerName}
                      </Text>
                      <Text style={styles.socialProfileText}>
                        {profileFoundation.onlineStatus === "online"
                          ? "Online"
                          : "Verbinding herstellen"}{" "}
                        - {profileFoundation.xp} XP
                      </Text>
                    </View>
                  </View>

                  <View style={styles.gameRewardGrid}>
                    <View style={styles.gameRewardTile}>
                      <View style={styles.gameRewardCopy}>
                        <Text style={styles.gameRewardTitle}>Potjes</Text>
                        <Text style={styles.gameRewardText}>
                          {profileFoundation.gamesPlayed}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.gameRewardTile}>
                      <View style={styles.gameRewardCopy}>
                        <Text style={styles.gameRewardTitle}>Winst</Text>
                        <Text style={styles.gameRewardText}>
                          {profileFoundation.wins} / {profileFoundation.losses}
                        </Text>
                      </View>
                    </View>
                  </View>
                </SurfaceCard>

                <SurfaceCard subdued style={styles.profileSettingsCard}>
                  <Text style={styles.inputLabel}>Spelersnaam</Text>
                  <TextInput
                    style={styles.input}
                    value={draftName}
                    onChangeText={setDraftName}
                    placeholder="Naam"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="words"
                    autoCorrect={false}
                    maxLength={18}
                    returnKeyType="done"
                    onSubmitEditing={saveProfileSettings}
                  />

                  <View style={styles.settingsGroup}>
                    <SettingSwitch
                      label="Haptics"
                      enabled={draftSettings.hapticsEnabled}
                      onPress={() =>
                        updateDraftSettings({
                          hapticsEnabled: !draftSettings.hapticsEnabled,
                        })
                      }
                    />
                    <SettingSegment<CardSizeSetting>
                      label="Kaarten"
                      value={draftSettings.cardSize}
                      options={[
                        { label: "Compact", value: "compact" },
                        { label: "Normaal", value: "normal" },
                        { label: "Groot", value: "large" },
                      ]}
                      onChange={(cardSize) => updateDraftSettings({ cardSize })}
                    />
                    <SettingSegment<MotionSetting>
                      label="Animatie"
                      value={draftSettings.motionLevel}
                      options={[
                        { label: "Rustig", value: "low" },
                        { label: "Normaal", value: "normal" },
                      ]}
                      onChange={(motionLevel) => updateDraftSettings({ motionLevel })}
                    />
                    <SettingSegment<LanguageSetting>
                      label="Taal"
                      value={draftSettings.language}
                      options={[
                        { label: "NL", value: "nl" },
                        { label: "EN", value: "en", disabled: true },
                      ]}
                      onChange={(language) => updateDraftSettings({ language })}
                    />
                  </View>

                  <Text style={styles.settingHelperText}>
                    Kaartgrootte en animatie gelden na opslaan direct in de speeltafel. Engels komt later.
                  </Text>

                  <GameButton
                    label={settingsSavedMessage ?? "Opslaan"}
                    onPress={saveProfileSettings}
                    disabled={!draftNameReady}
                  />
                </SurfaceCard>
              </View>
            ) : null}
          </View>
        )}

        <Modal visible={showShop} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <GameModalFrame
              eyebrow="Collectie"
              title="Shop"
              text="Unlock kaartbacks, tafels, avatars en frames."
              onClose={() => setShowShop(false)}
              frameStyle={styles.shopModalCard}
            >

              {economyNotice ? (
                <Pressable
                  style={styles.shopNotice}
                  onPress={clearEconomyNotice}
                >
                  <Text style={styles.shopNoticeText}>{economyNotice}</Text>
                </Pressable>
              ) : null}

              <ScrollView
                style={styles.shopModalScroll}
                showsVerticalScrollIndicator={false}
              >
                <EconomyPanel
                  wallet={wallet}
                  season={season}
                  hapticsEnabled={settings.hapticsEnabled}
                  buyCoinsWithGems={buyCoinsWithGems}
                  claimDailyGems={claimDailyGems}
                  canClaimDailyGems={canClaimDailyGems}
                  previewPremiumPass={previewPremiumPass}
                  previewGemPurchase={previewGemPurchase}
                  buyCardBack={buyCardBack}
                  selectCardBack={selectCardBack}
                  buyTableSkin={buyTableSkin}
                  selectTableSkin={selectTableSkin}
                  buyAvatar={buyAvatar}
                  selectAvatar={selectAvatar}
                  buyAvatarFrame={buyAvatarFrame}
                  selectAvatarFrame={selectAvatarFrame}
                  claimDailyMission={claimDailyMission}
                  claimSeasonReward={claimSeasonReward}
                  claimMilestoneReward={claimMilestoneReward}
                />
              </ScrollView>
            </GameModalFrame>
          </View>
        </Modal>

        <Modal visible={showMatchmaking} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <GameModalFrame
              eyebrow="Binnenkort"
              title="Online zoeken"
              text={`Voor straks: zoeken, matchen met spelers uit ${matchmakingPreview.region} en direct aan tafel.`}
              variant="dark"
              onClose={() => setShowMatchmaking(false)}
              frameStyle={styles.gameFeatureModalCard}
            >
              <View style={styles.featureModalHero}>
                <View style={styles.featureModalIcon}>
                  <Text style={styles.featureModalIconText}>NL</Text>
                </View>
                <View style={styles.featureModalCopy}>
                  <Text style={styles.featureModalEyebrow}>
                    {matchmakingPreview.ruleset}
                  </Text>
                  <Text style={styles.featureModalTitle}>Zoeken staat klaar</Text>
                  <Text style={styles.featureModalText}>
                    De UI is voorbereid. Backend matchmaking koppelen we later.
                  </Text>
                </View>
              </View>

              <View style={styles.featureRoadmapList}>
                <View style={styles.matchmakingStatusCard}>
                  <View style={styles.matchmakingPulse} />
                  <View style={styles.matchmakingStatusCopy}>
                    <Text style={styles.matchmakingStatusTitle}>
                      Spelers zoeken...
                    </Text>
                    <Text style={styles.matchmakingStatusText}>
                      {matchmakingPreview.region} - {matchmakingPreview.ruleset}
                    </Text>
                  </View>
                  <Text style={styles.matchmakingWaitText}>
                    ~{matchmakingPreview.estimatedWaitSeconds}s
                  </Text>
                </View>

                {matchmakingPreview.steps.map((step, index) => (
                  <View key={step} style={styles.featureRoadmapItem}>
                    <Text style={styles.featureRoadmapNumber}>{index + 1}</Text>
                    <Text style={styles.featureRoadmapText}>{step}</Text>
                  </View>
                ))}
              </View>

              <GameButton
                label="Klinkt goed"
                onPress={() => setShowMatchmaking(false)}
              />
            </GameModalFrame>
          </View>
        </Modal>

        <Modal visible={showSocial} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <GameModalFrame
              eyebrow="Social hub"
              title="Vrienden"
              text="Profielen, invites en vriendenlijst zijn voorbereid voor de live versie."
              variant="dark"
              onClose={() => setShowSocial(false)}
              frameStyle={styles.gameFeatureModalCard}
            >
              <View style={styles.featureModalHero}>
                <View
                  style={[
                    styles.featureModalIcon,
                    {
                      backgroundColor: selectedAvatar.backgroundColor,
                      borderColor: selectedAvatarFrame.borderColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.featureModalIconText,
                      {
                        color: selectedAvatar.textColor,
                      },
                    ]}
                  >
                    {selectedAvatar.badge || name.slice(0, 1).toUpperCase() || "P"}
                  </Text>
                </View>
                <View style={styles.featureModalCopy}>
                  <Text style={styles.featureModalEyebrow}>Preview</Text>
                  <Text style={styles.featureModalTitle}>Invite klaar</Text>
                  <Text style={styles.featureModalText}>
                    Later kun je spelers toevoegen na een potje of direct uitnodigen.
                  </Text>
                </View>
              </View>

              <View style={styles.friendPreviewList}>
                <View style={styles.socialProfileCard}>
                  <View style={styles.socialProfileLevel}>
                    <Text style={styles.socialProfileLevelText}>
                      Lv {season.level}
                    </Text>
                  </View>
                  <View style={styles.socialProfileCopy}>
                    <Text style={styles.socialProfileName}>{displayName}</Text>
                    <Text style={styles.socialProfileText}>
                      Profiel preview - later klikbaar voor stats en invite.
                    </Text>
                  </View>
                </View>

                {previewFriends.map((friend) => (
                  <View key={friend.name} style={styles.friendPreviewRow}>
                    <View style={styles.friendPreviewAvatar}>
                      <Text style={styles.friendPreviewAvatarText}>
                        {friend.name.slice(0, 1)}
                      </Text>
                    </View>
                    <View style={styles.friendPreviewCopy}>
                      <Text style={styles.friendPreviewName}>{friend.name}</Text>
                      <Text style={styles.friendPreviewStatus}>
                        {friend.status}
                      </Text>
                    </View>
                    <View style={styles.friendPreviewButton}>
                      <Text style={styles.friendPreviewButtonText}>
                        {friend.cta}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <GameButton
                label="Sluit"
                onPress={() => setShowSocial(false)}
                tone="secondary"
              />
            </GameModalFrame>
          </View>
        </Modal>

        <Modal visible={showSettings} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <GameModalFrame
              eyebrow="Profiel"
              title="Instellingen"
              text="Naam, haptics, kaartgrootte en taal."
              onClose={() => {
                setDraftName(name);
                setDraftSettings(settings);
                setSettingsSavedMessage(null);
                setShowSettings(false);
              }}
            >

              <Text style={styles.inputLabel}>Spelersnaam</Text>
              <TextInput
                style={styles.input}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Naam"
                placeholderTextColor="#9ca3af"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={18}
                returnKeyType="done"
                onSubmitEditing={saveProfileSettings}
              />

              <View style={styles.settingsGroup}>
                <SettingSwitch
                  label="Haptics"
                  enabled={draftSettings.hapticsEnabled}
                  onPress={() =>
                    updateDraftSettings({
                      hapticsEnabled: !draftSettings.hapticsEnabled,
                    })
                  }
                />

                <SettingSegment<CardSizeSetting>
                  label="Kaarten"
                  value={draftSettings.cardSize}
                  options={[
                    { label: "Compact", value: "compact" },
                    { label: "Normaal", value: "normal" },
                    { label: "Groot", value: "large" },
                  ]}
                  onChange={(cardSize) => updateDraftSettings({ cardSize })}
                />

                <SettingSegment<MotionSetting>
                  label="Animatie"
                  value={draftSettings.motionLevel}
                  options={[
                    { label: "Rustig", value: "low" },
                    { label: "Normaal", value: "normal" },
                  ]}
                  onChange={(motionLevel) => updateDraftSettings({ motionLevel })}
                />

                <SettingSegment<LanguageSetting>
                  label="Taal"
                  value={draftSettings.language}
                  options={[
                    { label: "NL", value: "nl" },
                    { label: "EN", value: "en", disabled: true },
                  ]}
                  onChange={(language) => updateDraftSettings({ language })}
                />
              </View>

              <Text style={styles.settingHelperText}>
                Kaartgrootte en animatie gelden na opslaan direct in de speeltafel. Engels komt later.
              </Text>

              <GameButton
                label={settingsSavedMessage ?? "Opslaan"}
                onPress={saveProfileSettings}
                disabled={!draftNameReady}
              />

              <GameButton
                label="Annuleren"
                tone="secondary"
                onPress={() => {
                  setDraftName(name);
                  setDraftSettings(settings);
                  setSettingsSavedMessage(null);
                  setShowSettings(false);
                }}
              />
            </GameModalFrame>
          </View>
        </Modal>

        <Modal visible={showRules} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <GameModalFrame
              eyebrow="Pesten"
              title="Spelregels"
              text="Kort en duidelijk, zodat niemand vastloopt."
              onClose={() => setShowRules(false)}
              frameStyle={styles.rulesModalCard}
            >

              <ScrollView
                style={styles.rulesScroll}
                contentContainerStyle={styles.rulesList}
                showsVerticalScrollIndicator={false}
              >
                {pestenRuleSections.map((section) => (
                  <RuleSectionView key={section.title} section={section} />
                ))}
              </ScrollView>

              <GameButton
                label="Ik snap het"
                onPress={() => setShowRules(false)}
              />
            </GameModalFrame>
          </View>
        </Modal>
      </View>
    </ScrollView>

    <View style={styles.homeBottomNavWrap}>
      <BottomNav
        active={activeTab}
        onProfile={openSettings}
        onRules={openRules}
        onShop={openShop}
        onSocial={openSocial}
        onPlay={() => goToTab("play")}
        shopBadge={canClaimDailyGems}
        socialBadge={publicRooms.length > 0}
      />
    </View>
  </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.keyboardScreen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {lobbyContent}
    </KeyboardAvoidingView>
  );
}

function RuleSectionView({ section }: { section: RuleSection }) {
  return (
    <View style={styles.ruleSectionCard}>
      <Text style={styles.ruleSectionTitle}>{section.title}</Text>
      <Text style={styles.ruleSectionIntro}>{section.intro}</Text>
      <View style={styles.ruleSectionList}>
        {section.rules.map((rule) => (
          <RuleItem
            key={`${section.title}-${rule.label}-${rule.title}`}
            label={rule.label}
            title={rule.title}
            text={rule.text}
          />
        ))}
      </View>
    </View>
  );
}

function RuleItem({
  label,
  title,
  text,
}: {
  label: string;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.ruleHelpItem}>
      <View style={styles.ruleHelpBadge}>
        <Text style={styles.ruleHelpBadgeText}>{label}</Text>
      </View>
      <View style={styles.ruleHelpCopy}>
        <Text style={styles.ruleHelpTitle}>{title}</Text>
        <Text style={styles.ruleHelpText}>{text}</Text>
      </View>
    </View>
  );
}

function ProfileSetup({
  draftName,
  draftNameReady,
  setDraftName,
  saveProfileName,
}: {
  draftName: string;
  draftNameReady: boolean;
  setDraftName: (value: string) => void;
  saveProfileName: () => void;
}) {
  return (
    <View style={styles.profileSetupCard}>
      <Text style={styles.profileSetupEyebrow}>Eerste keer?</Text>
      <Text style={styles.profileSetupTitle}>Kies je spelersnaam</Text>
      <Text style={styles.profileSetupText}>
        Eenmalig instellen. Later via Profiel.
      </Text>

      <TextInput
        style={styles.input}
        value={draftName}
        onChangeText={setDraftName}
        placeholder="Naam"
        placeholderTextColor="#9ca3af"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={18}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={saveProfileName}
      />

      <Pressable
        style={[styles.saveProfileButton, !draftNameReady && styles.disabledButton]}
        onPress={saveProfileName}
        disabled={!draftNameReady}
      >
        <Text style={styles.saveProfileButtonText}>Naam opslaan</Text>
      </Pressable>
    </View>
  );
}

function SettingSwitch({
  label,
  enabled,
  onPress,
}: {
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.settingRow}
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
    >
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={[styles.settingToggle, enabled && styles.settingToggleOn]}>
        <View
          style={[styles.settingToggleKnob, enabled && styles.settingToggleKnobOn]}
        />
      </View>
    </Pressable>
  );
}

function SettingSegment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{
    label: string;
    value: T;
    disabled?: boolean;
  }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.settingBlock}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingSegment}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.settingSegmentButton,
              value === option.value && styles.settingSegmentButtonOn,
              option.disabled && styles.settingSegmentButtonDisabled,
            ]}
            onPress={() => {
              if (!option.disabled) onChange(option.value);
            }}
            disabled={option.disabled}
            accessibilityState={{
              disabled: option.disabled,
              selected: value === option.value,
            }}
          >
            <Text
              style={[
                styles.settingSegmentText,
                value === option.value && styles.settingSegmentTextOn,
                option.disabled && styles.settingSegmentTextDisabled,
              ]}
            >
              {option.label}
            </Text>
            {option.disabled ? (
              <Text style={styles.settingSegmentSubText}>Binnenkort</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function EconomyPanel({
  wallet,
  season,
  hapticsEnabled,
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
}: {
  wallet: Wallet;
  season: SeasonProgress;
  hapticsEnabled: boolean;
  buyCoinsWithGems: () => void;
  claimDailyGems: () => void;
  canClaimDailyGems: boolean;
  previewPremiumPass: () => void;
  previewGemPurchase: () => void;
  buyCardBack: (cardBackId: string) => void;
  selectCardBack: (cardBackId: string) => void;
  buyTableSkin: (tableSkinId: string) => void;
  selectTableSkin: (tableSkinId: string) => void;
  buyAvatar: (avatarId: string) => void;
  selectAvatar: (avatarId: string) => void;
  buyAvatarFrame: (frameId: string) => void;
  selectAvatarFrame: (frameId: string) => void;
  claimDailyMission: (missionId: string) => void;
  claimSeasonReward: (rewardId: string) => void;
  claimMilestoneReward: (rewardId: string) => void;
}) {
  const selectedCardBack =
    cardBackOptions.find((cardBack) => cardBack.id === wallet.selectedCardBackId) ??
    cardBackOptions[0];
  const ownedBackCount = wallet.ownedCardBackIds.length;
  const collectionProgress = Math.round(
    (ownedBackCount / cardBackOptions.length) * 100
  );
  const [activeShopTab, setActiveShopTab] = useState<ShopTab>("wallet");
  const [cardBackFilter, setCardBackFilter] =
    useState<CardBackFilter>("all");
  const [preview, setPreview] = useState<ShopPreview | null>(null);
  const featuredCardBack =
    cardBackOptions.find((cardBack) => {
      const owned =
        wallet.ownedCardBackIds.includes(cardBack.id) ||
        (cardBack.premium && wallet.premiumPass);
      const levelLocked = Boolean(
        cardBack.unlockLevel && season.level < cardBack.unlockLevel
      );

      return !owned && !cardBack.premium && !levelLocked;
    }) ?? selectedCardBack;
  const cardBackStats = cardBackOptions.reduce(
    (stats, cardBack) => {
      const state = getCardBackShopState(cardBack, wallet, season);

      if (state.owned) stats.owned += 1;
      if (state.canBuy) stats.buyable += 1;
      if (!state.owned && !state.canBuy) stats.locked += 1;

      return stats;
    },
    {
      buyable: 0,
      locked: 0,
      owned: 0,
    }
  );
  const filteredCardBacks = cardBackOptions.filter((cardBack) => {
    const state = getCardBackShopState(cardBack, wallet, season);

    if (cardBackFilter === "buyable") return state.canBuy;
    if (cardBackFilter === "owned") return state.owned;
    if (cardBackFilter === "locked") return !state.owned && !state.canBuy;

    return true;
  });

  function chooseShopTab(tab: ShopTab) {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    setActiveShopTab(tab);
  }

  function chooseCardBackFilter(filter: CardBackFilter) {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    setCardBackFilter(filter);
  }

  return (
    <View style={styles.shopSheet}>
      <View style={styles.shopHeaderCard}>
        <View style={styles.shopHeaderCopy}>
          <Text style={styles.shopHeaderTitle}>Markt</Text>
          <Text style={styles.shopHeaderText}>
            Kaartbacks, tafels, avatars en beloningen.
          </Text>
        </View>
        <View style={styles.shopBalanceRow}>
          <CurrencyPill label="Coins" value={wallet.coins} tone="coin" />
          <CurrencyPill label="Gems" value={wallet.gems} tone="gem" />
        </View>
      </View>

      <DailyRewardBanner
        canClaimDailyGems={canClaimDailyGems}
        claimDailyGems={claimDailyGems}
      />

      <View style={styles.shopTabBar}>
        {shopTabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.shopTabButton,
              activeShopTab === tab.key && styles.shopTabButtonActive,
            ]}
            onPress={() => chooseShopTab(tab.key)}
          >
            <Text
              style={[
                styles.shopTabText,
                activeShopTab === tab.key && styles.shopTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeShopTab === "wallet" ? (
        <>
          <View style={styles.shopSection}>
            <View>
              <Text style={styles.shopSectionTitle}>Valuta</Text>
              <Text style={styles.shopSectionSubtitle}>
                Alleen wisselen is nu echt actief. Aankopen met geld blijven bewust placeholder.
              </Text>
            </View>

            <View style={styles.shopProductList}>
              <ShopProductCard
                title={`+${COINS_PER_GEM_PACK} coins`}
                text={`${GEM_PACK_COST} gems - direct wisselen`}
                actionLabel="Wissel"
                image={coinImage}
                onPress={buyCoinsWithGems}
              />
              <ShopProductCard
                title="Gems kopen"
                text="Later via Apple/Google in-app purchases."
                actionLabel="Binnenkort"
                image={gemImage}
                onPress={previewGemPurchase}
                placeholder
              />
              <ShopProductCard
                title="Premium pass"
                text="Season rewards en premium cosmetics later."
                actionLabel="Later"
                onPress={previewPremiumPass}
                placeholder
              />
            </View>
          </View>

          <View style={styles.shopSection}>
            <View>
              <Text style={styles.shopSectionTitle}>Dagmissies</Text>
              <Text style={styles.shopSectionSubtitle}>
                Speel rustig door en claim zodra een missie af is.
              </Text>
            </View>
            {dailyMissions.map((mission) => (
              <DailyMissionCard
                key={mission.id}
                mission={mission}
                wallet={wallet}
                claimDailyMission={claimDailyMission}
              />
            ))}
          </View>

          <View style={styles.shopSection}>
            <View>
              <Text style={styles.shopSectionTitle}>Mijlpalen</Text>
              <Text style={styles.shopSectionSubtitle}>
                Lange termijn beloningen voor potjes, winst en collectie.
              </Text>
            </View>
            {milestoneRewards.map((reward) => (
              <MilestoneRewardCard
                key={reward.id}
                reward={reward}
                wallet={wallet}
                claimMilestoneReward={claimMilestoneReward}
              />
            ))}
          </View>
        </>
      ) : null}

      {activeShopTab === "cardbacks" ? (
        <View style={styles.shopSection}>
          <View style={styles.cardBackCollectionHeader}>
            <View>
              <Text style={styles.shopSectionTitle}>Kaartbacks</Text>
              <Text style={styles.cardBackCollectionSubtitle}>
                {ownedBackCount}/{cardBackOptions.length} verzameld
              </Text>
            </View>

            <View style={styles.collectionPercentPill}>
              <Text style={styles.collectionPercentText}>
                {collectionProgress}%
              </Text>
            </View>
          </View>

          <CardBackShowcase cardBack={selectedCardBack} />

          <FeaturedCardBackDeal
            cardBack={featuredCardBack}
            wallet={wallet}
            season={season}
            buyCardBack={buyCardBack}
            selectCardBack={selectCardBack}
            hapticsEnabled={hapticsEnabled}
          />

          <View style={styles.cardBackFilterBar}>
            <FilterChip
              label={`Alle ${cardBackOptions.length}`}
              active={cardBackFilter === "all"}
              onPress={() => chooseCardBackFilter("all")}
            />
            <FilterChip
              label={`Koopbaar ${cardBackStats.buyable}`}
              active={cardBackFilter === "buyable"}
              onPress={() => chooseCardBackFilter("buyable")}
            />
            <FilterChip
              label={`Mijn ${cardBackStats.owned}`}
              active={cardBackFilter === "owned"}
              onPress={() => chooseCardBackFilter("owned")}
            />
            <FilterChip
              label={`Slot ${cardBackStats.locked}`}
              active={cardBackFilter === "locked"}
              onPress={() => chooseCardBackFilter("locked")}
            />
          </View>

          <View style={styles.cardBackShopGrid}>
            {filteredCardBacks.map((cardBack) => (
              <CardBackShopItem
                key={cardBack.id}
                cardBack={cardBack}
                wallet={wallet}
                season={season}
                buyCardBack={buyCardBack}
                selectCardBack={selectCardBack}
                hapticsEnabled={hapticsEnabled}
                onPreview={(item) => setPreview({ kind: "cardback", item })}
              />
            ))}
          </View>

          {filteredCardBacks.length === 0 ? (
            <View style={styles.shopEmptyState}>
              <Text style={styles.shopEmptyTitle}>Niets hier</Text>
              <Text style={styles.shopEmptyText}>Probeer een andere filter.</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {activeShopTab === "tables" ? (
        <View style={styles.shopSection}>
          <View style={styles.cardBackCollectionHeader}>
            <View>
              <Text style={styles.shopSectionTitle}>Tafels</Text>
              <Text style={styles.cardBackCollectionSubtitle}>
                {wallet.ownedTableSkinIds.length}/{tableSkinOptions.length} in bezit
              </Text>
            </View>
          </View>

          <View style={styles.tableSkinGrid}>
            {tableSkinOptions.map((tableSkin) => (
              <TableSkinShopItem
                key={tableSkin.id}
                tableSkin={tableSkin}
                wallet={wallet}
                buyTableSkin={buyTableSkin}
                selectTableSkin={selectTableSkin}
                hapticsEnabled={hapticsEnabled}
                onPreview={(item) => setPreview({ kind: "table", item })}
              />
            ))}
          </View>
        </View>
      ) : null}

      {activeShopTab === "avatars" ? (
        <View style={styles.shopSection}>
          <View style={styles.cardBackCollectionHeader}>
            <View>
              <Text style={styles.shopSectionTitle}>Avatars</Text>
              <Text style={styles.cardBackCollectionSubtitle}>
                {wallet.ownedAvatarIds.length}/{avatarOptions.length} in bezit
              </Text>
            </View>
          </View>

          <View style={styles.cosmeticGrid}>
            {avatarOptions.map((avatar) => (
              <AvatarShopItem
                key={avatar.id}
                avatar={avatar}
                wallet={wallet}
                season={season}
                buyAvatar={buyAvatar}
                selectAvatar={selectAvatar}
                hapticsEnabled={hapticsEnabled}
                onPreview={(item) => setPreview({ kind: "avatar", item })}
              />
            ))}
          </View>
        </View>
      ) : null}

      {activeShopTab === "frames" ? (
        <View style={styles.shopSection}>
          <View style={styles.cardBackCollectionHeader}>
            <View>
              <Text style={styles.shopSectionTitle}>Frames</Text>
              <Text style={styles.cardBackCollectionSubtitle}>
                {wallet.ownedAvatarFrameIds.length}/{avatarFrameOptions.length} in bezit
              </Text>
            </View>
          </View>

          <View style={styles.cosmeticGrid}>
            {avatarFrameOptions.map((frame) => (
              <AvatarFrameShopItem
                key={frame.id}
                frame={frame}
                wallet={wallet}
                season={season}
                buyAvatarFrame={buyAvatarFrame}
                selectAvatarFrame={selectAvatarFrame}
                hapticsEnabled={hapticsEnabled}
                onPreview={(item) => setPreview({ kind: "frame", item })}
              />
            ))}
          </View>
        </View>
      ) : null}

      {activeShopTab === "season" ? (
        <View style={styles.shopSection}>
          <View style={styles.seasonHeader}>
            <View>
              <Text style={styles.seasonEyebrow}>Season 1</Text>
              <Text style={styles.seasonTitle}>Royal Table</Text>
            </View>

            <View style={styles.seasonLevelBadge}>
              <Text style={styles.seasonLevelText}>Level {season.level}</Text>
            </View>
          </View>

          <View style={styles.seasonProgressTrack}>
            <View
              style={[
                styles.seasonProgressFill,
                { width: `${season.progressPercent}%` },
              ]}
            />
          </View>

          <Text style={styles.seasonProgressText}>
            {season.progressXp}/100 XP naar level{" "}
            {Math.min(season.level + 1, 20)}
          </Text>

          <Pressable style={styles.premiumPassCard} onPress={previewPremiumPass}>
            <Text style={styles.premiumPassTitle}>Premium pass</Text>
            <Text style={styles.premiumPassText}>
              Later via Apple/Google.
            </Text>
          </Pressable>

          <View style={styles.rewardGrid}>
            {seasonRewards.map((reward) => {
              const locked = season.level < reward.level;
              const premiumLocked = reward.premium && !wallet.premiumPass;
              const claimed = wallet.claimedSeasonRewards.includes(reward.id);

              return (
                <Pressable
                  key={reward.id}
                  style={[
                    styles.rewardCard,
                    locked && styles.rewardCardLocked,
                    claimed && styles.rewardCardClaimed,
                  ]}
                  onPress={() => claimSeasonReward(reward.id)}
                >
                  <Text style={styles.rewardLevel}>Level {reward.level}</Text>
                  <Text style={styles.rewardTitle}>{reward.title}</Text>
                  <Text style={styles.rewardMeta}>
                    {claimed
                      ? "Geclaimd"
                      : premiumLocked
                      ? "Premium"
                      : locked
                      ? "Locked"
                      : "Claim"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <Modal visible={Boolean(preview)} transparent animationType="fade">
        <ShopPreviewModal
          preview={preview}
          wallet={wallet}
          season={season}
          onClose={() => setPreview(null)}
          buyCardBack={buyCardBack}
          selectCardBack={selectCardBack}
          buyTableSkin={buyTableSkin}
          selectTableSkin={selectTableSkin}
          buyAvatar={buyAvatar}
          selectAvatar={selectAvatar}
          buyAvatarFrame={buyAvatarFrame}
          selectAvatarFrame={selectAvatarFrame}
        />
      </Modal>
    </View>
  );
}

function DailyRewardBanner({
  canClaimDailyGems,
  claimDailyGems,
}: {
  canClaimDailyGems: boolean;
  claimDailyGems: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.dailyRewardCard,
        !canClaimDailyGems && styles.dailyRewardCardClaimed,
      ]}
      onPress={claimDailyGems}
      disabled={!canClaimDailyGems}
    >
      <View style={styles.dailyRewardCopy}>
        <Text style={styles.dailyRewardTitle}>Daily reward</Text>
        <Text style={styles.dailyRewardText}>
          {canClaimDailyGems
            ? `Vandaag klaar: +${DAILY_GEMS} gems`
            : "Vandaag geclaimd. Morgen staat er weer een reward klaar."}
        </Text>
      </View>
      <View
        style={[
          styles.dailyRewardAction,
          !canClaimDailyGems && styles.dailyRewardActionClaimed,
        ]}
      >
        <Text style={styles.dailyRewardValue}>
          {canClaimDailyGems ? "Claim" : "Geclaimd"}
        </Text>
      </View>
    </Pressable>
  );
}

function ShopProductCard({
  title,
  text,
  actionLabel,
  image,
  onPress,
  placeholder,
}: {
  title: string;
  text: string;
  actionLabel: string;
  image?: ImageSourcePropType;
  onPress: () => void;
  placeholder?: boolean;
}) {
  return (
    <Pressable
      style={[styles.shopProductCard, placeholder && styles.shopProductPlaceholder]}
      onPress={onPress}
    >
      <View style={styles.shopProductPreview}>
        {image ? (
          <Image source={image} style={styles.shopProductImage} />
        ) : (
          <Text style={styles.shopProductIcon}>S1</Text>
        )}
      </View>
      <View style={styles.shopProductCopy}>
        <Text style={styles.shopProductTitle}>{title}</Text>
        <Text style={styles.shopProductText}>{text}</Text>
      </View>
      <View
        style={[
          styles.shopProductAction,
          placeholder && styles.shopProductActionPlaceholder,
        ]}
      >
        <Text
          style={[
            styles.shopProductActionText,
            placeholder && styles.shopProductActionTextPlaceholder,
          ]}
        >
          {actionLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.cardBackFilterChip, active && styles.cardBackFilterChipOn]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.cardBackFilterText,
          active && styles.cardBackFilterTextOn,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TableSkinShopItem({
  tableSkin,
  wallet,
  buyTableSkin,
  selectTableSkin,
  hapticsEnabled,
  onPreview,
}: {
  tableSkin: TableSkinOption;
  wallet: Wallet;
  buyTableSkin: (tableSkinId: string) => void;
  selectTableSkin: (tableSkinId: string) => void;
  hapticsEnabled: boolean;
  onPreview: (tableSkin: TableSkinOption) => void;
}) {
  const { canBuy, canInteract, owned, priceCoins, selected } =
    getTableSkinShopState(tableSkin, wallet);
  const ctaLabel = selected
    ? "Actief"
    : owned
    ? "Gebruik"
    : tableSkin.premium
    ? "Binnenkort"
    : canBuy
    ? "Koop"
    : `Nog ${Math.max(0, priceCoins - wallet.coins)}`;

  function handlePress() {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    onPreview(tableSkin);
  }

  return (
    <Pressable
      style={[
        styles.tableSkinCard,
        selected && styles.tableSkinCardSelected,
        canBuy && styles.tableSkinCardBuyable,
        !canInteract && styles.tableSkinCardDisabled,
      ]}
      onPress={handlePress}
    >
      <View style={styles.tableSkinPreview}>
        <View
          style={[
            styles.tableSkinFelt,
            {
              backgroundColor: tableSkin.feltColors[1],
              borderColor: tableSkin.accentColor,
            },
          ]}
        />
        <View
          style={[
            styles.tableSkinRail,
            {
              backgroundColor: tableSkin.railColors[0],
              borderColor: tableSkin.accentColor,
            },
          ]}
        />
      </View>

      <Text style={styles.tableSkinTitle} numberOfLines={1}>
        {tableSkin.title}
      </Text>
      <Text style={styles.tableSkinMeta}>
        {owned ? tableSkin.rarity : `${priceCoins} coins`}
      </Text>

      <View
        style={[
          styles.tableSkinCta,
          (selected || owned || canBuy) && styles.tableSkinCtaStrong,
        ]}
      >
        <Text
          style={[
            styles.tableSkinCtaText,
            (selected || owned || canBuy) && styles.tableSkinCtaTextStrong,
          ]}
        >
          {ctaLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function CosmeticComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.shopSection}>
      <View style={styles.comingSoonCard}>
        <Text style={styles.comingSoonEyebrow}>Coming soon</Text>
        <Text style={styles.comingSoonTitle}>{title}</Text>
        <Text style={styles.comingSoonText}>{text}</Text>
      </View>
    </View>
  );
}

function CardBackShowcase({ cardBack }: { cardBack: CardBackOption }) {
  return (
    <View style={styles.cardBackShowcase}>
      <View style={styles.cardBackShowcaseStack}>
        <Image
          source={cardBack.image}
          style={[styles.cardBackShowcaseImage, styles.cardBackShowcaseGhost]}
          resizeMode="cover"
        />
        <Image
          source={cardBack.image}
          style={[styles.cardBackShowcaseImage, styles.cardBackShowcaseGhostTwo]}
          resizeMode="cover"
        />
        <Image
          source={cardBack.image}
          style={styles.cardBackShowcaseImage}
          resizeMode="cover"
        />
      </View>

      <View style={styles.cardBackShowcaseCopy}>
        <Text style={styles.cardBackShowcaseEyebrow}>Actief</Text>
        <Text style={styles.cardBackShowcaseTitle}>{cardBack.title}</Text>
        <View style={styles.cardBackShowcaseBadge}>
          <Text style={styles.cardBackShowcaseBadgeText}>
            {cardBack.rarity}
          </Text>
        </View>
      </View>
    </View>
  );
}

function getCardBackShopState(
  cardBack: CardBackOption,
  wallet: Wallet,
  season: SeasonProgress
) {
  const owned = Boolean(
    wallet.ownedCardBackIds.includes(cardBack.id) ||
      (cardBack.premium && wallet.premiumPass)
  );
  const selected = wallet.selectedCardBackId === cardBack.id;
  const levelLocked = Boolean(
    cardBack.unlockLevel && season.level < cardBack.unlockLevel
  );
  const priceCoins = cardBack.priceCoins ?? 0;
  const canBuy =
    !owned && !cardBack.premium && !levelLocked && wallet.coins >= priceCoins;
  const canInteract = owned || canBuy;

  return {
    canBuy,
    canInteract,
    levelLocked,
    owned,
    priceCoins,
    selected,
  };
}

function getTableSkinShopState(tableSkin: TableSkinOption, wallet: Wallet) {
  const owned = Boolean(
    wallet.ownedTableSkinIds.includes(tableSkin.id) ||
      (tableSkin.premium && wallet.premiumPass)
  );
  const selected = wallet.selectedTableSkinId === tableSkin.id;
  const priceCoins = tableSkin.priceCoins ?? 0;
  const canBuy = !owned && !tableSkin.premium && wallet.coins >= priceCoins;

  return {
    canBuy,
    canInteract: owned || canBuy,
    owned,
    priceCoins,
    selected,
  };
}

function getAvatarShopState(
  avatar: AvatarOption,
  wallet: Wallet,
  season: SeasonProgress
) {
  const owned = Boolean(
    wallet.ownedAvatarIds.includes(avatar.id) ||
      (avatar.premium && wallet.premiumPass)
  );
  const selected = wallet.selectedAvatarId === avatar.id;
  const levelLocked = Boolean(
    avatar.unlockLevel && season.level < avatar.unlockLevel
  );
  const priceCoins = avatar.priceCoins ?? 0;
  const canBuy =
    !owned && !avatar.premium && !levelLocked && wallet.coins >= priceCoins;

  return {
    canBuy,
    canInteract: owned || canBuy,
    levelLocked,
    owned,
    priceCoins,
    selected,
  };
}

function getAvatarFrameShopState(
  frame: AvatarFrameOption,
  wallet: Wallet,
  season: SeasonProgress
) {
  const owned = Boolean(
    wallet.ownedAvatarFrameIds.includes(frame.id) ||
      (frame.premium && wallet.premiumPass)
  );
  const selected = wallet.selectedAvatarFrameId === frame.id;
  const levelLocked = Boolean(
    frame.unlockLevel && season.level < frame.unlockLevel
  );
  const priceCoins = frame.priceCoins ?? 0;
  const canBuy =
    !owned && !frame.premium && !levelLocked && wallet.coins >= priceCoins;

  return {
    canBuy,
    canInteract: owned || canBuy,
    levelLocked,
    owned,
    priceCoins,
    selected,
  };
}

function getShopCtaLabel({
  canBuy,
  levelLocked,
  owned,
  premium,
  priceCoins,
  selected,
  unlockLevel,
  walletCoins,
}: {
  canBuy: boolean;
  levelLocked?: boolean;
  owned: boolean;
  premium?: boolean;
  priceCoins: number;
  selected: boolean;
  unlockLevel?: number;
  walletCoins: number;
}) {
  if (selected) return "Actief";
  if (owned) return "Gebruik";
  if (premium) return "Binnenkort";
  if (levelLocked) return `Level ${unlockLevel}`;
  if (canBuy) return "Koop";

  return `Nog ${Math.max(0, priceCoins - walletCoins)} coins`;
}

function AvatarShopItem({
  avatar,
  wallet,
  season,
  buyAvatar,
  selectAvatar,
  hapticsEnabled,
  onPreview,
}: {
  avatar: AvatarOption;
  wallet: Wallet;
  season: SeasonProgress;
  buyAvatar: (avatarId: string) => void;
  selectAvatar: (avatarId: string) => void;
  hapticsEnabled: boolean;
  onPreview: (avatar: AvatarOption) => void;
}) {
  const { canBuy, levelLocked, owned, priceCoins, selected } =
    getAvatarShopState(avatar, wallet, season);
  const ctaLabel = getShopCtaLabel({
    canBuy,
    levelLocked,
    owned,
    premium: avatar.premium,
    priceCoins,
    selected,
    unlockLevel: avatar.unlockLevel,
    walletCoins: wallet.coins,
  });

  function handlePress() {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    onPreview(avatar);
  }

  return (
    <Pressable
      style={[
        styles.cosmeticCard,
        selected && styles.cosmeticCardSelected,
        canBuy && styles.cosmeticCardBuyable,
        !owned && !canBuy && styles.cosmeticCardDisabled,
      ]}
      onPress={handlePress}
    >
      <View
        style={[
          styles.cosmeticAvatarPreview,
          {
            backgroundColor: avatar.backgroundColor,
          },
        ]}
      >
        <Text
          style={[
            styles.cosmeticAvatarText,
            {
              color: avatar.textColor,
            },
          ]}
        >
          {avatar.badge || "A"}
        </Text>
      </View>

      <Text style={styles.cosmeticTitle} numberOfLines={1}>
        {avatar.title}
      </Text>
      <Text style={styles.cosmeticMeta}>
        {owned ? avatar.rarity : `${priceCoins} coins`}
      </Text>
      <Text style={styles.cosmeticCta}>{ctaLabel}</Text>
    </Pressable>
  );
}

function AvatarFrameShopItem({
  frame,
  wallet,
  season,
  buyAvatarFrame,
  selectAvatarFrame,
  hapticsEnabled,
  onPreview,
}: {
  frame: AvatarFrameOption;
  wallet: Wallet;
  season: SeasonProgress;
  buyAvatarFrame: (frameId: string) => void;
  selectAvatarFrame: (frameId: string) => void;
  hapticsEnabled: boolean;
  onPreview: (frame: AvatarFrameOption) => void;
}) {
  const { canBuy, levelLocked, owned, priceCoins, selected } =
    getAvatarFrameShopState(frame, wallet, season);
  const ctaLabel = getShopCtaLabel({
    canBuy,
    levelLocked,
    owned,
    premium: frame.premium,
    priceCoins,
    selected,
    unlockLevel: frame.unlockLevel,
    walletCoins: wallet.coins,
  });

  function handlePress() {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    onPreview(frame);
  }

  return (
    <Pressable
      style={[
        styles.cosmeticCard,
        selected && styles.cosmeticCardSelected,
        canBuy && styles.cosmeticCardBuyable,
        !owned && !canBuy && styles.cosmeticCardDisabled,
      ]}
      onPress={handlePress}
    >
      <View
        style={[
          styles.cosmeticFramePreview,
          {
            backgroundColor: frame.backgroundColor,
            borderColor: frame.borderColor,
            shadowColor: frame.glowColor,
          },
        ]}
      >
        <Text style={styles.cosmeticFrameText}>A</Text>
      </View>

      <Text style={styles.cosmeticTitle} numberOfLines={1}>
        {frame.title}
      </Text>
      <Text style={styles.cosmeticMeta}>
        {owned ? frame.rarity : `${priceCoins} coins`}
      </Text>
      <Text style={styles.cosmeticCta}>{ctaLabel}</Text>
    </Pressable>
  );
}

function ShopPreviewModal({
  preview,
  wallet,
  season,
  onClose,
  buyCardBack,
  selectCardBack,
  buyTableSkin,
  selectTableSkin,
  buyAvatar,
  selectAvatar,
  buyAvatarFrame,
  selectAvatarFrame,
}: {
  preview: ShopPreview | null;
  wallet: Wallet;
  season: SeasonProgress;
  onClose: () => void;
  buyCardBack: (cardBackId: string) => void;
  selectCardBack: (cardBackId: string) => void;
  buyTableSkin: (tableSkinId: string) => void;
  selectTableSkin: (tableSkinId: string) => void;
  buyAvatar: (avatarId: string) => void;
  selectAvatar: (avatarId: string) => void;
  buyAvatarFrame: (frameId: string) => void;
  selectAvatarFrame: (frameId: string) => void;
}) {
  if (!preview) return <View />;

  let title = "";
  let description = "";
  let rarity = "";
  let ctaLabel = "";
  let canInteract = false;
  let onAction = () => {};

  if (preview.kind === "cardback") {
    const state = getCardBackShopState(preview.item, wallet, season);

    title = preview.item.title;
    description = preview.item.description;
    rarity = preview.item.rarity;
    ctaLabel = getShopCtaLabel({
      ...state,
      premium: preview.item.premium,
      unlockLevel: preview.item.unlockLevel,
      walletCoins: wallet.coins,
    });
    canInteract = state.canInteract;
    onAction = () => {
      if (state.owned) selectCardBack(preview.item.id);
      else buyCardBack(preview.item.id);
      onClose();
    };
  } else if (preview.kind === "table") {
    const state = getTableSkinShopState(preview.item, wallet);

    title = preview.item.title;
    description = `${preview.item.rarity} tafel skin.`;
    rarity = preview.item.rarity;
    ctaLabel = getShopCtaLabel({
      ...state,
      premium: preview.item.premium,
      walletCoins: wallet.coins,
    });
    canInteract = state.canInteract;
    onAction = () => {
      if (state.owned) selectTableSkin(preview.item.id);
      else buyTableSkin(preview.item.id);
      onClose();
    };
  } else if (preview.kind === "avatar") {
    const state = getAvatarShopState(preview.item, wallet, season);

    title = preview.item.title;
    description = preview.item.description;
    rarity = preview.item.rarity;
    ctaLabel = getShopCtaLabel({
      ...state,
      premium: preview.item.premium,
      unlockLevel: preview.item.unlockLevel,
      walletCoins: wallet.coins,
    });
    canInteract = state.canInteract;
    onAction = () => {
      if (state.owned) selectAvatar(preview.item.id);
      else buyAvatar(preview.item.id);
      onClose();
    };
  } else {
    const state = getAvatarFrameShopState(preview.item, wallet, season);

    title = preview.item.title;
    description = preview.item.description;
    rarity = preview.item.rarity;
    ctaLabel = getShopCtaLabel({
      ...state,
      premium: preview.item.premium,
      unlockLevel: preview.item.unlockLevel,
      walletCoins: wallet.coins,
    });
    canInteract = state.canInteract;
    onAction = () => {
      if (state.owned) selectAvatarFrame(preview.item.id);
      else buyAvatarFrame(preview.item.id);
      onClose();
    };
  }

  return (
    <View style={styles.modalOverlay}>
      <GameModalFrame
        eyebrow={rarity}
        title={title}
        text={description}
        onClose={onClose}
        frameStyle={styles.previewModalCard}
      >
        <View style={styles.previewStage}>
          {preview.kind === "cardback" ? (
            <Image
              source={preview.item.image}
              style={styles.previewCardBackImage}
              resizeMode="cover"
            />
          ) : null}

          {preview.kind === "table" ? (
            <View style={styles.previewTable}>
              <View
                style={[
                  styles.previewTableRail,
                  {
                    backgroundColor: preview.item.railColors[0],
                    borderColor: preview.item.accentColor,
                  },
                ]}
              />
              <View
                style={[
                  styles.previewTableFelt,
                  {
                    backgroundColor: preview.item.feltColors[1],
                    borderColor: preview.item.accentColor,
                  },
                ]}
              />
            </View>
          ) : null}

          {preview.kind === "avatar" ? (
            <View
              style={[
                styles.previewAvatar,
                {
                  backgroundColor: preview.item.backgroundColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.previewAvatarText,
                  {
                    color: preview.item.textColor,
                  },
                ]}
              >
                {preview.item.badge || "A"}
              </Text>
            </View>
          ) : null}

          {preview.kind === "frame" ? (
            <View
              style={[
                styles.previewAvatar,
                {
                  backgroundColor: preview.item.backgroundColor,
                  borderColor: preview.item.borderColor,
                },
              ]}
            >
              <Text style={styles.previewAvatarText}>A</Text>
            </View>
          ) : null}
        </View>

        <GameButton
          label={ctaLabel}
          onPress={onAction}
          disabled={!canInteract}
        />

        <GameButton label="Sluit preview" onPress={onClose} tone="secondary" />
      </GameModalFrame>
    </View>
  );
}

function FeaturedCardBackDeal({
  cardBack,
  wallet,
  season,
  buyCardBack,
  selectCardBack,
  hapticsEnabled,
}: {
  cardBack: CardBackOption;
  wallet: Wallet;
  season: SeasonProgress;
  buyCardBack: (cardBackId: string) => void;
  selectCardBack: (cardBackId: string) => void;
  hapticsEnabled: boolean;
}) {
  const { canBuy, canInteract, levelLocked, owned, priceCoins, selected } =
    getCardBackShopState(cardBack, wallet, season);
  const ctaLabel = selected
    ? "Actief"
    : owned
    ? "Gebruik"
    : canBuy
    ? "Koop nu"
    : levelLocked
    ? `Level ${cardBack.unlockLevel}`
    : `${Math.max(0, priceCoins - wallet.coins)} coins tekort`;

  function handlePress() {
    if (!canInteract) return;

    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});

    if (owned) {
      selectCardBack(cardBack.id);
      return;
    }

    buyCardBack(cardBack.id);
  }

  return (
    <Pressable
      style={[
        styles.shopFeatureCard,
        canBuy && styles.shopFeatureCardBuyable,
        !canInteract && styles.shopFeatureCardDisabled,
      ]}
      onPress={handlePress}
      disabled={!canInteract}
    >
      <Image
        source={cardBack.image}
        style={styles.shopFeatureImage}
        resizeMode="cover"
      />

      <View style={styles.shopFeatureCopy}>
        <Text style={styles.shopFeatureEyebrow}>Uitgelicht</Text>
        <Text style={styles.shopFeatureTitle} numberOfLines={1}>
          {cardBack.title}
        </Text>
        <Text style={styles.shopFeatureMeta}>
          {owned ? cardBack.rarity : `${priceCoins} coins`}
        </Text>
      </View>

      <View
        style={[
          styles.shopFeatureCta,
          (selected || owned || canBuy) && styles.shopFeatureCtaStrong,
        ]}
      >
        <Text
          style={[
            styles.shopFeatureCtaText,
            (selected || owned || canBuy) && styles.shopFeatureCtaTextStrong,
          ]}
        >
          {ctaLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function CardBackShopItem({
  cardBack,
  wallet,
  season,
  buyCardBack,
  selectCardBack,
  hapticsEnabled,
  onPreview,
}: {
  cardBack: CardBackOption;
  wallet: Wallet;
  season: SeasonProgress;
  buyCardBack: (cardBackId: string) => void;
  selectCardBack: (cardBackId: string) => void;
  hapticsEnabled: boolean;
  onPreview: (cardBack: CardBackOption) => void;
}) {
  const { canBuy, canInteract, levelLocked, owned, priceCoins, selected } =
    getCardBackShopState(cardBack, wallet, season);
  const missingCoins = Math.max(0, priceCoins - wallet.coins);
  const ctaLabel = selected
    ? "Actief"
    : owned
    ? "Gebruik"
    : cardBack.premium
    ? "Binnenkort"
    : levelLocked
    ? `Lv ${cardBack.unlockLevel}`
    : canBuy
    ? "Koop"
    : `Nog ${missingCoins}`;

  function handleCardBackPress() {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    onPreview(cardBack);
  }

  return (
    <Pressable
      style={[
        styles.cardBackShopItem,
        selected && styles.cardBackShopItemSelected,
        !owned && styles.cardBackShopItemLocked,
        canBuy && styles.cardBackShopItemBuyable,
        !canInteract && styles.cardBackShopItemDisabled,
      ]}
      onPress={handleCardBackPress}
    >
      <View style={styles.cardBackImageStage}>
        <Image
          source={cardBack.image}
          style={styles.cardBackShopImage}
          resizeMode="cover"
        />
        <View style={styles.cardBackRarityBadge}>
          <Text style={styles.cardBackRarityText}>{cardBack.rarity}</Text>
        </View>
      </View>

      <Text style={styles.cardBackShopTitle} numberOfLines={1}>
        {cardBack.title}
      </Text>

      {!owned && priceCoins > 0 ? (
        <View style={styles.cardBackPriceRow}>
          <Image source={coinImage} style={styles.cardBackPriceIcon} />
          <Text style={styles.cardBackPriceText}>{priceCoins}</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.cardBackCta,
          selected && styles.cardBackCtaSelected,
          owned && !selected && styles.cardBackCtaOwned,
          canBuy && styles.cardBackCtaBuyable,
        ]}
      >
        <Text
          style={[
            styles.cardBackCtaText,
            (selected || owned || canBuy) && styles.cardBackCtaTextStrong,
          ]}
        >
          {ctaLabel}
        </Text>
      </View>
    </Pressable>
  );
}

function DailyMissionCard({
  mission,
  wallet,
  claimDailyMission,
}: {
  mission: DailyMission;
  wallet: Wallet;
  claimDailyMission: (missionId: string) => void;
}) {
  const progress = Math.min(
    getDailyMissionProgress(wallet, mission),
    mission.target
  );
  const progressPercent = Math.round((progress / mission.target) * 100);
  const claimed = wallet.dailyMissionClaims.includes(mission.id);
  const ready = progress >= mission.target && !claimed;
  const rewardText = [
    mission.coins ? `+${mission.coins} coins` : null,
    mission.gems ? `+${mission.gems} gems` : null,
    mission.xp ? `+${mission.xp} XP` : null,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <Pressable
      style={[
        styles.milestoneCard,
        styles.dailyMissionItem,
        ready && styles.milestoneCardReady,
        claimed && styles.milestoneCardClaimed,
      ]}
      onPress={() => claimDailyMission(mission.id)}
    >
      <View style={styles.milestoneTopRow}>
        <View style={styles.milestoneCopy}>
          <Text style={styles.milestoneTitle}>{mission.title}</Text>
          <Text style={styles.milestoneText}>{mission.description}</Text>
        </View>
        <View style={styles.milestoneRewardPill}>
          <Text style={styles.milestoneRewardText}>{rewardText}</Text>
        </View>
      </View>

      <View style={styles.milestoneProgressTrack}>
        <View
          style={[
            styles.milestoneProgressFill,
            { width: `${progressPercent}%` },
          ]}
        />
      </View>

      <View style={styles.milestoneBottomRow}>
        <Text style={styles.milestoneProgressText}>
          {progress}/{mission.target}
        </Text>
        <Text style={styles.milestoneActionText}>
          {claimed ? "Geclaimd" : ready ? "Claim" : "Vandaag"}
        </Text>
      </View>
    </Pressable>
  );
}

function MilestoneRewardCard({
  reward,
  wallet,
  claimMilestoneReward,
}: {
  reward: MilestoneReward;
  wallet: Wallet;
  claimMilestoneReward: (rewardId: string) => void;
}) {
  const progress = Math.min(getMilestoneProgress(wallet, reward), reward.target);
  const progressPercent = Math.round((progress / reward.target) * 100);
  const claimed = wallet.claimedMilestoneRewards.includes(reward.id);
  const ready = progress >= reward.target && !claimed;
  const rewardText = [
    reward.coins ? `+${reward.coins} coins` : null,
    reward.gems ? `+${reward.gems} gems` : null,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <Pressable
      style={[
        styles.milestoneCard,
        ready && styles.milestoneCardReady,
        claimed && styles.milestoneCardClaimed,
      ]}
      onPress={() => claimMilestoneReward(reward.id)}
    >
      <View style={styles.milestoneTopRow}>
        <View style={styles.milestoneCopy}>
          <Text style={styles.milestoneTitle}>{reward.title}</Text>
        </View>
        <View style={styles.milestoneRewardPill}>
          <Text style={styles.milestoneRewardText}>{rewardText}</Text>
        </View>
      </View>

      <View style={styles.milestoneProgressTrack}>
        <View
          style={[
            styles.milestoneProgressFill,
            { width: `${progressPercent}%` },
          ]}
        />
      </View>

      <View style={styles.milestoneBottomRow}>
        <Text style={styles.milestoneProgressText}>
          {progress}/{reward.target}
        </Text>
        <Text style={styles.milestoneActionText}>
          {claimed ? "Geclaimd" : ready ? "Claim" : "Bezig"}
        </Text>
      </View>
    </Pressable>
  );
}

function CurrencyPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "coin" | "gem";
}) {
  return (
    <View
      style={[
        styles.currencyPill,
        tone === "gem" && styles.currencyPillGem,
      ]}
    >
      <View style={styles.currencyPillTopRow}>
        <Image
          source={tone === "gem" ? gemImage : coinImage}
          style={styles.currencyIcon}
        />
        <Text style={styles.currencyLabel}>{label}</Text>
      </View>
      <Text style={styles.currencyValue}>{value}</Text>
    </View>
  );
}
