import { io } from "socket.io-client";
import { SERVER_URL } from "./config";

export const socket = io(SERVER_URL, {
  transports: ["websocket"],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  timeout: 10000,
});