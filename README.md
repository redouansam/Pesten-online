# Pesten Online

Realtime multiplayer Pesten with an Expo app and a Socket.IO game server.

## Project Structure

- `app/` - Expo React Native client.
- `server/` - TypeScript Express and Socket.IO server.

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

The app reads `EXPO_PUBLIC_SERVER_URL`.

If the variable is not set, the app now infers the server host from the page or Expo Go development URL and uses port `3001`. This means:

- Web opened at `http://localhost:8081` connects to `http://localhost:3001`.
- Web opened at `http://192.168.1.10:8081` connects to `http://192.168.1.10:3001`.
- Expo Go on a phone uses the same LAN host that served the Expo bundle.

If automatic detection does not match your network, set the server URL manually:

```powershell
$env:EXPO_PUBLIC_SERVER_URL="http://192.168.1.10:3001"
npm start
```

For phone testing, make sure the server is running, Expo is serving over LAN, and Windows Firewall allows Node.js on port `3001`.

## Checks

```bash
cd server
npm test

cd ../app
npx tsc --noEmit
```
