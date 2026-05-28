import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  cardBackOptions,
  defaultCardBackId,
  starterCardBackIds,
} from "../cardBackImages";
import {
  avatarFrameOptions,
  avatarOptions,
  defaultAvatarFrameId,
  defaultAvatarId,
  starterAvatarFrameIds,
  starterAvatarIds,
} from "../cosmetics";
import {
  defaultTableSkinId,
  starterTableSkinIds,
  tableSkinOptions,
} from "../tableSkins";
import {
  COINS_PER_GEM_PACK,
  DAILY_GEMS,
  DAILY_LOGIN_COINS,
  DailyMission,
  GAME_PLAYED_COINS,
  GAME_PLAYED_XP,
  GAME_WIN_COINS,
  GAME_WIN_XP,
  GEM_PACK_COST,
  Wallet,
  dailyMissions,
  defaultWallet,
  getDailyMissionProgress,
  getMilestoneProgress,
  getSeasonProgress,
  milestoneRewards,
  seasonRewards,
} from "../economy";

const walletStorageKey = "pesten.wallet.v1";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeWallet(value: Partial<Wallet> | null): Wallet {
  const currentDay = todayKey();
  const hasCurrentDailyProgress = value?.dailyMissionDate === currentDay;
  const premiumAvatarIds = value?.premiumPass
    ? avatarOptions
        .filter((avatar) => avatar.premium)
        .map((avatar) => avatar.id)
    : [];
  const ownedAvatarIds = Array.from(
    new Set([
      ...starterAvatarIds,
      ...premiumAvatarIds,
      ...(value?.ownedAvatarIds ?? []),
    ])
  );
  const selectedAvatarId = ownedAvatarIds.includes(value?.selectedAvatarId ?? "")
    ? value?.selectedAvatarId ?? defaultAvatarId
    : defaultAvatarId;
  const premiumFrameIds = value?.premiumPass
    ? avatarFrameOptions
        .filter((frame) => frame.premium)
        .map((frame) => frame.id)
    : [];
  const ownedAvatarFrameIds = Array.from(
    new Set([
      ...starterAvatarFrameIds,
      ...premiumFrameIds,
      ...(value?.ownedAvatarFrameIds ?? []),
    ])
  );
  const selectedAvatarFrameId = ownedAvatarFrameIds.includes(
    value?.selectedAvatarFrameId ?? ""
  )
    ? value?.selectedAvatarFrameId ?? defaultAvatarFrameId
    : defaultAvatarFrameId;
  const premiumCardBackIds = value?.premiumPass
    ? cardBackOptions
        .filter((cardBack) => cardBack.premium)
        .map((cardBack) => cardBack.id)
    : [];
  const ownedCardBackIds = Array.from(
    new Set([
      ...starterCardBackIds,
      ...premiumCardBackIds,
      ...(value?.ownedCardBackIds ?? []),
    ])
  );
  const selectedCardBackId = ownedCardBackIds.includes(
    value?.selectedCardBackId ?? ""
  )
    ? value?.selectedCardBackId ?? defaultCardBackId
    : defaultCardBackId;
  const premiumTableSkinIds = value?.premiumPass
    ? tableSkinOptions
        .filter((tableSkin) => tableSkin.premium)
        .map((tableSkin) => tableSkin.id)
    : [];
  const ownedTableSkinIds = Array.from(
    new Set([
      ...starterTableSkinIds,
      ...premiumTableSkinIds,
      ...(value?.ownedTableSkinIds ?? []),
    ])
  );
  const selectedTableSkinId = ownedTableSkinIds.includes(
    value?.selectedTableSkinId ?? ""
  )
    ? value?.selectedTableSkinId ?? defaultTableSkinId
    : defaultTableSkinId;

  return {
    ...defaultWallet,
    ...value,
    selectedAvatarId,
    ownedAvatarIds,
    selectedAvatarFrameId,
    ownedAvatarFrameIds,
    selectedCardBackId,
    ownedCardBackIds,
    selectedTableSkinId,
    ownedTableSkinIds,
    gamesPlayed: value?.gamesPlayed ?? 0,
    wins: value?.wins ?? 0,
    pestCardsPlayed: value?.pestCardsPlayed ?? 0,
    dailyMissionDate: currentDay,
    dailyMissionClaims: hasCurrentDailyProgress
      ? value?.dailyMissionClaims ?? []
      : [],
    dailyGamesPlayed: hasCurrentDailyProgress ? value?.dailyGamesPlayed ?? 0 : 0,
    dailyWins: hasCurrentDailyProgress ? value?.dailyWins ?? 0 : 0,
    dailyPestCardsPlayed: hasCurrentDailyProgress
      ? value?.dailyPestCardsPlayed ?? 0
      : 0,
    winStreak: value?.winStreak ?? 0,
    bestWinStreak: value?.bestWinStreak ?? 0,
    claimedMilestoneRewards: value?.claimedMilestoneRewards ?? [],
    claimedSeasonRewards: value?.claimedSeasonRewards ?? [],
    rewardedRounds: value?.rewardedRounds ?? [],
  };
}

export function useEconomy() {
  const [wallet, setWallet] = useState<Wallet>(defaultWallet);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const walletRef = useRef(wallet);

  useEffect(() => {
    walletRef.current = wallet;
  }, [wallet]);

  useEffect(() => {
    async function loadWallet() {
      const storedWallet = await AsyncStorage.getItem(walletStorageKey);
      const parsedWallet = storedWallet
        ? (JSON.parse(storedWallet) as Partial<Wallet>)
        : null;
      const nextWallet = normalizeWallet(parsedWallet);
      const currentDay = todayKey();

      if (nextWallet.lastDailyReward !== currentDay) {
        nextWallet.coins += DAILY_LOGIN_COINS;
        nextWallet.lastDailyReward = currentDay;
      }

      setWallet(nextWallet);
      setLoaded(true);
    }

    loadWallet().catch(() => {
      setWallet(defaultWallet);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;

    AsyncStorage.setItem(walletStorageKey, JSON.stringify(wallet)).catch(
      () => {}
    );
  }, [loaded, wallet]);

  const season = useMemo(() => getSeasonProgress(wallet.xp), [wallet.xp]);
  const canClaimDailyGems = wallet.lastGemReward !== todayKey();

  function spendCoins(amount: number, reason = "Coins uitgegeven") {
    if (wallet.coins < amount) {
      setNotice(`Niet genoeg coins. Je hebt ${amount} coins nodig.`);
      return false;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      coins: Math.max(0, currentWallet.coins - amount),
    }));
    setNotice(`${reason}: -${amount} coins.`);
    return true;
  }

  function refundCoins(amount: number, reason = "Inzet teruggestort") {
    setWallet((currentWallet) => ({
      ...currentWallet,
      coins: currentWallet.coins + amount,
    }));
    setNotice(`${reason}: +${amount} coins.`);
  }

  function spendGems(amount: number, reason = "Gems gebruikt") {
    if (wallet.gems < amount) {
      setNotice(`Niet genoeg gems. Je hebt ${amount} gems nodig.`);
      return false;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      gems: Math.max(0, currentWallet.gems - amount),
    }));
    setNotice(`${reason}: -${amount} gems.`);
    return true;
  }

  function refundGems(amount: number, reason = "Gems teruggestort") {
    setWallet((currentWallet) => ({
      ...currentWallet,
      gems: currentWallet.gems + amount,
    }));
    setNotice(`${reason}: +${amount} gems.`);
  }

  function buyCoinsWithGems() {
    if (wallet.gems < GEM_PACK_COST) {
      setNotice(`Je hebt ${GEM_PACK_COST} gems nodig voor coins.`);
      return;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      gems: currentWallet.gems - GEM_PACK_COST,
      coins: currentWallet.coins + COINS_PER_GEM_PACK,
    }));
    setNotice(`+${COINS_PER_GEM_PACK} coins gekocht met ${GEM_PACK_COST} gems.`);
  }

  function claimDailyGems() {
    const currentDay = todayKey();

    if (walletRef.current.lastGemReward === currentDay) {
      setNotice("Je daily gem chest is vandaag al geclaimd.");
      return;
    }

    const nextWallet = {
      ...walletRef.current,
      gems: walletRef.current.gems + DAILY_GEMS,
      lastGemReward: currentDay,
    };

    walletRef.current = nextWallet;
    setWallet(nextWallet);
    setNotice(`Daily gem chest: +${DAILY_GEMS} gems.`);
  }

  function previewPremiumPass() {
    setNotice("Premium pass loopt later via Apple/Google in-app purchases.");
  }

  function previewGemPurchase() {
    setNotice("Gems kopen loopt later via Apple/Google in-app purchases.");
  }

  function selectCardBack(cardBackId: string) {
    const cardBack = cardBackOptions.find((item) => item.id === cardBackId);

    if (!cardBack) return;

    const isOwned =
      wallet.ownedCardBackIds.includes(cardBack.id) ||
      (cardBack.premium && wallet.premiumPass);

    if (!isOwned) {
      setNotice(
        cardBack.premium
          ? "Deze kaartback hoort bij de premium pass."
          : "Koop of unlock deze kaartback eerst."
      );
      return;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      selectedCardBackId: cardBack.id,
    }));
    setNotice(`${cardBack.title} is nu je kaartback.`);
  }

  function buyCardBack(cardBackId: string) {
    const cardBack = cardBackOptions.find((item) => item.id === cardBackId);

    if (!cardBack) return;

    if (wallet.ownedCardBackIds.includes(cardBack.id)) {
      selectCardBack(cardBack.id);
      return;
    }

    if (cardBack.premium) {
      setNotice("Premium kaartbacks komen later met de premium pass.");
      return;
    }

    if (cardBack.unlockLevel && season.level < cardBack.unlockLevel) {
      setNotice(`Bereik level ${cardBack.unlockLevel} om dit te unlocken.`);
      return;
    }

    const priceCoins = cardBack.priceCoins ?? 0;

    if (wallet.coins < priceCoins) {
      setNotice(`Je hebt ${priceCoins} coins nodig voor ${cardBack.title}.`);
      return;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      coins: Math.max(0, currentWallet.coins - priceCoins),
      ownedCardBackIds: [
        ...new Set([...currentWallet.ownedCardBackIds, cardBack.id]),
      ],
      selectedCardBackId: cardBack.id,
    }));
    setNotice(`${cardBack.title} gekocht en ingesteld.`);
  }

  function selectTableSkin(tableSkinId: string) {
    const tableSkin = tableSkinOptions.find((item) => item.id === tableSkinId);

    if (!tableSkin) return;

    const isOwned =
      wallet.ownedTableSkinIds.includes(tableSkin.id) ||
      (tableSkin.premium && wallet.premiumPass);

    if (!isOwned) {
      setNotice(
        tableSkin.premium
          ? "Deze tafel hoort bij de premium pass."
          : "Koop deze tafel eerst."
      );
      return;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      selectedTableSkinId: tableSkin.id,
    }));
    setNotice(`${tableSkin.title} is nu je tafel.`);
  }

  function buyTableSkin(tableSkinId: string) {
    const tableSkin = tableSkinOptions.find((item) => item.id === tableSkinId);

    if (!tableSkin) return;

    if (wallet.ownedTableSkinIds.includes(tableSkin.id)) {
      selectTableSkin(tableSkin.id);
      return;
    }

    if (tableSkin.premium) {
      setNotice("Premium tafels komen later met de premium pass.");
      return;
    }

    const priceCoins = tableSkin.priceCoins ?? 0;

    if (wallet.coins < priceCoins) {
      setNotice(`Je hebt ${priceCoins} coins nodig voor ${tableSkin.title}.`);
      return;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      coins: Math.max(0, currentWallet.coins - priceCoins),
      ownedTableSkinIds: [
        ...new Set([...currentWallet.ownedTableSkinIds, tableSkin.id]),
      ],
      selectedTableSkinId: tableSkin.id,
    }));
    setNotice(`${tableSkin.title} gekocht en ingesteld.`);
  }

  function selectAvatar(avatarId: string) {
    const avatar = avatarOptions.find((item) => item.id === avatarId);

    if (!avatar) return;

    const isOwned =
      wallet.ownedAvatarIds.includes(avatar.id) ||
      (avatar.premium && wallet.premiumPass);

    if (!isOwned) {
      setNotice(
        avatar.premium ? "Deze avatar hoort bij de premium pass." : "Koop deze avatar eerst."
      );
      return;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      selectedAvatarId: avatar.id,
    }));
    setNotice(`${avatar.title} is nu je avatar.`);
  }

  function buyAvatar(avatarId: string) {
    const avatar = avatarOptions.find((item) => item.id === avatarId);

    if (!avatar) return;

    if (wallet.ownedAvatarIds.includes(avatar.id)) {
      selectAvatar(avatar.id);
      return;
    }

    if (avatar.premium) {
      setNotice("Premium avatars komen later met de premium pass.");
      return;
    }

    if (avatar.unlockLevel && season.level < avatar.unlockLevel) {
      setNotice(`Bereik level ${avatar.unlockLevel} om dit te unlocken.`);
      return;
    }

    const priceCoins = avatar.priceCoins ?? 0;

    if (wallet.coins < priceCoins) {
      setNotice(`Je hebt ${priceCoins} coins nodig voor ${avatar.title}.`);
      return;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      coins: Math.max(0, currentWallet.coins - priceCoins),
      ownedAvatarIds: [...new Set([...currentWallet.ownedAvatarIds, avatar.id])],
      selectedAvatarId: avatar.id,
    }));
    setNotice(`${avatar.title} gekocht en ingesteld.`);
  }

  function selectAvatarFrame(frameId: string) {
    const frame = avatarFrameOptions.find((item) => item.id === frameId);

    if (!frame) return;

    const isOwned =
      wallet.ownedAvatarFrameIds.includes(frame.id) ||
      (frame.premium && wallet.premiumPass);

    if (!isOwned) {
      setNotice(
        frame.premium
          ? "Dit frame hoort bij de premium pass."
          : "Koop of unlock dit frame eerst."
      );
      return;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      selectedAvatarFrameId: frame.id,
    }));
    setNotice(`${frame.title} is nu je avatar frame.`);
  }

  function buyAvatarFrame(frameId: string) {
    const frame = avatarFrameOptions.find((item) => item.id === frameId);

    if (!frame) return;

    if (wallet.ownedAvatarFrameIds.includes(frame.id)) {
      selectAvatarFrame(frame.id);
      return;
    }

    if (frame.premium) {
      setNotice("Premium frames komen later met de premium pass.");
      return;
    }

    if (frame.unlockLevel && season.level < frame.unlockLevel) {
      setNotice(`Bereik level ${frame.unlockLevel} om dit frame te unlocken.`);
      return;
    }

    const priceCoins = frame.priceCoins ?? 0;

    if (wallet.coins < priceCoins) {
      setNotice(`Je hebt ${priceCoins} coins nodig voor ${frame.title}.`);
      return;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      coins: Math.max(0, currentWallet.coins - priceCoins),
      ownedAvatarFrameIds: [
        ...new Set([...currentWallet.ownedAvatarFrameIds, frame.id]),
      ],
      selectedAvatarFrameId: frame.id,
    }));
    setNotice(`${frame.title} gekocht en ingesteld.`);
  }

  function recordGameResult(roundKey: string, didWin: boolean) {
    const rewardKey = `round-${roundKey}`;

    if (wallet.rewardedRounds.includes(rewardKey)) return;

    const earnedCoins = GAME_PLAYED_COINS + (didWin ? GAME_WIN_COINS : 0);
    const earnedXp = GAME_PLAYED_XP + (didWin ? GAME_WIN_XP : 0);

    setWallet((currentWallet) => {
      if (currentWallet.rewardedRounds.includes(rewardKey)) {
        return currentWallet;
      }

      return {
        ...currentWallet,
        coins: currentWallet.coins + earnedCoins,
        xp: currentWallet.xp + earnedXp,
        gamesPlayed: currentWallet.gamesPlayed + 1,
        wins: currentWallet.wins + (didWin ? 1 : 0),
        dailyMissionDate: todayKey(),
        dailyGamesPlayed: currentWallet.dailyGamesPlayed + 1,
        dailyWins: currentWallet.dailyWins + (didWin ? 1 : 0),
        winStreak: didWin ? currentWallet.winStreak + 1 : 0,
        bestWinStreak: didWin
          ? Math.max(currentWallet.bestWinStreak, currentWallet.winStreak + 1)
          : currentWallet.bestWinStreak,
        rewardedRounds: [...currentWallet.rewardedRounds, rewardKey].slice(-40),
      };
    });
    setNotice(
      didWin
        ? `Gewonnen: +${earnedCoins} coins en +${earnedXp} XP.`
        : `Potje gespeeld: +${earnedCoins} coins en +${earnedXp} XP.`
    );
  }

  function recordPestCardPlayed() {
    setWallet((currentWallet) => ({
      ...currentWallet,
      dailyMissionDate: todayKey(),
      pestCardsPlayed: currentWallet.pestCardsPlayed + 1,
      dailyPestCardsPlayed: currentWallet.dailyPestCardsPlayed + 1,
    }));
  }

  function claimDailyMission(missionId: string) {
    const mission = dailyMissions.find((item) => item.id === missionId);

    if (!mission) return;

    if (wallet.dailyMissionClaims.includes(mission.id)) {
      setNotice("Deze dagmissie is al geclaimd.");
      return;
    }

    if (getDailyMissionProgress(wallet, mission) < mission.target) {
      setNotice("Deze dagmissie is nog niet klaar.");
      return;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      coins: currentWallet.coins + (mission.coins ?? 0),
      gems: currentWallet.gems + (mission.gems ?? 0),
      xp: currentWallet.xp + (mission.xp ?? 0),
      dailyMissionDate: todayKey(),
      dailyMissionClaims: [...currentWallet.dailyMissionClaims, mission.id],
    }));

    const rewards = [
      mission.coins ? `+${mission.coins} coins` : null,
      mission.gems ? `+${mission.gems} gems` : null,
      mission.xp ? `+${mission.xp} XP` : null,
    ].filter(Boolean);

    setNotice(`${mission.title} geclaimd: ${rewards.join(" en ")}.`);
  }

  function claimSeasonReward(rewardId: string) {
    const reward = seasonRewards.find((item) => item.id === rewardId);

    if (!reward) return;

    if (season.level < reward.level) {
      setNotice(`Bereik level ${reward.level} om dit te claimen.`);
      return;
    }

    if (reward.premium && !wallet.premiumPass) {
      setNotice("Deze reward hoort bij de premium pass.");
      return;
    }

    if (wallet.claimedSeasonRewards.includes(reward.id)) {
      setNotice("Deze season reward is al geclaimd.");
      return;
    }

    setWallet((currentWallet) => {
      const ownedCardBackIds = reward.cardBackId
        ? [...new Set([...currentWallet.ownedCardBackIds, reward.cardBackId])]
        : currentWallet.ownedCardBackIds;
      const ownedAvatarFrameIds = reward.avatarFrameId
        ? [
            ...new Set([
              ...currentWallet.ownedAvatarFrameIds,
              reward.avatarFrameId,
            ]),
          ]
        : currentWallet.ownedAvatarFrameIds;
      const ownedTableSkinIds = reward.tableSkinId
        ? [...new Set([...currentWallet.ownedTableSkinIds, reward.tableSkinId])]
        : currentWallet.ownedTableSkinIds;

      return {
        ...currentWallet,
        coins: currentWallet.coins + (reward.coins ?? 0),
        ownedCardBackIds,
        ownedAvatarFrameIds,
        ownedTableSkinIds,
        claimedSeasonRewards: [
          ...currentWallet.claimedSeasonRewards,
          reward.id,
        ],
      };
    });
    setNotice(`${reward.title} geclaimd.`);
  }

  function claimMilestoneReward(rewardId: string) {
    const reward = milestoneRewards.find((item) => item.id === rewardId);

    if (!reward) return;

    if (wallet.claimedMilestoneRewards.includes(reward.id)) {
      setNotice("Dit doel is al geclaimd.");
      return;
    }

    const progress = getMilestoneProgress(wallet, reward);

    if (progress < reward.target) {
      setNotice(`Nog ${reward.target - progress} stap te gaan voor ${reward.title}.`);
      return;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      coins: currentWallet.coins + (reward.coins ?? 0),
      gems: currentWallet.gems + (reward.gems ?? 0),
      claimedMilestoneRewards: [
        ...currentWallet.claimedMilestoneRewards,
        reward.id,
      ],
    }));

    const rewards = [
      reward.coins ? `+${reward.coins} coins` : null,
      reward.gems ? `+${reward.gems} gems` : null,
    ].filter(Boolean);

    setNotice(`${reward.title} geclaimd: ${rewards.join(" en ")}.`);
  }

  return {
    wallet,
    season,
    canClaimDailyGems,
    notice,
    clearNotice: () => setNotice(null),
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
  };
}
