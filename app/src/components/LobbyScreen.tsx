import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  COINS_PER_GEM_PACK,
  DAILY_GEMS,
  GEM_PACK_COST,
  MilestoneReward,
  Wallet,
  getMilestoneProgress,
  milestoneRewards,
  seasonRewards,
} from "../economy";
import { cardBackOptions } from "../cardBackImages";
import type { CardBackOption } from "../cardBackImages";
import { coinImage, gemImage } from "../currencyImages";
import type { ConnectionState } from "../hooks/useRoomSocket";
import type {
  AppSettings,
  CardSizeSetting,
  LanguageSetting,
  MotionSetting,
} from "../settings";
import { styles } from "../styles";
import { tableSkinOptions } from "../tableSkins";
import type { TableSkinOption } from "../tableSkins";

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

export function LobbyScreen({
  name,
  hasSavedName,
  setName,
  roomCodeInput,
  setRoomCodeInput,
  createRoom,
  joinRoom,
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
  claimSeasonReward: (rewardId: string) => void;
  claimMilestoneReward: (rewardId: string) => void;
}) {
  const [showShop, setShowShop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [draftName, setDraftName] = useState(name);

  const normalizedRoomCode = roomCodeInput
    .trim()
    .toUpperCase()
    .replace(/\s/g, "");
  const roomCodeReady = normalizedRoomCode.length === 5;
  const creatingRoom = pendingAction === "create";
  const joiningRoom = pendingAction === "join";
  const isBusy = pendingAction !== null;
  const profileReady = hasSavedName && name.trim().length > 0;
  const draftNameReady = draftName.trim().length > 0;
  const playDisabled = !connected || isBusy || !profileReady;
  const selectedCardBack =
    cardBackOptions.find((cardBack) => cardBack.id === wallet.selectedCardBackId) ??
    cardBackOptions[0];
  const winRate =
    wallet.gamesPlayed > 0
      ? Math.round((wallet.wins / wallet.gamesPlayed) * 100)
      : 0;

  useEffect(() => {
    setDraftName(name);
  }, [name]);

  function runLightHaptic() {
    if (!settings.hapticsEnabled) return;

    Haptics.selectionAsync().catch(() => {});
  }

  function saveProfileName() {
    if (!draftNameReady) return;

    runLightHaptic();
    Keyboard.dismiss();
    setName(draftName);
    setShowSettings(false);
  }

  function openShop() {
    runLightHaptic();
    setShowShop(true);
  }

  function openSettings() {
    runLightHaptic();
    setShowSettings(true);
  }

  function openRules() {
    runLightHaptic();
    setShowRules(true);
  }

  function claimDailyRewardFromHome() {
    if (settings.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    claimDailyGems();
  }

  const lobbyContent = (
    <ScrollView
      contentContainerStyle={styles.homeScroll}
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={Keyboard.dismiss}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.homeCard}>
        <View style={styles.logoRow}>
          <View style={styles.cardLogoSmall}>
            <Text style={styles.cardLogoText}>P</Text>
            <Text style={styles.cardLogoIcon}>S</Text>
          </View>

          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>LIVE TAFEL</Text>
          </View>
        </View>

        <Text style={styles.homeTitle}>Pesten Online</Text>
        <Text style={styles.homeSubtitle}>
          Speel direct met vrienden met 1 code.
        </Text>

        <View style={styles.homeStatusRow}>
          <View style={styles.connectionPill}>
            <View
              style={[
                styles.connectionDot,
                connected ? styles.connectionDotOn : styles.connectionDotOff,
              ]}
            />
            <Text style={styles.connectionText}>
              {connected ? "Online" : "Offline"}
            </Text>
          </View>

          <View style={styles.walletMiniPill}>
            <Image source={coinImage} style={styles.walletMiniIcon} />
            <Text style={styles.walletMiniText}>{wallet.coins} coins</Text>
            <Text style={styles.walletMiniDivider}>/</Text>
            <Image source={gemImage} style={styles.walletMiniIcon} />
            <Text style={styles.walletMiniText}>{wallet.gems} gems</Text>
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
                Check je WiFi of start de server opnieuw.
              </Text>
            </View>
            <Pressable style={styles.connectionRetryButton} onPress={retryConnection}>
              <Text style={styles.connectionRetryText}>Retry</Text>
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
                : "Even verwerken..."}
            </Text>
          </View>
        ) : null}

        {economyNotice && !showShop ? (
          <Pressable style={styles.economyNotice} onPress={clearEconomyNotice}>
            <Text style={styles.economyNoticeText}>{economyNotice}</Text>
          </Pressable>
        ) : null}

        {canClaimDailyGems ? (
          <Pressable
            style={styles.homeRewardCard}
            onPress={claimDailyRewardFromHome}
          >
            <View style={styles.homeRewardIcon}>
              <Image source={gemImage} style={styles.homeRewardGemIcon} />
            </View>
            <View style={styles.homeRewardCopy}>
              <Text style={styles.homeRewardTitle}>Daily reward</Text>
              <Text style={styles.homeRewardText}>+{DAILY_GEMS} gems</Text>
            </View>
            <Text style={styles.homeRewardCta}>Claim</Text>
          </Pressable>
        ) : null}

        {profileReady ? (
          <ProfileSummary
            name={name}
            wallet={wallet}
            season={season}
            selectedCardBack={selectedCardBack}
            winRate={winRate}
            openSettings={openSettings}
          />
        ) : (
          <ProfileSetup
            draftName={draftName}
            draftNameReady={draftNameReady}
            setDraftName={(value) => {
              clearError();
              setDraftName(value);
            }}
            saveProfileName={saveProfileName}
          />
        )}

        <View style={styles.playPanel}>
          <View style={styles.playHeaderRow}>
            <View>
              <Text style={styles.playTitle}>Speel</Text>
              <Text style={styles.playSubtitle}>2-4 spelers</Text>
            </View>

            <View style={styles.entryChip}>
              <Text style={styles.entryChipLabel}>Inzet</Text>
              <Text style={styles.entryChipValue}>{entryCostCoins} coins</Text>
            </View>
          </View>

          <Pressable
            style={[styles.primaryPlayButton, playDisabled && styles.disabledButton]}
            onPress={createRoom}
            disabled={playDisabled}
          >
            <Text style={styles.primaryPlayButtonText}>
              {creatingRoom ? "Openen..." : "Nieuwe tafel"}
            </Text>
          </Pressable>

          <View style={styles.joinCompactCard}>
            <View style={styles.joinHeader}>
              <Text style={styles.joinTitle}>Kamercode</Text>
            </View>

            <View style={styles.joinCodeRow}>
              <TextInput
                style={styles.codeInputCompact}
                value={roomCodeInput}
                onChangeText={(value) => {
                  clearError();
                  setRoomCodeInput(
                    value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                  );
                }}
                placeholder="ABC12"
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect={false}
                maxLength={5}
                returnKeyType="join"
                blurOnSubmit
                onSubmitEditing={() => {
                  if (connected && roomCodeReady && profileReady) {
                    joinRoom();
                  } else {
                    Keyboard.dismiss();
                  }
                }}
              />

              <Pressable
                style={[
                  styles.joinCompactButton,
                  (!connected || !roomCodeReady || isBusy || !profileReady) &&
                    styles.disabledButton,
                ]}
                onPress={joinRoom}
                disabled={!connected || !roomCodeReady || isBusy || !profileReady}
              >
                <Text style={styles.joinCompactButtonText}>
                  {joiningRoom ? "..." : "Join"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Pressable
          style={styles.rulesPreviewCard}
          onPress={openRules}
        >
          <View>
            <Text style={styles.rulesPreviewTitle}>Regels</Text>
            <Text style={styles.rulesPreviewText}>
              Kort overzicht.
            </Text>
          </View>
          <Text style={styles.rulesPreviewCta}>Bekijk</Text>
        </Pressable>

        <View style={styles.homeSecondaryActions}>
          <Pressable
            style={styles.homeSecondaryButton}
            onPress={openShop}
          >
            <Text style={styles.homeSecondaryTitle}>Shop</Text>
            <Text style={styles.homeSecondaryText}>
              {canClaimDailyGems
                ? `+${DAILY_GEMS} gems klaar`
                : `Season level ${season.level}`}
            </Text>
          </Pressable>

          <Pressable
            style={styles.homeSecondaryButtonAlt}
            onPress={openSettings}
          >
            <Text style={styles.homeSecondaryTitleAlt}>Profiel</Text>
            <Text style={styles.homeSecondaryTextAlt}>
              Naam wijzigen
            </Text>
          </Pressable>
        </View>

        <Modal visible={showShop} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, styles.shopModalCard]}>
              <View style={styles.modalHeaderRow}>
                <View>
                  <Text style={styles.modalTitleLeft}>Shop</Text>
                </View>

                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setShowShop(false)}
                >
                  <Text style={styles.modalCloseText}>Sluit</Text>
                </Pressable>
              </View>

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
                  claimSeasonReward={claimSeasonReward}
                  claimMilestoneReward={claimMilestoneReward}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={showSettings} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Instellingen</Text>
              <Text style={styles.modalText}>Je naam staat vast op de home.</Text>

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
                onSubmitEditing={saveProfileName}
              />

              <View style={styles.settingsGroup}>
                <SettingSwitch
                  label="Haptics"
                  enabled={settings.hapticsEnabled}
                  onPress={() =>
                    updateSettings({
                      hapticsEnabled: !settings.hapticsEnabled,
                    })
                  }
                />

                <SettingSegment<CardSizeSetting>
                  label="Kaarten"
                  value={settings.cardSize}
                  options={[
                    { label: "Compact", value: "compact" },
                    { label: "Normaal", value: "normal" },
                    { label: "Groot", value: "large" },
                  ]}
                  onChange={(cardSize) => updateSettings({ cardSize })}
                />

                <SettingSegment<MotionSetting>
                  label="Animatie"
                  value={settings.motionLevel}
                  options={[
                    { label: "Rustig", value: "low" },
                    { label: "Normaal", value: "normal" },
                  ]}
                  onChange={(motionLevel) => updateSettings({ motionLevel })}
                />

                <SettingSegment<LanguageSetting>
                  label="Taal"
                  value={settings.language}
                  options={[
                    { label: "NL", value: "nl" },
                    { label: "EN", value: "en" },
                  ]}
                  onChange={(language) => updateSettings({ language })}
                />
              </View>

              <Pressable
                style={[
                  styles.modalYesButton,
                  !draftNameReady && styles.disabledButton,
                ]}
                onPress={saveProfileName}
                disabled={!draftNameReady}
              >
                <Text style={styles.modalYesButtonText}>Opslaan</Text>
              </Pressable>

              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setDraftName(name);
                  setShowSettings(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Annuleren</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={showRules} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Snelregels</Text>
              <Text style={styles.modalText}>
                De belangrijkste acties.
              </Text>

              <View style={styles.rulesList}>
                <RuleItem
                  label="7"
                  text="Zelfde symbool. Direct na een 7 mag nog een 7."
                />
                <RuleItem
                  label="2/Joker"
                  text="Stapel of pak alles."
                />
                <RuleItem
                  label="Boer"
                  text="Kies nieuw symbool."
                />
                <RuleItem
                  label="Heer"
                  text="Nog een kaart leggen."
                />
                <RuleItem
                  label="Finish"
                  text="Geen A, 2, 7, 8, J, K of Joker als laatste."
                />
              </View>

              <Pressable
                style={styles.modalYesButton}
                onPress={() => setShowRules(false)}
              >
                <Text style={styles.modalYesButtonText}>Ik snap het</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </ScrollView>
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

function ProfileSummary({
  name,
  wallet,
  season,
  selectedCardBack,
  winRate,
  openSettings,
}: {
  name: string;
  wallet: Wallet;
  season: SeasonProgress;
  selectedCardBack: CardBackOption;
  winRate: number;
  openSettings: () => void;
}) {
  return (
    <View style={styles.profileSummaryCard}>
      <View style={styles.profileAvatar}>
        <Text style={styles.profileAvatarText}>
          {name.slice(0, 1).toUpperCase()}
        </Text>
      </View>

      <View style={styles.profileSummaryMain}>
        <Text style={styles.profileWelcome}>Welkom terug</Text>
        <Text style={styles.profileName}>{name}</Text>
      </View>

      <Pressable style={styles.profileSettingsButton} onPress={openSettings}>
        <Text style={styles.profileSettingsText}>Wijzig</Text>
      </Pressable>

      <View style={styles.profileStatsPanel}>
        <View style={styles.profileStatItem}>
          <Text style={styles.profileStatValue}>Lv {season.level}</Text>
          <Text style={styles.profileStatLabel}>Season</Text>
        </View>

        <View style={styles.profileStatItem}>
          <Text style={styles.profileStatValue}>{wallet.wins}</Text>
          <Text style={styles.profileStatLabel}>Wins</Text>
        </View>

        <View style={styles.profileStatItem}>
          <Text style={styles.profileStatValue}>{winRate}%</Text>
          <Text style={styles.profileStatLabel}>Winrate</Text>
        </View>

        <View style={styles.profileCardBackPreview}>
          <Image
            source={selectedCardBack.image}
            style={styles.profileCardBackImage}
            resizeMode="cover"
          />
          <Text style={styles.profileCardBackText} numberOfLines={1}>
            {selectedCardBack.title}
          </Text>
        </View>
      </View>
    </View>
  );
}

function RuleItem({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.ruleHelpItem}>
      <View style={styles.ruleHelpBadge}>
        <Text style={styles.ruleHelpBadgeText}>{label}</Text>
      </View>
      <Text style={styles.ruleHelpText}>{text}</Text>
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
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Pressable
        style={[styles.settingToggle, enabled && styles.settingToggleOn]}
        onPress={onPress}
      >
        <View
          style={[styles.settingToggleKnob, enabled && styles.settingToggleKnobOn]}
        />
      </Pressable>
    </View>
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
            ]}
            onPress={() => onChange(option.value)}
          >
            <Text
              style={[
                styles.settingSegmentText,
                value === option.value && styles.settingSegmentTextOn,
              ]}
            >
              {option.label}
            </Text>
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
      <View style={styles.shopBalanceRow}>
        <CurrencyPill label="Coins" value={wallet.coins} tone="coin" />
        <CurrencyPill label="Gems" value={wallet.gems} tone="gem" />
      </View>

      <View style={styles.shopTabBar}>
        <Pressable
          style={[
            styles.shopTabButton,
            activeShopTab === "wallet" && styles.shopTabButtonActive,
          ]}
          onPress={() => chooseShopTab("wallet")}
        >
          <Text
            style={[
              styles.shopTabText,
              activeShopTab === "wallet" && styles.shopTabTextActive,
            ]}
          >
            Munten
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.shopTabButton,
            activeShopTab === "cardbacks" && styles.shopTabButtonActive,
          ]}
          onPress={() => chooseShopTab("cardbacks")}
        >
          <Text
            style={[
              styles.shopTabText,
              activeShopTab === "cardbacks" && styles.shopTabTextActive,
            ]}
          >
            Backs
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.shopTabButton,
            activeShopTab === "tables" && styles.shopTabButtonActive,
          ]}
          onPress={() => chooseShopTab("tables")}
        >
          <Text
            style={[
              styles.shopTabText,
              activeShopTab === "tables" && styles.shopTabTextActive,
            ]}
          >
            Tafels
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.shopTabButton,
            activeShopTab === "avatars" && styles.shopTabButtonActive,
          ]}
          onPress={() => chooseShopTab("avatars")}
        >
          <Text
            style={[
              styles.shopTabText,
              activeShopTab === "avatars" && styles.shopTabTextActive,
            ]}
          >
            Avatars
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.shopTabButton,
            activeShopTab === "frames" && styles.shopTabButtonActive,
          ]}
          onPress={() => chooseShopTab("frames")}
        >
          <Text
            style={[
              styles.shopTabText,
              activeShopTab === "frames" && styles.shopTabTextActive,
            ]}
          >
            Frames
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.shopTabButton,
            activeShopTab === "season" && styles.shopTabButtonActive,
          ]}
          onPress={() => chooseShopTab("season")}
        >
          <Text
            style={[
              styles.shopTabText,
              activeShopTab === "season" && styles.shopTabTextActive,
            ]}
          >
            Season
          </Text>
        </Pressable>
      </View>

      {activeShopTab === "wallet" ? (
        <>
          <View style={styles.shopSection}>
            <Text style={styles.shopSectionTitle}>Gratis</Text>
            <Pressable
              style={[
                styles.dailyRewardCard,
                !canClaimDailyGems && styles.dailyRewardCardClaimed,
              ]}
              onPress={claimDailyGems}
              disabled={!canClaimDailyGems}
            >
              <View>
                <Text style={styles.dailyRewardTitle}>Daily gems</Text>
                <Text style={styles.dailyRewardText}>
                  {canClaimDailyGems
                    ? `Claim +${DAILY_GEMS}`
                    : "Geclaimd"}
                </Text>
              </View>
              <Text style={styles.dailyRewardValue}>
                {canClaimDailyGems ? `+${DAILY_GEMS}` : "OK"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.shopSection}>
            <Text style={styles.shopSectionTitle}>Gems</Text>
            <Pressable
              style={styles.gemPurchaseCard}
              onPress={previewGemPurchase}
            >
              <View style={styles.shopActionIconWrap}>
                <Image source={gemImage} style={styles.shopActionIcon} />
              </View>

              <View style={styles.shopActionTextBox}>
                <Text style={styles.gemPurchaseTitle}>Koop gems</Text>
                <Text style={styles.gemPurchaseText}>
                  Later via Apple/Google.
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.shopSection}>
            <Text style={styles.shopSectionTitle}>Coins</Text>
            <Pressable style={styles.exchangeCard} onPress={buyCoinsWithGems}>
              <View style={styles.exchangeIconRow}>
                <Image source={coinImage} style={styles.exchangeIcon} />
                <View>
                  <Text style={styles.exchangeTitle}>
                    +{COINS_PER_GEM_PACK} coins
                  </Text>
                  <Text style={styles.exchangeText}>{GEM_PACK_COST} gems</Text>
                </View>
              </View>
            </Pressable>
          </View>

          <View style={styles.shopSection}>
            <Text style={styles.shopSectionTitle}>Missies</Text>
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
              />
            ))}
          </View>
        </View>
      ) : null}

      {activeShopTab === "avatars" ? (
        <CosmeticComingSoon
          title="Avatars"
          text="Binnenkort: avatar icons, win poses en profielbadges."
        />
      ) : null}

      {activeShopTab === "frames" ? (
        <CosmeticComingSoon
          title="Frames"
          text="Binnenkort: gouden randen, streak frames en season rewards."
        />
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
    </View>
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
}: {
  tableSkin: TableSkinOption;
  wallet: Wallet;
  buyTableSkin: (tableSkinId: string) => void;
  selectTableSkin: (tableSkinId: string) => void;
  hapticsEnabled: boolean;
}) {
  const owned =
    wallet.ownedTableSkinIds.includes(tableSkin.id) ||
    (tableSkin.premium && wallet.premiumPass);
  const selected = wallet.selectedTableSkinId === tableSkin.id;
  const priceCoins = tableSkin.priceCoins ?? 0;
  const canBuy = !owned && !tableSkin.premium && wallet.coins >= priceCoins;
  const canInteract = owned || canBuy;
  const ctaLabel = selected
    ? "Actief"
    : owned
    ? "Gebruik"
    : tableSkin.premium
    ? "Premium"
    : canBuy
    ? "Koop"
    : `Nog ${Math.max(0, priceCoins - wallet.coins)}`;

  function handlePress() {
    if (!canInteract) return;

    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});

    if (owned) {
      selectTableSkin(tableSkin.id);
      return;
    }

    buyTableSkin(tableSkin.id);
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
      disabled={!canInteract}
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
  const owned =
    wallet.ownedCardBackIds.includes(cardBack.id) ||
    (cardBack.premium && wallet.premiumPass);
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
  const missingCoins = Math.max(0, priceCoins - wallet.coins);
  const ctaLabel = selected
    ? "Actief"
    : owned
    ? "Gebruik"
    : cardBack.premium
    ? "Premium"
    : levelLocked
    ? `Lv ${cardBack.unlockLevel}`
    : canBuy
    ? "Koop"
    : `Nog ${missingCoins}`;

  function handleCardBackPress() {
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
        styles.cardBackShopItem,
        selected && styles.cardBackShopItemSelected,
        !owned && styles.cardBackShopItemLocked,
        canBuy && styles.cardBackShopItemBuyable,
        !canInteract && styles.cardBackShopItemDisabled,
      ]}
      onPress={handleCardBackPress}
      disabled={!canInteract}
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
