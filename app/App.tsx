import { LinearGradient } from "expo-linear-gradient";
import { Animated, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { GameTable } from "./src/components/GameTable";
import { LobbyScreen } from "./src/components/LobbyScreen";
import { WaitingRoom } from "./src/components/WaitingRoom";
import { useAppController } from "./src/hooks/useAppController";
import { styles } from "./src/styles";

export default function App() {
  const {
    screenAnim,
    screenKey,
    room,
    lobbyProps,
    gameProps,
    waitingRoomProps,
  } = useAppController();

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <LinearGradient
          colors={["#020806", "#0a2a1d", "#503719", "#06140f"]}
          locations={[0, 0.38, 0.72, 1]}
          style={styles.background}
        >
          <View pointerEvents="none" style={styles.backgroundGlowTop} />
          <View pointerEvents="none" style={styles.backgroundGlowBottom} />
          <View pointerEvents="none" style={styles.backgroundCoin} />
          <View pointerEvents="none" style={styles.backgroundCoinSmall} />

          <Animated.View
            key={screenKey}
            style={[
              styles.screenTransition,
              {
                opacity: screenAnim,
                transform: [
                  {
                    translateY: screenAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                  {
                    scale: screenAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.985, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {!room ? (
              <LobbyScreen {...lobbyProps} />
            ) : room.started && gameProps ? (
              <GameTable {...gameProps} />
            ) : waitingRoomProps ? (
              <WaitingRoom {...waitingRoomProps} />
            ) : null}
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
