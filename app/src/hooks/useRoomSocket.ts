import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { Keyboard } from "react-native";

import {
  STORAGE_PLAYER_ID,
  STORAGE_PLAYER_NAME,
  STORAGE_ROOM_CODE,
} from "../constants";
import { sessionStore } from "../sessionStore";
import { socket } from "../socket";
import { Card, PublicRoomState, Suit } from "../types";

type PendingAction =
  | "create"
  | "join"
  | "ready"
  | "start"
  | "redraw"
  | "rematch"
  | null;

export type ConnectionState =
  | "connecting"
  | "online"
  | "offline"
  | "reconnecting";

export function useRoomSocket(hapticsEnabled = true) {
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [playerId, setPlayerId] = useState("");
  const [name, setLocalName] = useState("Speler");
  const [hasSavedName, setHasSavedName] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hapticsEnabledRef = useRef(hapticsEnabled);

  useEffect(() => {
    hapticsEnabledRef.current = hapticsEnabled;
  }, [hapticsEnabled]);

  useEffect(() => {
    async function loadProfileName() {
      const savedName = await AsyncStorage.getItem(STORAGE_PLAYER_NAME);

      if (!savedName) return;

      setLocalName(savedName);
      setHasSavedName(true);
    }

    socket.connect();
    loadProfileName().catch(() => {});

    async function tryReconnect() {
      const savedPlayerId = await sessionStore.getItem(STORAGE_PLAYER_ID);
      const savedRoomCode = await sessionStore.getItem(STORAGE_ROOM_CODE);

      if (savedPlayerId && savedRoomCode) {
        socket.emit("reconnect_room", {
          playerId: savedPlayerId,
          code: savedRoomCode,
        });
      }
    }

    function onConnect() {
      setConnected(true);
      setConnectionState("online");
      setErrorMessage(null);
      tryReconnect().catch(() => {});
    }

    function onDisconnect() {
      setConnected(false);
      setConnectionState("offline");
      setPendingAction(null);
      setErrorMessage("Verbinding weggevallen. We verbinden automatisch opnieuw.");
    }

    function onReconnectAttempt() {
      setConnectionState("reconnecting");
    }

    function onReconnect() {
      setConnectionState("online");
      setErrorMessage(null);
      tryReconnect().catch(() => {});
    }

    function onReconnectFailed() {
      setConnectionState("offline");
      setErrorMessage("Opnieuw verbinden lukt niet. Check je netwerk.");
    }

    function onConnectError() {
      setConnected(false);
      setConnectionState("reconnecting");
      setErrorMessage("Server wordt wakker. Dit kan 30-60 sec duren.");
    }

    async function saveSession(data: { code: string; playerId: string }) {
      setPlayerId(data.playerId);
      await sessionStore.setItem(STORAGE_PLAYER_ID, data.playerId);
      await sessionStore.setItem(STORAGE_ROOM_CODE, data.code);
    }

    function onRoomCreated(data: { code: string; playerId: string }) {
      setPendingAction(null);
      setErrorMessage(null);
      saveSession(data).catch(() => {});
    }

    function onRoomJoined(data: { code: string; playerId: string }) {
      setPendingAction(null);
      setErrorMessage(null);
      saveSession(data).catch(() => {});
    }

    function onReconnected(data: { code: string; playerId: string }) {
      setPendingAction(null);
      setErrorMessage(null);
      saveSession(data).catch(() => {});
    }

    function onSessionReconnectFailed() {
      sessionStore.multiRemove([STORAGE_PLAYER_ID, STORAGE_ROOM_CODE]).catch(
        () => {}
      );
      setPendingAction(null);
      setRoom(null);
      setPlayerId("");
      setErrorMessage("Kamer niet gevonden. Maak of join opnieuw.");
    }

    function onRoomUpdated(updatedRoom: PublicRoomState) {
      setPendingAction(null);
      setRoom(updatedRoom);
      sessionStore.setItem(STORAGE_ROOM_CODE, updatedRoom.code).catch(() => {});
    }

    function onErrorMessage(message: string) {
      setPendingAction(null);
      setErrorMessage(message);
      if (hapticsEnabledRef.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {}
        );
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_created", onRoomCreated);
    socket.on("room_joined", onRoomJoined);
    socket.on("reconnected", onReconnected);
    socket.on("reconnect_failed", onSessionReconnectFailed);
    socket.on("room_updated", onRoomUpdated);
    socket.on("error_message", onErrorMessage);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect", onReconnect);
    socket.io.on("reconnect_failed", onReconnectFailed);

    function resumeFromBackground() {
      setConnectionState(socket.connected ? "online" : "reconnecting");
      setErrorMessage(null);

      if (!socket.connected) {
        socket.connect();
      }

      tryReconnect().catch(() => {});
    }

    function onVisibilityChange() {
      if (typeof document === "undefined" || document.visibilityState !== "visible") {
        return;
      }

      resumeFromBackground();
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    if (
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function"
    ) {
      window.addEventListener("pageshow", resumeFromBackground);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_created", onRoomCreated);
      socket.off("room_joined", onRoomJoined);
      socket.off("reconnected", onReconnected);
      socket.off("reconnect_failed", onSessionReconnectFailed);
      socket.off("room_updated", onRoomUpdated);
      socket.off("error_message", onErrorMessage);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect", onReconnect);
      socket.io.off("reconnect_failed", onReconnectFailed);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (
        typeof window !== "undefined" &&
        typeof window.removeEventListener === "function"
      ) {
        window.removeEventListener("pageshow", resumeFromBackground);
      }
      socket.disconnect();
    };
  }, []);

  function createRoom() {
    if (!connected) {
      setErrorMessage("Server niet verbonden. Probeer het zo opnieuw.");
      return;
    }

    Keyboard.dismiss();
    setPendingAction("create");
    setErrorMessage(null);
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    socket.emit("create_room", {
      name,
    });
  }

  function joinRoom() {
    const normalizedRoomCode = roomCodeInput
      .trim()
      .toUpperCase()
      .replace(/\s/g, "");

    if (!connected) {
      setErrorMessage("Server niet verbonden. Probeer het zo opnieuw.");
      return;
    }

    if (normalizedRoomCode.length < 5) {
      setErrorMessage("Vul eerst de volledige kamercode in.");
      return;
    }

    Keyboard.dismiss();
    setPendingAction("join");
    setErrorMessage(null);
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    socket.emit("join_room", {
      code: normalizedRoomCode,
      name,
    });
  }

  function toggleReady() {
    setPendingAction("ready");
    setErrorMessage(null);
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    socket.emit("toggle_ready");
  }

  function startGame() {
    setPendingAction("start");
    setErrorMessage(null);
    if (hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    }
    socket.emit("start_game");
  }

  async function leaveRoom() {
    Keyboard.dismiss();
    setPendingAction(null);
    setErrorMessage(null);
    socket.emit("leave_room");
    setRoom(null);
    setPlayerId("");
    await sessionStore.multiRemove([STORAGE_PLAYER_ID, STORAGE_ROOM_CODE]);
  }

  function playCard(card: Card, chosenSuit?: Suit) {
    socket.emit("play_card", {
      cardId: card.id,
      chosenSuit: card.value === "J" ? chosenSuit : undefined,
    });
  }

  function drawCards() {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    socket.emit("draw_cards");
  }

  function passTurn() {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    socket.emit("pass_turn");
  }

  function redrawDrawnCard() {
    setPendingAction("redraw");
    setErrorMessage(null);
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    socket.emit("redraw_drawn_card");
  }

  function sortHand(mode: "suit" | "value") {
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    socket.emit("sort_hand", {
      mode,
    });
  }

  function playAgain(wantsAgain: boolean) {
    setPendingAction("rematch");
    setErrorMessage(null);
    socket.emit("play_again_response", {
      wantsAgain,
    });
  }

  function clearError() {
    setErrorMessage(null);
  }

  function retryConnection() {
    setConnectionState("connecting");
    setErrorMessage(null);
    socket.connect();
  }

  function setName(value: string) {
    const nextName = value.trim().slice(0, 18) || "Speler";

    setLocalName(nextName);
    setHasSavedName(true);
    AsyncStorage.setItem(STORAGE_PLAYER_NAME, nextName).catch(() => {});

    if (room && !room.started) {
      socket.emit("update_name", {
        name: nextName,
      });
    }
  }

  return {
    connected,
    connectionState,
    playerId,
    name,
    hasSavedName,
    setName,
    roomCodeInput,
    setRoomCodeInput,
    room,
    pendingAction,
    errorMessage,
    clearError,
    retryConnection,
    createRoom,
    joinRoom,
    toggleReady,
    startGame,
    leaveRoom,
    playCard,
    drawCards,
    passTurn,
    redrawDrawnCard,
    sortHand,
    playAgain,
  };
}
