# Pesten Online

Pesten Online is a React Native Expo multiplayer card game with a Node, Express and Socket.IO server. The app is built as a mobile-first online Pesten platform with private rooms, quick play, public rooms, reconnect support, bots for testing, rewards, profile stats, missions and a polished active game table.

## Current Status

- Expo React Native app for web, iOS and Android development.
- Socket.IO server with authoritative Pesten rules.
- Local-first player profile, wallet, settings, cosmetics and recent-player storage.
- Online rooms are in memory on the server. A server restart clears active rooms.
- Matchmaking is functional for public quick-play rooms, but there is no database, account system or real friends backend yet.

## Project Structure

```text
pesten-multiplayer/
  app/                  Expo React Native client
    src/
      components/       Home, lobby, shop, rules, profile, game table UI
      hooks/            App controller, socket hook, economy hook
      styles/           Shared mobile UI styles
      gameRules.ts      Client-side playable-card hints
      economy.ts        Wallet, rewards, missions, season data
      settings.ts       Persistent app settings
      socket.ts         Socket.IO client setup
  server/               Express and Socket.IO game server
    src/
      game.ts           Authoritative game engine and bot logic
      index.ts          Socket events, room lifecycle, matchmaking
      types.ts          Shared server room and player types
      *.test.ts         Rule, reconnect, room lifecycle and flow tests
```

## Main App Features

### Mobile App Shell

- Centered mobile-style app container on desktop web.
- Fixed bottom navigation scoped to the app width.
- Scroll-safe tab layout for Home, Social, Shop, Rules and Profile.
- Tab switching resets scroll to the top.
- Mobile viewport checks have been done for 360px, 390px and 430px widths.

### Home / Speel

- Compact player header with name, level, coins and gems.
- Private friends table creation with an entry cost.
- Quick play card for online search.
- Join by room code.
- Shortcuts to Social, public rooms and profile/friend foundations.
- Daily reward and mission progress preview.

### Lobby / Waiting Room

- Private and public room support.
- Room code display with copy/share actions.
- Up to 4 player slots.
- Host starts when at least 2 participants are present.
- Ready flow is no longer required.
- Non-host players see waiting-for-host messaging.
- Bot join for local testing.
- Connected, disconnected, host and bot player states.
- Leave room support.

### Active Game Table

- Mobile-first table layout with opponent seats, draw pile, discard pile and bottom hand panel.
- Clear turn banner:
  - "Jij bent aan de beurt"
  - "Wachten op [speler]"
  - bot thinking state
- Active player highlight.
- Rule-state banners for:
  - pending 2/Joker draw stack
  - chosen suit after Boer
  - 7-chain / Alles geven
  - Heer extra-card requirement
  - invalid final pest-card warning
  - reconnecting state
- Card hand supports Compact, Normal and Large settings.
- Playable cards are highlighted.
- Invalid cards are dimmed and show a reason when tapped.
- Cards can be selected, then played with the Speel/Kies button.
- Drag-to-play remains available for playable cards.
- Draw, pass, redraw-with-gems and sort-by-suit/value controls.
- Calm animations for hand entry, draw pile pulse, discard update, invalid shake, turn pulse and reward reveal.
- Haptics for select, valid play, invalid play, warning and win/loss reveal when enabled.
- Sound feedback hook exists, but sound assets are not bundled yet.

### Finished Round / End Screen

- Winner detection on legal final card.
- Invalid final pest card does not win.
- Finished state blocks further card plays.
- Winner screen shows:
  - result text
  - winner/ranking
  - coins earned
  - XP earned
  - mission progress text
- Actions:
  - Nog een potje
  - Terug naar lobby
  - Naar home
- Reconnect after a finished game restores the finished screen.
- Rematch returns the room to a clean lobby so the host can start again.

### Social / Online

- Functional quick play / online search.
- Public room list backed by the server.
- Join listed public waiting rooms.
- Refresh public room list.
- Empty state when no public rooms are available.
- Recent players foundation after games.
- Friend and invite UI foundation. These are placeholders until accounts and a database exist.

### Shop / Markt

- Wallet overview for coins and gems.
- Daily gem claim, limited to once per day.
- Product tabs:
  - Munten
  - Backs
  - Tafels
  - Avatars
  - Frames
  - Season
- Local cosmetic buying/selecting for implemented items.
- Card backs, table skins, avatars and avatar frames.
- Premium/season rewards foundation.
- Placeholder purchase flows for real-money store actions. There is no Apple/Google payment integration yet.

### Rules Screen

- Readable grouped Pesten rules page.
- Covers base matching rules, pest cards, stacking, special cards, ending rules and draw/pass flow.

### Profile / Settings

- Persistent player name.
- Persistent haptics toggle.
- Persistent card-size setting:
  - Compact
  - Normaal
  - Groot
- Persistent motion setting:
  - Rustig
  - Normaal
- Language setting is currently normalized to Dutch. English is not implemented yet.
- Profile foundation with:
  - playerId
  - playerName
  - wins
  - losses
  - gamesPlayed
  - favoriteCardback
  - level
  - XP
  - coins
  - gems
  - online status

## Multiplayer And Room Features

### Room Types

- Private friends table:
  - created from Nieuwe tafel
  - has a room code
  - hidden from public room list
- Public table:
  - created by quick play or public create flow
  - listed only while valid and waiting
  - can be joined through Open tafels
- Quick table:
  - quick_play searches for a valid public waiting room
  - if none exists, the server creates a new public quick room

### Matchmaking Rules

Public room listing only returns rooms that are:

- public
- waiting
- not full
- hosted by a connected human
- not bot-only
- not orphaned
- not in-game
- not closing

Quick play skips invalid rooms and never joins a player into a bot-hosted or bot-only room.

### Host And Bot Rules

- Bots are fillers for testing only.
- Bots can never be host.
- Host migration always chooses a connected human when possible.
- If all humans leave, the room is closed after lifecycle cleanup.
- Bot-only rooms are closed and hidden from public listings.
- If an active game becomes unplayable because too few participants remain, it is reset or closed safely.

### Reconnect And Recovery

The client stores session data locally:

- playerId
- playerName
- active room code
- app settings
- wallet/economy data
- recent players

On reconnect or app foreground:

- the client reconnects the socket
- emits recover_session when a saved room exists
- restores lobby, active game or finished game if the server still has the room
- clears stale room data when recovery fails
- keeps profile, settings and wallet data intact

The server keeps disconnected players during a reconnect grace period, preserving:

- room seat
- hand
- ready compatibility flag
- turn ownership
- current game state
- chosen suit
- pending draw
- 7-chain state
- finished/rematch state

## Pesten Rules Implemented

The server in `server/src/game.ts` is authoritative.

### Base Rules

- A card can be played when suit, value or active chosen suit matches.
- Joker can be played as a special card.
- After a Boer, the chosen suit is leading, not the suit printed on the Boer.
- If no valid card is available, the player draws and then follows the current draw/pass flow.

### Pest Cards

Pest cards are:

- Aas / Ace
- 2
- 7
- 8
- Boer / Jack
- Heer / King
- Joker

### 2 And Joker Stacking

- 2 adds 2 to the pending draw stack.
- Joker adds 5 to the pending draw stack.
- 2 and Joker may be stacked on each other.
- Stacking adds to the existing pending draw amount.
- Drawing the penalty clears the stack and then allows follow-up play/pass when applicable.
- Invalid final pest-card punishment does not reset or overwrite the active stack.

### Special Cards

- 7: Alles geven. Continue with cards of the same suit, another valid 7, or a valid closure according to the chain rules.
- 8: skips the next player.
- Boer / Jack: choose a new suit.
- Heer / King: play exactly one extra card. If no extra card is possible, draw 1.
- Aas / Ace: reverses direction with 3 or more active players.
- Aas / Ace in 1v1 acts like a skip, so the player who played it gets the next turn again.

### Ending Rules

- A player wins immediately when they legally play their last non-pest card.
- A player may not finish with a pest card.
- If a player tries to finish with a pest card:
  - they do not win
  - they draw 2 penalty cards
  - the played card still applies its normal effect
  - pending draw, chosen suit, 7-chain and Heer state remain correct

## Economy, Rewards And Progression

### Wallet

The local wallet tracks:

- coins
- gems
- XP
- level
- owned/selected cosmetics
- games played
- wins
- losses
- pest cards played
- streaks
- claimed daily, milestone and season rewards
- rewarded round IDs to avoid duplicate rewards

### Match Rewards

- Participation: +10 coins and +20 XP.
- Winner bonus: +25 coins and +40 XP.
- Total winner reward: +35 coins and +60 XP.
- Rewards are deduped per room and round.

### Missions

Daily missions:

- Speel 1 potje
- Win 1 potje
- Speel 3 pestkaarten

Milestones:

- Eerste tafel
- Eerste winst
- Collector
- Hot streak

Rewards can be claimed once and persist locally.

## Socket.IO Events

### Client To Server

- `create_room`
- `join_room`
- `list_public_rooms`
- `join_public_room`
- `quick_play`
- `add_bot`
- `update_name`
- `recover_session`
- `reconnect_room`
- `toggle_ready` compatibility event, no longer required
- `start_game`
- `play_card`
- `draw_cards`
- `pass_turn`
- `redraw_drawn_card`
- `reorder_hand`
- `sort_hand`
- `play_again_response`
- `leave_room`

### Server To Client

- `room_created`
- `room_joined`
- `reconnected`
- `reconnect_failed`
- `room_state`
- `room_updated`
- `room_closed`
- `public_rooms`
- `quick_play_result`
- `error_message`

## Local Development

Install dependencies in both workspaces:

```bash
cd server
npm install

cd ../app
npm install
```

Start the server:

```bash
cd server
npm run dev
```

Start the app:

```bash
cd app
npm start
```

Run Expo web:

```bash
cd app
npm run web
```

The server defaults to port `3001`. Expo web usually runs on `8081`.

## Server URL Configuration

The app reads `EXPO_PUBLIC_SERVER_URL`.

If the variable is not set, the app infers the server host from the page or Expo Go development URL and uses port `3001`.

Examples:

- Web at `http://localhost:8081` connects to `http://localhost:3001`.
- Web at `http://192.168.1.10:8081` connects to `http://192.168.1.10:3001`.
- Expo Go on a phone uses the same LAN host that served the Expo bundle.

If automatic detection does not match your network, set the server URL manually:

```powershell
$env:EXPO_PUBLIC_SERVER_URL="http://192.168.1.10:3001"
npm start
```

For phone testing, make sure:

- the server is running
- Expo is serving over LAN
- Windows Firewall allows Node.js on port `3001`
- the phone and development machine are on the same network

## Checks

App typecheck:

```bash
cd app
npm run typecheck
```

Server tests:

```bash
cd server
npm test
```

The server test suite covers:

- core Pesten rules
- 2/Joker stacking
- invalid final pest-card penalties
- Ace 1v1 skip behavior
- Boer chosen suit
- 7-chain
- Heer extra-card rules
- bot behavior
- no-ready room start
- quick play
- public rooms
- reconnect recovery
- host migration
- bot-only cleanup
- finished game restore
- rematch reset

## Manual Smoke Tests

Recommended full smoke:

1. Start the server and Expo app.
2. Create a private table.
3. Add a bot.
4. Start without ready.
5. Play a few valid and invalid cards.
6. Trigger 2/Joker pending draw.
7. Trigger Boer chosen suit.
8. Trigger Heer extra card.
9. Trigger 7-chain.
10. Finish a game with a valid non-pest card.
11. Confirm winner screen, rewards, XP and missions.
12. Tap Nog een potje and start again.
13. Reload during an active game and confirm reconnect restores state.
14. Reload after finished state and confirm the winner screen is restored.
15. Try quick play.
16. Check public rooms.
17. Leave a room with only bots and confirm cleanup.

## Known Limitations

- Active rooms are stored in server memory only.
- A server restart clears active rooms and reconnect recovery for those rooms.
- Profile, wallet, settings, cosmetics and recent players are local to the device/browser.
- Friends and invites are UI/foundation only. There is no account-backed friend system yet.
- Real-money payments are not implemented.
- Sound effects are a no-op foundation until audio assets are added.
- English language support is not implemented yet; the app currently stays in Dutch.
- Native iOS/Android release builds are not configured in this README.
