# Reconnect smoke test

Use this checklist after starting the local server and Expo app.

1. Open the app in two separate browser tabs or devices.
2. Client A creates a room.
3. Client B joins with the room code.
4. Client B toggles ready and Client A starts the game.
5. Note Client A's hand size, current turn, top card and any active rule state.
6. Disconnect one client by closing the tab, disabling network, or backgrounding the app.
7. Reopen or foreground the same client within the reconnect grace period.
8. Confirm the same player returns to the same room without a duplicate entry.
9. Confirm the player hand, turn owner, chosen suit, pending draw or 7-chain state is unchanged.
10. Continue playing a valid card or drawing/passing according to the active rule.
11. Repeat once from the waiting room before the game starts.
12. Repeat once after the grace period expires and confirm the room stays stable.

Expected status text during recovery is calm: "Opnieuw verbinden" or "Verbinding herstellen...".
Only show "Kamer niet meer beschikbaar" when the server rejects recovery.
