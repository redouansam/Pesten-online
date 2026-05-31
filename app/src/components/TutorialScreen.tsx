import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { styles } from "../styles";

const tutorialSteps = [
  {
    title: "Welkom",
    text: "Welkom! We leren je kort hoe Pesten werkt.",
    tableLabel: "Start",
  },
  {
    title: "Kaart selecteren",
    text: "Tik op een kaart om deze te selecteren.",
    tableLabel: "Leg",
  },
  {
    title: "Kaart leggen",
    text: "Leg een kaart die past bij kleur, symbool of waarde.",
    tableLabel: "Leg",
  },
  {
    title: "Kaart trekken",
    text: "Trek een kaart als je niets kunt leggen.",
    tableLabel: "Trek",
  },
  {
    title: "Boer kiest symbool",
    text: "Met een Boer kies je een nieuw symbool.",
    tableLabel: "J",
  },
  {
    title: "2/Joker stapelen",
    text: "Met 2 en Joker bouw je een pakstraf op.",
    tableLabel: "+",
  },
  {
    title: "Niet eindigen met pestkaart",
    text: "Je mag niet eindigen met een pestkaart.",
    tableLabel: "Pest",
  },
  {
    title: "Klaar",
    text: "Je bent klaar voor online spelen.",
    tableLabel: "Online",
  },
];

type TutorialScreenProps = {
  onComplete: () => Promise<void> | void;
  onSkip: () => Promise<void> | void;
};

export function TutorialScreen({ onComplete, onSkip }: TutorialScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const currentStep = tutorialSteps[stepIndex];
  const isLastStep = stepIndex === tutorialSteps.length - 1;

  async function finishTutorial() {
    setIsSaving(true);
    await onComplete();
    setIsSaving(false);
  }

  async function skipTutorial() {
    setIsSaving(true);
    await onSkip();
    setIsSaving(false);
  }

  return (
    <View style={styles.tutorialShell}>
      <View style={styles.tutorialTopBar}>
        <Text style={styles.tutorialProgressText}>
          Stap {stepIndex + 1}/{tutorialSteps.length}
        </Text>
        <Pressable style={styles.tutorialSkipButton} onPress={skipTutorial}>
          <Text style={styles.tutorialSkipText}>
            {isSaving ? "..." : "Overslaan"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.tutorialStage}>
        <View style={styles.tutorialOpponentRow}>
          <View style={styles.tutorialAvatar} />
          <View style={styles.tutorialCardBack} />
          <View style={styles.tutorialCardBack} />
        </View>

        <LinearGradient
          colors={["#14352a", "#0c231d"]}
          style={styles.tutorialTable}
        >
          <View style={styles.tutorialDrawPile}>
            <Text style={styles.tutorialPileText}>Trek</Text>
          </View>
          <View style={styles.tutorialDiscardPile}>
            <Text style={styles.tutorialDiscardText}>{currentStep.tableLabel}</Text>
          </View>
        </LinearGradient>

        <View style={styles.tutorialHandRow}>
          {["7", "J", "2", "K"].map((label) => (
            <View
              key={label}
              style={[
                styles.tutorialHandCard,
                currentStep.tableLabel === label && styles.tutorialHandCardActive,
              ]}
            >
              <Text style={styles.tutorialHandCardText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <LinearGradient
        colors={["rgba(247,243,236,0.99)", "rgba(238,230,216,0.99)"]}
        style={styles.tutorialCoachCard}
      >
        <Text style={styles.tutorialCoachEyebrow}>Tutorial</Text>
        <Text style={styles.tutorialCoachTitle}>{currentStep.title}</Text>
        <Text style={styles.tutorialCoachText}>{currentStep.text}</Text>

        <View style={styles.tutorialActionRow}>
          <Pressable
            style={[
              styles.tutorialSecondaryButton,
              stepIndex === 0 && styles.disabledButton,
            ]}
            onPress={() => setStepIndex((current) => Math.max(0, current - 1))}
            disabled={stepIndex === 0}
          >
            <Text style={styles.tutorialSecondaryText}>Terug</Text>
          </Pressable>

          <Pressable
            style={styles.tutorialPrimaryButton}
            onPress={
              isLastStep
                ? finishTutorial
                : () => setStepIndex((current) => current + 1)
            }
          >
            <Text style={styles.tutorialPrimaryText}>
              {isSaving ? "Opslaan..." : isLastStep ? "Klaar" : "Volgende"}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}
