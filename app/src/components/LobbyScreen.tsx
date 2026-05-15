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
  TouchableWithoutFeedback,
  View,
} from "react-native";

import {
  COINS_PER_GEM_PACK,
  DAILY_GEMS,
  GEM_PACK_COST,
  Wallet,
  seasonRewards,
} from "../economy";
import { cardBackOptions } from "../cardBackImages";
import type { CardBackOption } from "../cardBackImages";
import { coinImage, gemImage } from "../currencyImages";
import { styles } from "../styles";

type SeasonProgress = {
  level: number;
  progressXp: number;
  nextLevelXp: number;
  progressPercent: number;
};

export function LobbyScreen({
  name,
  hasSavedName,
  setName,
  roomCodeInput,
  setRoomCodeInput,
  createRoom,
  joinRoom,
  connected,
  pendingAction,
  errorMessage,
  clearError,
  wallet,
  season,
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
  claimSeasonReward,
}: {
  name: string;
  hasSavedName: boolean;
  setName: (value: string) => void;
  roomCodeInput: string;
  setRoomCodeInput: (value: string) => void;
  createRoom: () => void;
  joinRoom: () => void;
  connected: boolean;
  pendingAction: string | null;
  errorMessage: string | null;
  clearError: () => void;
  wallet: Wallet;
  season: SeasonProgress;
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
  claimSeasonReward: (rewardId: string) => void;
}) {
  const [showShop, setShowShop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [draftName, setDraftName] = useState(name);

  const roomCodeReady = roomCodeInput.trim().length === 5;
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

  function saveProfileName() {
    if (!draftNameReady) return;

    Keyboard.dismiss();
    setName(draftName);
    setShowSettings(false);
  }

  const lobbyContent = (
    <ScrollView
      contentContainerStyle={styles.homeScroll}
      keyboardShouldPersistTaps="handled"
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
          Maak een kamer, deel de code en speel meteen met vrienden.
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

        {profileReady ? (
          <ProfileSummary
            name={name}
            wallet={wallet}
            season={season}
            selectedCardBack={selectedCardBack}
            winRate={winRate}
            openSettings={() => setShowSettings(true)}
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
              <Text style={styles.playSubtitle}>2-4 spelers met kamer code</Text>
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
              {creatingRoom ? "Kamer openen..." : "Maak kamer"}
            </Text>
            <Text style={styles.primaryPlayButtonSub}>
              Jij nodigt vrienden uit en start de game.
            </Text>
          </Pressable>

          <View style={styles.joinCompactCard}>
            <View style={styles.joinHeader}>
              <Text style={styles.joinTitle}>Join kamer</Text>
              <Text style={styles.joinSub}>Vul de code van je vriend in</Text>
            </View>

            <View style={styles.joinCodeRow}>
              <TextInput
                style={styles.codeInputCompact}
                value={roomCodeInput}
                onChangeText={(value) => {
                  clearError();
                  setRoomCodeInput(value.toUpperCase().replace(/\s/g, ""));
                }}
                placeholder="ABC12"
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
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
          onPress={() => setShowRules(true)}
        >
          <View>
            <Text style={styles.rulesPreviewTitle}>Speluitleg</Text>
            <Text style={styles.rulesPreviewText}>
              Check snel 7-reeksen, pestkaarten en boer-keuzes.
            </Text>
          </View>
          <Text style={styles.rulesPreviewCta}>Bekijk</Text>
        </Pressable>

        <View style={styles.homeSecondaryActions}>
          <Pressable
            style={styles.homeSecondaryButton}
            onPress={() => setShowShop(true)}
          >
            <Text style={styles.homeSecondaryTitle}>Shop & rewards</Text>
            <Text style={styles.homeSecondaryText}>
              {canClaimDailyGems
                ? `Daily +${DAILY_GEMS} gems klaar`
                : `Season level ${season.level}`}
            </Text>
          </Pressable>

          <Pressable
            style={styles.homeSecondaryButtonAlt}
            onPress={() => setShowSettings(true)}
          >
            <Text style={styles.homeSecondaryTitleAlt}>Profiel</Text>
            <Text style={styles.homeSecondaryTextAlt}>
              Naam en instellingen
            </Text>
          </Pressable>
        </View>

        <Modal visible={showShop} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, styles.shopModalCard]}>
              <View style={styles.modalHeaderRow}>
                <View>
                  <Text style={styles.modalTitleLeft}>Shop</Text>
                  <Text style={styles.modalTextLeft}>
                    Gems, coins en season rewards.
                  </Text>
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
                  buyCoinsWithGems={buyCoinsWithGems}
                  claimDailyGems={claimDailyGems}
                  canClaimDailyGems={canClaimDailyGems}
                  previewPremiumPass={previewPremiumPass}
                  previewGemPurchase={previewGemPurchase}
                  buyCardBack={buyCardBack}
                  selectCardBack={selectCardBack}
                  claimSeasonReward={claimSeasonReward}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={showSettings} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Instellingen</Text>
              <Text style={styles.modalText}>Wijzig je spelersnaam.</Text>

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
                Een korte reminder voor de belangrijkste Pesten-regels.
              </Text>

              <View style={styles.rulesList}>
                <RuleItem
                  label="7"
                  text="Na een 7 blijf je aan zet. Leg hetzelfde symbool, of direct na een 7 nog een 7."
                />
                <RuleItem
                  label="2/Joker"
                  text="Stapel +2 en jokers. Kun je niet counteren, dan pak je de hele stapel."
                />
                <RuleItem
                  label="Boer"
                  text="Een boer kiest een nieuw symbool, maar moet op het actieve symbool passen."
                />
                <RuleItem
                  label="Heer"
                  text="Na een heer moet je nog een kaart leggen als dat kan."
                />
                <RuleItem
                  label="Finish"
                  text="Eindigen met een pestkaart geeft strafkaarten, dus plan je laatste kaart slim."
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
      {Platform.OS === "web" ? (
        lobbyContent
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          {lobbyContent}
        </TouchableWithoutFeedback>
      )}
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
        Je naam blijft bewaard. Later wijzigen kan via Profiel.
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

function EconomyPanel({
  wallet,
  season,
  buyCoinsWithGems,
  claimDailyGems,
  canClaimDailyGems,
  previewPremiumPass,
  previewGemPurchase,
  buyCardBack,
  selectCardBack,
  claimSeasonReward,
}: {
  wallet: Wallet;
  season: SeasonProgress;
  buyCoinsWithGems: () => void;
  claimDailyGems: () => void;
  canClaimDailyGems: boolean;
  previewPremiumPass: () => void;
  previewGemPurchase: () => void;
  buyCardBack: (cardBackId: string) => void;
  selectCardBack: (cardBackId: string) => void;
  claimSeasonReward: (rewardId: string) => void;
}) {
  return (
    <View style={styles.shopSheet}>
      <View style={styles.shopBalanceRow}>
        <CurrencyPill label="Coins" value={wallet.coins} tone="coin" />
        <CurrencyPill label="Gems" value={wallet.gems} tone="gem" />
      </View>

      <View style={styles.shopSection}>
        <Text style={styles.shopSectionTitle}>Vandaag</Text>
        <Pressable
          style={[
            styles.dailyRewardCard,
            !canClaimDailyGems && styles.dailyRewardCardClaimed,
          ]}
          onPress={claimDailyGems}
          disabled={!canClaimDailyGems}
        >
          <View>
            <Text style={styles.dailyRewardTitle}>Daily gem chest</Text>
            <Text style={styles.dailyRewardText}>
              {canClaimDailyGems
                ? `Claim gratis +${DAILY_GEMS} gems`
                : "Vandaag al geclaimd"}
            </Text>
          </View>
          <Text style={styles.dailyRewardValue}>
            {canClaimDailyGems ? `+${DAILY_GEMS}` : "OK"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.shopSection}>
        <Text style={styles.shopSectionTitle}>Gems</Text>
        <Pressable style={styles.gemPurchaseCard} onPress={previewGemPurchase}>
          <View style={styles.shopActionIconWrap}>
            <Image source={gemImage} style={styles.shopActionIcon} />
          </View>

          <View style={styles.shopActionTextBox}>
            <Text style={styles.gemPurchaseTitle}>Koop gems</Text>
            <Text style={styles.gemPurchaseText}>
              Later veilig via Apple/Google in-app purchases.
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
                Koop {COINS_PER_GEM_PACK} coins
              </Text>
              <Text style={styles.exchangeText}>{GEM_PACK_COST} gems</Text>
            </View>
          </View>
        </Pressable>
      </View>

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
          {season.progressXp}/100 XP naar level {Math.min(season.level + 1, 20)}
        </Text>

        <Pressable style={styles.premiumPassCard} onPress={previewPremiumPass}>
          <Text style={styles.premiumPassTitle}>Premium pass</Text>
          <Text style={styles.premiumPassText}>
            Later via Apple/Google in-app purchases.
          </Text>
        </Pressable>

        <View style={styles.cardBackShopGrid}>
          {cardBackOptions.map((cardBack) => (
            <CardBackShopItem
              key={cardBack.id}
              cardBack={cardBack}
              wallet={wallet}
              season={season}
              buyCardBack={buyCardBack}
              selectCardBack={selectCardBack}
            />
          ))}
        </View>

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
    </View>
  );
}

function CardBackShopItem({
  cardBack,
  wallet,
  season,
  buyCardBack,
  selectCardBack,
}: {
  cardBack: CardBackOption;
  wallet: Wallet;
  season: SeasonProgress;
  buyCardBack: (cardBackId: string) => void;
  selectCardBack: (cardBackId: string) => void;
}) {
  const owned =
    wallet.ownedCardBackIds.includes(cardBack.id) ||
    (cardBack.premium && wallet.premiumPass);
  const selected = wallet.selectedCardBackId === cardBack.id;
  const levelLocked = Boolean(
    cardBack.unlockLevel && season.level < cardBack.unlockLevel
  );
  const meta = selected
    ? "In gebruik"
    : owned
    ? "Kies"
    : cardBack.premium
    ? "Premium"
    : levelLocked
    ? `Level ${cardBack.unlockLevel}`
    : cardBack.priceCoins
    ? `${cardBack.priceCoins} coins`
    : "Unlock";

  return (
    <Pressable
      style={[
        styles.cardBackShopItem,
        selected && styles.cardBackShopItemSelected,
        !owned && styles.cardBackShopItemLocked,
      ]}
      onPress={() =>
        owned ? selectCardBack(cardBack.id) : buyCardBack(cardBack.id)
      }
    >
      <Image
        source={cardBack.image}
        style={styles.cardBackShopImage}
        resizeMode="cover"
      />
      <Text style={styles.cardBackShopTitle} numberOfLines={1}>
        {cardBack.title}
      </Text>
      <Text style={styles.cardBackShopMeta}>{meta}</Text>
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
