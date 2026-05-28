# AGENTS.md

You are improving a React Native + Expo multiplayer Pesten card game.

## Project goal
Make the app feel like a polished, modern mobile multiplayer card game, not a simple prototype.

## Main priorities
1. Improve the full UI/UX with one consistent premium game style.
2. Make mobile layout stable on small and large screens.
3. Fix card hand layout so cards never go outside the screen and do not feel dizzy.
4. Improve lobby/waiting room so it has less clutter and clearer actions.
5. Improve home screen so it feels like an online game platform, not only a private room creator.
6. Prepare the app structure for future online matchmaking, public game search, friends, profiles and invites.
7. Keep existing Pesten rules working.
8. Improve code structure, naming, reusable components and styles.
9. Do not remove working functionality unless replacing it with a better version.
10. After every major change, run TypeScript/lint/build checks when available.

## Pesten rules
- 2: next player draws 2, can be stacked with 2 or Joker.
- Joker: next player draws 5, can stack with 2/Joker.
- After draw penalty is resolved, the next player may continue according to the active suit/rank rules.
- 7: player may give all cards of the same suit only. It must stop when a non-matching card is attempted.
- 8: skip next player.
- Jack/Boer: choose suit. The chosen suit must become active, not the suit printed on the Jack.
- King/Heer: player must play exactly one extra card.
- Ace/Aas: reverse direction.
- Respect chosen suit after Jack.
- Do not allow invalid plays.

## Style direction
- Modern playful card game style.
- Premium, colorful, clean and mobile-first.
- Big clear buttons.
- Smooth animations, but not too much movement.
- Avoid visual clutter.
- Make everything easy to understand for new players.

## Done means
- App still starts.
- No obvious TypeScript errors.
- Main screens look consistent.
- Gameplay is not broken.
- Mobile layout works better.
- Explain changed files at the end.