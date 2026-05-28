# CODEX_GOAL.md

Improve the Pesten Online app in phases.

## Phase 1: Audit
Inspect the app structure, screens, components, styles, game logic and server/client communication.
Write down the biggest problems before editing.

## Phase 2: Stability
Fix obvious crashes, TypeScript errors, layout overflow, bad mobile spacing, and broken restart/game-over flows.

## Phase 3: Gameplay rules
Check and improve the Pesten rules:
- Jack chosen suit must be respected.
- 7 same-suit chain must stop correctly.
- Joker and 2 penalty stacking must work correctly.
- King extra-card logic must not allow unlimited wrong chains.
- Turn state must remain correct.

## Phase 4: UI/UX redesign
Improve:
- Home screen
- Waiting room/lobby
- Game table
- Player status
- Card hand
- Buttons
- Empty states
- Error messages
- Mobile responsiveness

## Phase 5: Future online platform preparation
Prepare the app for:
- Search online game
- Public rooms
- Friends
- Profiles
- Invites
- Matchmaking

Do not fully build these systems yet unless easy, but structure the UI and code so it feels ready for them.

## Phase 6: Verification
Run available checks:
- npm install if needed
- npm run lint if available
- npm run typecheck if available
- npm test if available
- npm run build if available

If a command does not exist, explain that and continue.