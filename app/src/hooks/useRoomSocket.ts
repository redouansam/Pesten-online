import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { AppState, Keyboard } from "react-native";

import {
  STORAGE_PLAYER_ID,
  STORAGE_PLAYER_NAME,
  STORAGE_ROOM_CODE,
} from "../constants";
import { sessionStore } from "../sessionStore";
import { socket } from "../socket";
import { Card, PublicRoomState, PublicRoomSummary, Suit } from "../types";

type PendingAction =
  | "create"
  | "join"
  | "quick"
  | "joinPublic"
  | "listPublic"
  | "bot"
  | "start"
  | "redraw"
  | "rematch"
  | null;

type RedrawRequestPayload = {
  requestId: string;
  offerId: string;
  availableGems: number;
};

type RedrawSuccess = {
  requestId?: string;
  costGems: number;
  offerId?: string;
};

export type ConnectionState =
  | "connecting"
  | "online"
  | "offline"
  | "reconnecting";

export function useRoomSocket(hapticsEnabled = true, enabled = true) {
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [playerId, setPlayerId] = useState("");
  const [name, setLocalName] = useState("Speler");
  const [hasSavedName, setHasSavedName] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [matchmakingStatus, setMatchmakingStatus] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [redrawSuccess, setRedrawSuccess] = useState<RedrawSuccess | null>(null);
  const hapticsEnabledRef = useRef(hapticsEnabled);
  const nameRef = useRef(name);
  const playerIdRef = useRef(playerId);
  const pendingActionRef = useRef<PendingAction>(pendingAction);

  useEffect(() => {
    hapticsEnabledRef.current = hapticsEnabled;
  }, [hapticsEnabled]);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    pendingActionRef.current = pendingAction;
  }, [pendingAction]);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      setConnectionState("offline");
      setPendingAction(null);
      return;
    }

    async function loadProfileName() {
      const savedName = await AsyncStorage.getItem(STORAGE_PLAYER_NAME);

      if (!savedName) return;

      nameRef.current = savedName;
      setLocalName(savedName);
      setHasSavedName(true);
    }

    socket.connect();
    loadProfileName().catch(() => {});

    async function tryReconnect() {
      const savedPlayerId = await sessionStore.getItem(STORAGE_PLAYER_ID);
      const savedRoomCode = await sessionStore.getItem(STORAGE_ROOM_CODE);

      if (savedPlayerId && savedRoomCode && socket.connected) {
        setConnectionState("reconnecting");
        socket.emit("recover_session", {
          playerId: savedPlayerId,
          code: savedRoomCode,
          name: nameRef.current,
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
      setConnectionState("reconnecting");
      setPendingAction(null);
      setErrorMessage(null);
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
      setErrorMessage("Opnieuw verbinden lukt niet. Controleer je netwerk.");
    }

    function onConnectError() {
      setConnected(false);
      setConnectionState("reconnecting");
      setErrorMessage(null);
    }

    async function saveSession(data: { code: string; playerId: string }) {
      playerIdRef.current = data.playerId;
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
      setConnectionState("online");
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
      playerIdRef.current = "";
      setPlayerId("");
      setConnectionState(socket.connected ? "online" : "offline");
      setErrorMessage("Tafel niet meer beschikbaar. Maak een nieuwe tafel of doe opnieuw mee.");
    }

    function onRoomClosed(data?: { message?: string }) {
      sessionStore.multiRemove([STORAGE_PLAYER_ID, STORAGE_ROOM_CODE]).catch(
        () => {}
      );
      setPendingAction(null);
      setMatchmakingStatus(null);
      setRoom(null);
      playerIdRef.current = "";
      setPlayerId("");
      setConnectionState(socket.connected ? "online" : "offline");
      setErrorMessage(
        data?.message ?? "Tafel gesloten omdat er niet genoeg spelers over zijn."
      );
    }

    function onRoomUpdated(updatedRoom: PublicRoomState) {
      setPendingAction(null);
      setRoom(updatedRoom);
      sessionStore.setItem(STORAGE_ROOM_CODE, updatedRoom.code).catch(() => {});
    }

    function onPublicRooms(rooms: PublicRoomSummary[]) {
      setPendingAction((currentAction) =>
        currentAction === "listPublic" ? null : currentAction
      );
      setPublicRooms(rooms);
    }

    function onQuickPlayResult(data: { status: "created" | "found" | "recovered" }) {
      setMatchmakingStatus(
        data.status === "created"
          ? "Nieuwe tafel gemaakt"
          : data.status === "found"
          ? "Tafel gevonden"
          : "Opnieuw verbonden"
      );
    }

    function onRedrawSuccess(data: RedrawSuccess) {
      setPendingAction(null);
      setErrorMessage(null);
      setRedrawSuccess(data);
    }

    function onErrorMessage(message: string) {
      setPendingAction(null);
      setMatchmakingStatus(null);
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
    socket.on("room_closed", onRoomClosed);
    socket.on("room_state", onRoomUpdated);
    socket.on("room_updated", onRoomUpdated);
    socket.on("public_rooms", onPublicRooms);
    socket.on("quick_play_result", onQuickPlayResult);
    socket.on("redraw_success", onRedrawSuccess);
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

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          resumeFromBackground();
        }
      }
    );

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_created", onRoomCreated);
      socket.off("room_joined", onRoomJoined);
      socket.off("reconnected", onReconnected);
      socket.off("reconnect_failed", onSessionReconnectFailed);
      socket.off("room_closed", onRoomClosed);
      socket.off("room_state", onRoomUpdated);
      socket.off("room_updated", onRoomUpdated);
      socket.off("public_rooms", onPublicRooms);
      socket.off("quick_play_result", onQuickPlayResult);
      socket.off("redraw_success", onRedrawSuccess);
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
      appStateSubscription.remove();
      socket.disconnect();
    };
  }, [enabled]);

  function createRoom(visibility: "private" | "public" = "private") {
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
      visibility,
      mode: visibility === "public" ? "casual" : "friends",
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
      playerId: playerIdRef.current || undefined,
    });
  }

  function quickPlay() {
    if (!connected) {
      setErrorMessage("Server niet verbonden. Probeer het zo opnieuw.");
      return;
    }

    Keyboard.dismiss();
    setPendingAction("quick");
    setMatchmakingStatus("Online tafel zoeken...");
    setErrorMessage(null);
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    socket.emit("quick_play", {
      name,
      playerId: playerIdRef.current || undefined,
    });
  }

  function listPublicRooms() {
    if (!connected) {
      setErrorMessage("Geen verbinding met de server.");
      return;
    }

    setPendingAction("listPublic");
    setErrorMessage(null);
    socket.emit("list_public_rooms");
  }

  function joinPublicRoom(code: string) {
    if (!connected) {
      setErrorMessage("Geen verbinding met de server.");
      return;
    }

    setPendingAction("joinPublic");
    setErrorMessage(null);
    socket.emit("join_public_room", {
      code,
      name,
      playerId: playerIdRef.current || undefined,
    });
  }

  function addBot() {
    setPendingAction("bot");
    setErrorMessage(null);
    socket.emit("add_bot");
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

  function redrawDrawnCard(payload: RedrawRequestPayload) {
    if (pendingActionRef.current === "redraw") return;

    pendingActionRef.current = "redraw";
    setPendingAction("redraw");
    setErrorMessage(null);
    if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
    socket.emit("redraw_drawn_card", payload);
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

  function clearRedrawSuccess() {
    setRedrawSuccess(null);
  }

  function retryConnection() {
    setConnectionState("connecting");
    setErrorMessage(null);
    socket.connect();
  }

  function setName(value: string) {
    const nextName = value.trim().slice(0, 18) || "Speler";

    nameRef.current = nextName;
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
    publicRooms,
    matchmakingStatus,
    pendingAction,
    errorMessage,
    redrawSuccess,
    clearRedrawSuccess,
    clearError,
    retryConnection,
    createRoom,
    joinRoom,
    quickPlay,
    listPublicRooms,
    joinPublicRoom,
    addBot,
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
