import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

function canUseWebStorage() {
  return Platform.OS === "web" && typeof window !== "undefined";
}

export const sessionStore = {
  async getItem(key: string) {
    if (canUseWebStorage()) {
      const localValue = window.localStorage.getItem(key);

      if (localValue) return localValue;

      const legacySessionValue = window.sessionStorage.getItem(key);

      if (legacySessionValue) {
        window.localStorage.setItem(key, legacySessionValue);
      }

      return legacySessionValue;
    }

    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string) {
    if (canUseWebStorage()) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.setItem(key, value);
      return;
    }

    await AsyncStorage.setItem(key, value);
  },

  async multiRemove(keys: string[]) {
    if (canUseWebStorage()) {
      for (const key of keys) {
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
      }

      return;
    }

    await AsyncStorage.multiRemove(keys);
  },
};
