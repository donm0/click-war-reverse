import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "./firebaseConfig"; // Adjust path if needed

export default function GameScreen({ lobbyData, selectedLobby }: any) {
  const [playerLives, setPlayerLives] = useState<any>(lobbyData.playersLives || {});
  const [round, setRound] = useState(lobbyData.round || 1);
  const [numButtons, setNumButtons] = useState(3); // Start with 3 buttons
  const [safeButtonIndex, setSafeButtonIndex] = useState(0);
  const [extraLifeButtonIndex, setExtraLifeButtonIndex] = useState(-1);

  useEffect(() => {
    startNewRound();
  }, []);

  const startNewRound = async () => {
    if (!selectedLobby) return;

    try {
      const lobbyRef = doc(db, "lobbies", selectedLobby);
      const lobbyDoc = await getDoc(lobbyRef);
      if (!lobbyDoc.exists()) return;

      // Increase buttons over time (max 5)
      const newNumButtons = Math.min(5, 3 + Math.floor(round / 2));
      setNumButtons(newNumButtons);

      // Randomly select the safe button and extra life button
      const newSafeButton = Math.floor(Math.random() * newNumButtons);
      let newExtraLifeButton = Math.floor(Math.random() * newNumButtons);
      while (newExtraLifeButton === newSafeButton) {
        newExtraLifeButton = Math.floor(Math.random() * newNumButtons);
      }

      setSafeButtonIndex(newSafeButton);
      setExtraLifeButtonIndex(newExtraLifeButton);

      // Update Firestore
      await updateDoc(lobbyRef, {
        numButtons: newNumButtons,
        safeButtonIndex: newSafeButton,
        extraLifeButtonIndex: newExtraLifeButton,
        round: round + 1,
      });

      setRound(round + 1);
    } catch (error) {
      Alert.alert("Error", "Failed to start a new round.");
    }
  };

  const handleButtonClick = async (buttonIndex: number) => {
    const user = auth.currentUser;
    if (!user || !selectedLobby) return;

    const newLives = { ...playerLives };

    if (buttonIndex === safeButtonIndex) {
      Alert.alert("You survived this round!");
    } else if (buttonIndex === extraLifeButtonIndex) {
      newLives[user.uid] = (newLives[user.uid] || 1) + 1;
      Alert.alert("You gained an extra life!");
    } else {
      newLives[user.uid] = Math.max(0, (newLives[user.uid] || 1) - 1);
      Alert.alert("You clicked a trap and lost a life!");
    }

    const lobbyRef = doc(db, "lobbies", selectedLobby);
    await updateDoc(lobbyRef, { playersLives: newLives });

    setPlayerLives(newLives);

    if (Object.values(newLives).every((lives) => lives === 0)) {
      Alert.alert("Game Over!", "All players have been eliminated.");
    } else {
      startNewRound();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Round {round}</Text>
      <Text style={styles.subtitle}>Choose a button wisely!</Text>

      {Object.entries(playerLives).map(([uid, lives]: any) => (
        <Text key={uid} style={styles.player}>
          {uid === auth.currentUser?.uid ? "You" : uid}: {lives} lives
        </Text>
      ))}

      <View style={styles.buttonContainer}>
        {[...Array(numButtons)].map((_, i) => (
          <Button
            key={i}
            title={`Button ${i + 1}`}
            onPress={() => handleButtonClick(i)}
            color={i === safeButtonIndex ? "green" : i === extraLifeButtonIndex ? "blue" : "red"}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f4f4f4" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  subtitle: { fontSize: 18, marginBottom: 20 },
  player: { fontSize: 16, marginBottom: 5 },
  buttonContainer: { flexDirection: "row", gap: 10, marginTop: 20 },
});
