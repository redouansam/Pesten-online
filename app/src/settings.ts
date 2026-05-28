import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type CardSizeSetting = "compact" | "normal" | "large";
export type MotionSetting = "low" | "normal";
export type LanguageSetting = "nl" | "en";

export type AppSettings = {
  hapticsEnabled: boolean;
  cardSize: CardSizeSetting;
  motionLevel: MotionSetting;
  language: LanguageSetting;
};

export const defaultAppSettings: AppSettings = {
  hapticsEnabled: true,
  cardSize: "normal",
  motionLevel: "normal",
  language: "nl",
};

const settingsStorageKey = "pesten.settings.v1";

function normalizeSettings(value: Partial<AppSettings> | null): AppSettings {
  const cardSize: CardSizeSetting =
    value?.cardSize === "compact" || value?.cardSize === "large"
      ? value.cardSize
      : "normal";
  const motionLevel: MotionSetting =
    value?.motionLevel === "low" ? "low" : "normal";
  const language: LanguageSetting = "nl";

  return {
    ...defaultAppSettings,
    ...value,
    cardSize,
    motionLevel,
    language,
  };
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const storedSettings = await AsyncStorage.getItem(settingsStorageKey);
      const parsedSettings = storedSettings
        ? (JSON.parse(storedSettings) as Partial<AppSettings>)
        : null;

      setSettings(normalizeSettings(parsedSettings));
      setLoaded(true);
    }

    loadSettings().catch(() => {
      setSettings(defaultAppSettings);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;

    AsyncStorage.setItem(settingsStorageKey, JSON.stringify(settings)).catch(
      () => {}
    );
  }, [loaded, settings]);

  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      ...patch,
    }));
  }

  return {
    settings,
    updateSettings,
  };
}
