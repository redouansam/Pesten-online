import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { platformLoginPlaceholders } from "../platformFeatures";
import type { LoginProvider, PlatformIdentity } from "../onboarding";
import { styles } from "../styles";

type OnboardingScreenProps = {
  isLoading: boolean;
  notice: string | null;
  onClearNotice: () => void;
  onContinueAsGuest: (acceptedTerms: boolean) => Promise<PlatformIdentity | null>;
  onOpenTutorial: () => void;
  onShowLegal: (kind: "terms" | "privacy") => void;
  onShowPlatformPlaceholder: (provider: LoginProvider) => void;
};

export function OnboardingScreen({
  isLoading,
  notice,
  onClearNotice,
  onContinueAsGuest,
  onOpenTutorial,
  onShowLegal,
  onShowPlatformPlaceholder,
}: OnboardingScreenProps) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [isContinuing, setIsContinuing] = useState(false);
  const visibleNotice = localNotice ?? notice;

  async function continueAsGuest() {
    if (!acceptedTerms) {
      setLocalNotice("Accepteer eerst de voorwaarden en het privacybeleid.");
      return;
    }

    setLocalNotice(null);
    setIsContinuing(true);
    await onContinueAsGuest(acceptedTerms);
    setIsContinuing(false);
  }

  function showPlatform(provider: LoginProvider) {
    setLocalNotice(null);
    onShowPlatformPlaceholder(provider);
  }

  function showLegal(kind: "terms" | "privacy") {
    setLocalNotice(null);
    onShowLegal(kind);
  }

  return (
    <View style={styles.onboardingShell}>
      <ScrollView
        contentContainerStyle={styles.onboardingScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.onboardingTop}>
          <View style={styles.onboardingLogoMark}>
            <Text style={styles.onboardingLogoText}>P</Text>
          </View>
          <Text style={styles.onboardingEyebrow}>Welkom aan tafel</Text>
          <Text style={styles.onboardingTitle}>Pesten Online</Text>
          <Text style={styles.onboardingSubtitle}>
            Speel als gast, leer de knoppen en stap daarna rustig online in.
          </Text>
        </View>

        <LinearGradient
          colors={["rgba(247,243,236,0.98)", "rgba(238,230,216,0.98)"]}
          style={styles.onboardingCard}
        >
          {isLoading ? (
            <View style={styles.onboardingLoadingCard}>
              <Text style={styles.onboardingLoadingText}>App voorbereiden...</Text>
            </View>
          ) : (
            <>
              <Pressable
                style={[
                  styles.onboardingPrimaryButton,
                  (!acceptedTerms || isContinuing) && styles.disabledButton,
                ]}
                onPress={continueAsGuest}
                disabled={!acceptedTerms || isContinuing}
              >
                <Text style={styles.onboardingPrimaryText}>
                  {isContinuing ? "Starten..." : "Speel als gast"}
                </Text>
                <Text style={styles.onboardingPrimarySubText}>
                  Start met korte uitleg
                </Text>
              </Pressable>

              {platformLoginPlaceholders.map((placeholder) => (
                <Pressable
                  key={placeholder.provider}
                  style={styles.onboardingPlaceholderButton}
                  onPress={() => showPlatform(placeholder.provider)}
                >
                  <Text style={styles.onboardingPlaceholderTitle}>
                    {placeholder.title}
                  </Text>
                  <Text style={styles.onboardingPlaceholderText}>
                    {placeholder.subtitle}
                  </Text>
                </Pressable>
              ))}

              <Pressable
                style={styles.onboardingTutorialButton}
                onPress={onOpenTutorial}
              >
                <View style={styles.onboardingTutorialIcon}>
                  <Text style={styles.onboardingTutorialIconText}>?</Text>
                </View>
                <View style={styles.onboardingTutorialCopy}>
                  <Text style={styles.onboardingTutorialTitle}>
                    Tutorial bekijken
                  </Text>
                  <Text style={styles.onboardingTutorialText}>
                    Leer kort hoe leggen, pakken en pestkaarten werken.
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.onboardingTermsRow}
                onPress={() => {
                  setLocalNotice(null);
                  onClearNotice();
                  setAcceptedTerms((current) => !current);
                }}
              >
                <View
                  style={[
                    styles.onboardingCheckbox,
                    acceptedTerms && styles.onboardingCheckboxChecked,
                  ]}
                >
                  <Text style={styles.onboardingCheckboxText}>
                    {acceptedTerms ? "OK" : ""}
                  </Text>
                </View>
                <Text style={styles.onboardingTermsText}>
                  Ik accepteer de voorwaarden en het privacybeleid.
                </Text>
              </Pressable>

              <View style={styles.onboardingLegalRow}>
                <Pressable onPress={() => showLegal("terms")}>
                  <Text style={styles.onboardingLegalText}>Voorwaarden</Text>
                </Pressable>
                <Text style={styles.onboardingLegalDivider}>/</Text>
                <Pressable onPress={() => showLegal("privacy")}>
                  <Text style={styles.onboardingLegalText}>Privacybeleid</Text>
                </Pressable>
              </View>
            </>
          )}
        </LinearGradient>

        {visibleNotice ? (
          <Pressable
            style={styles.onboardingNotice}
            onPress={() => {
              setLocalNotice(null);
              onClearNotice();
            }}
          >
            <Text style={styles.onboardingNoticeText}>{visibleNotice}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
