import Constants from "expo-constants";
import { Platform } from "react-native";

const SERVER_PORT = "3001";

function getHostFromUri(uri?: string | null) {
  if (!uri) return undefined;

  const withoutProtocol = uri.replace(/^[a-z]+:\/\//i, "");
  const host = withoutProtocol.split(/[/:]/)[0];

  return host || undefined;
}

function getWebHost() {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return undefined;
  }

  return window.location.hostname || undefined;
}

function getExpoHost() {
  const constants = Constants as typeof Constants & {
    debuggerHost?: string;
    manifest?: { debuggerHost?: string } | null;
    manifest2?: {
      extra?: {
        expoClient?: { hostUri?: string };
        expoGo?: { debuggerHost?: string };
      };
    } | null;
  };

  return (
    getHostFromUri(Constants.expoConfig?.hostUri) ??
    getHostFromUri(constants.manifest2?.extra?.expoClient?.hostUri) ??
    getHostFromUri(constants.manifest2?.extra?.expoGo?.debuggerHost) ??
    getHostFromUri(constants.manifest?.debuggerHost) ??
    getHostFromUri(constants.debuggerHost)
  );
}

function inferServerUrl() {
  const host = getWebHost() ?? getExpoHost() ?? "localhost";

  return `http://${host}:${SERVER_PORT}`;
}

export const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? inferServerUrl();
