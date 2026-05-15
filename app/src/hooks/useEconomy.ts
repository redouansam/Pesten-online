import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";

import {
  cardBackOptions,
  defaultCardBackId,
  starterCardBackIds,
} from "../cardBackImages";
import {
  COINS_PER_GEM_PACK,
  DAILY_GEMS,
  DAILY_LOGIN_COINS,
  GAME_PLAYED_COINS,
  GAME_PLAYED_XP,
  GAME_WIN_COINS,
  GAME_WIN_XP,
  GEM_PACK_COST,
  Wallet,
  defaultWallet,
  getSeasonProgress,
  seasonRewards,
} from "../economy";

const walletStorageKey = "pesten.wallet.v1";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeWallet(value: Partial<Wallet> | null): Wallet {
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

  return {
    ...defaultWallet,
    ...value,
    selectedCardBackId,
    ownedCardBackIds,
    gamesPlayed: value?.gamesPlayed ?? 0,
    wins: value?.wins ?? 0,
    winStreak: value?.winStreak ?? 0,
    bestWinStreak: value?.bestWinStreak ?? 0,
    claimedSeasonRewards: value?.claimedSeasonRewards ?? [],
    rewardedRounds: value?.rewardedRounds ?? [],
  };
}

export function useEconomy() {
  const [wallet, setWallet] = useState<Wallet>(defaultWallet);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

    if (wallet.lastGemReward === currentDay) {
      setNotice("Je daily gem chest is vandaag al geclaimd.");
      return;
    }

    setWallet((currentWallet) => ({
      ...currentWallet,
      gems: currentWallet.gems + DAILY_GEMS,
      lastGemReward: currentDay,
    }));
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

      return {
        ...currentWallet,
        coins: currentWallet.coins + (reward.coins ?? 0),
        ownedCardBackIds,
        claimedSeasonRewards: [
          ...currentWallet.claimedSeasonRewards,
          reward.id,
        ],
      };
    });
    setNotice(`${reward.title} geclaimd.`);
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
    recordGameResult,
    claimSeasonReward,
  };
}
