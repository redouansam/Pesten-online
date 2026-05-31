import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import {
  STORAGE_PLAYER_ID,
  STORAGE_PLAYER_NAME,
  STORAGE_ROOM_CODE,
} from "./constants";
import { sessionStore } from "./sessionStore";

export type LoginProvider = "guest" | "apple" | "google";

export type ConsentPlaceholderStatus =
  | "not_requested"
  | "prepared_for_native_release";

export type PlatformIdentity = {
  guestId: string;
  appleGameCenterId: string | null;
  googlePlayGamesId: string | null;
  platformUserId: string;
  loginProvider: LoginProvider;
  hasAcceptedTerms: boolean;
  hasAcceptedPrivacy: boolean;
  hasCompletedTutorial: boolean;
  adsConsentStatus: ConsentPlaceholderStatus;
  trackingConsentStatus: ConsentPlaceholderStatus;
  completedOnboardingAt: number | null;
  completedTutorialAt: number | null;
};

export const ONBOARDING_STORAGE_KEY = "pesten.onboarding.v1";

function createGuestId() {
  return `guest-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createDefaultIdentity(): PlatformIdentity {
  const guestId = createGuestId();

  return {
    guestId,
    appleGameCenterId: null,
    googlePlayGamesId: null,
    platformUserId: guestId,
    loginProvider: "guest",
    hasAcceptedTerms: false,
    hasAcceptedPrivacy: false,
    hasCompletedTutorial: false,
    adsConsentStatus: "not_requested",
    trackingConsentStatus: "not_requested",
    completedOnboardingAt: null,
    completedTutorialAt: null,
  };
}

function normalizeIdentity(value: Partial<PlatformIdentity>): PlatformIdentity {
  const fallback = createDefaultIdentity();
  const guestId = value.guestId || fallback.guestId;

  return {
    ...fallback,
    ...value,
    guestId,
    platformUserId: value.platformUserId || guestId,
    loginProvider: value.loginProvider ?? "guest",
    appleGameCenterId: value.appleGameCenterId ?? null,
    googlePlayGamesId: value.googlePlayGamesId ?? null,
    completedOnboardingAt: value.completedOnboardingAt ?? null,
    completedTutorialAt: value.completedTutorialAt ?? null,
  };
}

function shouldForceOnboardingReset() {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;

  return new URLSearchParams(window.location.search).get("resetOnboarding") === "1";
}

function clearForceOnboardingResetParam() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  if (!window.history?.replaceState) return;

  const url = new URL(window.location.href);
  url.searchParams.delete("resetOnboarding");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;

  window.history.replaceState(null, "", nextUrl || "/");
}

async function saveIdentity(identity: PlatformIdentity) {
  await sessionStore.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(identity));
}

export function useOnboardingState() {
  const [identity, setIdentity] = useState<PlatformIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadIdentity() {
      const forceReset = shouldForceOnboardingReset();

      if (forceReset) {
        await sessionStore.multiRemove([
          ONBOARDING_STORAGE_KEY,
          STORAGE_PLAYER_ID,
          STORAGE_ROOM_CODE,
        ]);
        await AsyncStorage.removeItem(STORAGE_PLAYER_NAME);
        clearForceOnboardingResetParam();
      }

      const storedIdentity = forceReset
        ? null
        : await sessionStore.getItem(ONBOARDING_STORAGE_KEY);

      if (storedIdentity) {
        try {
          const parsed = normalizeIdentity(JSON.parse(storedIdentity));
          if (isMounted) setIdentity(parsed);
          return;
        } catch {
          await sessionStore.multiRemove([ONBOARDING_STORAGE_KEY]);
        }
      }

      if (!forceReset) {
        const existingName = await AsyncStorage.getItem(STORAGE_PLAYER_NAME);

        if (existingName) {
          const migratedAt = Date.now();
          const migratedIdentity = normalizeIdentity({
            hasAcceptedTerms: true,
            hasAcceptedPrivacy: true,
            hasCompletedTutorial: true,
            completedOnboardingAt: migratedAt,
            completedTutorialAt: migratedAt,
          });
          await saveIdentity(migratedIdentity);
          if (isMounted) setIdentity(migratedIdentity);
          return;
        }
      }

      if (isMounted) setIdentity(createDefaultIdentity());
    }

    loadIdentity()
      .catch(() => {
        if (isMounted) setIdentity(createDefaultIdentity());
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const hasCompletedOnboarding = useMemo(
    () => Boolean(identity?.hasAcceptedTerms && identity?.hasAcceptedPrivacy),
    [identity?.hasAcceptedPrivacy, identity?.hasAcceptedTerms]
  );

  const completeGuestOnboarding = useCallback(
    async (acceptedTerms: boolean) => {
      if (!acceptedTerms) {
        setNotice("Accepteer eerst de voorwaarden en het privacybeleid.");
        return null;
      }

      const nextIdentity = normalizeIdentity({
        ...(identity ?? createDefaultIdentity()),
        loginProvider: "guest",
        platformUserId: identity?.guestId,
        hasAcceptedTerms: true,
        hasAcceptedPrivacy: true,
        completedOnboardingAt: identity?.completedOnboardingAt ?? Date.now(),
      });

      await saveIdentity(nextIdentity);
      setIdentity(nextIdentity);
      setNotice("Je speelt nu als gast.");
      return nextIdentity;
    },
    [identity]
  );

  const completeTutorial = useCallback(async () => {
    const nextIdentity = normalizeIdentity({
      ...(identity ?? createDefaultIdentity()),
      hasCompletedTutorial: true,
      completedTutorialAt: Date.now(),
    });

    await saveIdentity(nextIdentity);
    setIdentity(nextIdentity);
    setNotice("Tutorial afgerond.");
    return nextIdentity;
  }, [identity]);

  const showPlatformPlaceholder = useCallback((provider: LoginProvider) => {
    const label = provider === "apple" ? "Apple / Game Center" : "Google Play Games";
    setNotice(`${label} komt later beschikbaar in de app-release.`);
  }, []);

  const showLegalPlaceholder = useCallback((kind: "terms" | "privacy") => {
    setNotice(
      kind === "terms"
        ? "Voorwaarden komen later als juridische pagina."
        : "Privacybeleid komt later als juridische pagina."
    );
  }, []);

  return {
    identity,
    isLoading,
    hasCompletedOnboarding,
    notice,
    clearNotice: () => setNotice(null),
    completeGuestOnboarding,
    completeTutorial,
    showPlatformPlaceholder,
    showLegalPlaceholder,
  };
}
