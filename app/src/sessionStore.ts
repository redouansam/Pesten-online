import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

function canUseSessionStorage() {
  return Platform.OS === "web" && typeof window !== "undefined";
}

export const sessionStore = {
  async getItem(key: string) {
    if (canUseSessionStorage()) {
      return window.sessionStorage.getItem(key);
    }

    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string) {
    if (canUseSessionStorage()) {
      window.sessionStorage.setItem(key, value);
      return;
    }

    await AsyncStorage.setItem(key, value);
  },

  async multiRemove(keys: string[]) {
    if (canUseSessionStorage()) {
      for (const key of keys) {
        window.sessionStorage.removeItem(key);
      }

      return;
    }

    await AsyncStorage.multiRemove(keys);
  },
};
