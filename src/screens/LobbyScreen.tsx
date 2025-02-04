import React, { useState, useEffect } from "react";
import { View, Text, Button, FlatList, StyleSheet, TextInput, ScrollView } from "react-native";
import { collection, addDoc, onSnapshot, updateDoc, doc, getDoc, getDocs, arrayUnion, deleteDoc } from "firebase/firestore";
import { db, auth } from "./firebaseConfig"; // Import Firebase
import GameScreen from "./GameScreen"; // Make sure this path is correct

export default function LobbyScreen({ navigation }: any) {
  const [lobbies, setLobbies] = useState<any[]>([]); // Store lobby list
  const [selectedLobby, setSelectedLobby] = useState<string | null>(null); // Track which lobby the user is in
  const [chatMessage, setChatMessage] = useState(""); // Store the message the user is typing
  const [messages, setMessages] = useState<any[]>([]); // Store chat messages in real-time
  const [lobbyData, setLobbyData] = useState<any>(null); // Store current lobby data

  // Fetch lobbies in real-time from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "lobbies"), (snapshot) => {
      const lobbyData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLobbies(lobbyData);
    });

    return () => unsubscribe(); // Cleanup when screen unmounts
  }, []);

  // Fetch chat messages and lobby data when user selects a lobby
  useEffect(() => {
    if (selectedLobby) {
      const lobbyRef = doc(db, "lobbies", selectedLobby);
      const unsubscribe = onSnapshot(lobbyRef, (docSnap) => {
        if (docSnap.exists()) {
          setMessages(docSnap.data()?.messages || []);
          setLobbyData(docSnap.data());
        }
      });

      return () => unsubscribe(); // Cleanup when leaving the lobby
    }
  }, [selectedLobby]);

  // Create a new lobby
  const createLobby = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        alert("You need to be signed in to create a lobby!");
        return;
      }

      // Get the user's username from Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        alert("User data not found!");
        return;
      }
      const username = userDoc.data()?.username || "Unknown Player";

      // Create a lobby with an empty message list
      const newLobby = await addDoc(collection(db, "lobbies"), {
        host: user.uid,
        players: [{ uid: user.uid, username }],
        inProgress: false,
        createdAt: new Date(),
        messages: [],
        lastActivity: Date.now(), // Track last activity
      });

      alert("Lobby created!");
      setSelectedLobby(newLobby.id); // Auto-select the newly created lobby
    } catch (error) {
      alert("Error creating lobby: " + error);
    }
  };

  // Join a lobby and enable chat
  const joinLobby = async (lobbyId: string) => {
    try {
      const user = auth.currentUser;
      if (!user) return alert("You need to be signed in to join a lobby!");

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) return alert("User data not found!");

      const username = userDoc.data()?.username || "Unknown Player";
      const lobbyRef = doc(db, "lobbies", lobbyId);
      const lobbyDoc = await getDoc(lobbyRef);
      if (!lobbyDoc.exists()) return alert("Lobby not found!");

      const lobbyData = lobbyDoc.data();
      const isAlreadyInLobby = lobbyData.players.some((player: any) => player.uid === user.uid);
      if (isAlreadyInLobby) {
        alert("You are already in this lobby!");
        setSelectedLobby(lobbyId);
        return;
      }

      const updatedPlayers = [...(lobbyData.players || []), { uid: user.uid, username }];
      await updateDoc(lobbyRef, { players: updatedPlayers, lastActivity: Date.now() });

      alert(`Joined Lobby! You're now in: ${lobbyId}`);
      setSelectedLobby(lobbyId);
    } catch (error) {
      alert("Error joining lobby: " + error);
    }
  };

  // Leave the lobby
  const leaveLobby = async () => {
    if (!selectedLobby) return;

    try {
      const user = auth.currentUser;
      if (!user) return alert("You must be signed in to leave a lobby!");

      const lobbyRef = doc(db, "lobbies", selectedLobby);
      const lobbyDoc = await getDoc(lobbyRef);
      if (!lobbyDoc.exists()) return alert("Lobby not found!");

      const lobbyData = lobbyDoc.data();
      const updatedPlayers = lobbyData.players.filter((player: any) => player.uid !== user.uid);

      if (updatedPlayers.length === 0) {
        await deleteDoc(lobbyRef); // Delete lobby if empty
      } else {
        await updateDoc(lobbyRef, { players: updatedPlayers, lastActivity: Date.now() });

        // If the host left, assign a new host
        if (lobbyData.host === user.uid) {
          await updateDoc(lobbyRef, { host: updatedPlayers[0]?.uid || "" });
        }
      }

      setSelectedLobby(null);
    } catch (error) {
      alert("Error leaving lobby: " + error);
    }
  };

  const sendMessage = async () => {
    if (!selectedLobby) return alert("You must be in a lobby to chat!");
  
    try {
      const user = auth.currentUser;
      if (!user) return alert("You must be signed in to chat!");
      if (chatMessage.trim() === "") return;
  
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const username = userDoc.data()?.username || "Unknown";
  
      await updateDoc(doc(db, "lobbies", selectedLobby), {
        messages: arrayUnion({
          sender: username,
          text: chatMessage,
          timestamp: Date.now(),
        }),
        lastActivity: Date.now(),
      });
  
      setChatMessage(""); // Clear input field
    } catch (error) {
      alert("Error sending message: " + error);
    }
  };
  
  const startGame = async () => {
    if (!selectedLobby) return;
  
    try {
      const lobbyRef = doc(db, "lobbies", selectedLobby);
      await updateDoc(lobbyRef, {
        inProgress: true, // Start the game
        round: 1, // Start at round 1
      });
  
      alert("Game Started!");
    } catch (error) {
      alert("Error starting game: " + error);
    }
  };
  
  // Close lobby (Host only)
  const closeLobby = async () => {
    if (!selectedLobby) return;
    await deleteDoc(doc(db, "lobbies", selectedLobby));
    setSelectedLobby(null);
    alert("Lobby closed!");
  };

  // Auto-delete inactive lobbies
  useEffect(() => {
    const interval = setInterval(() => {
      deleteInactiveLobbies();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const deleteInactiveLobbies = async () => {
    const now = Date.now();
    const threshold = 10 * 60 * 1000;
    const snapshot = await getDocs(collection(db, "lobbies"));

    snapshot.forEach(async (docSnap) => {
      const lobbyData = docSnap.data();
      if (lobbyData.lastActivity && now - lobbyData.lastActivity > threshold) {
        await deleteDoc(docSnap.ref);
        console.log(`Deleted inactive lobby: ${docSnap.id}`);
      }
    });
  };

  return (
    <View style={styles.container}>
      {selectedLobby ? (
  lobbyData?.inProgress ? (
    <GameScreen lobbyData={lobbyData} selectedLobby={selectedLobby} />
  ) : (
    <View>
      <Text style={styles.title}>Lobby Chat</Text>
      <ScrollView style={styles.chatBox}>
        {messages.map((msg: any, index: number) => (
          <Text key={index}>
            <Text style={styles.chatSender}>{msg.sender}: </Text>
            {msg.text}
          </Text>
        ))}
      </ScrollView>
      <TextInput
        style={styles.chatInput}
        placeholder="Type a message..."
        value={chatMessage}
        onChangeText={setChatMessage}
        onSubmitEditing={sendMessage}
      />
      <Button title="Send" onPress={sendMessage} />
      <Button title="Leave Lobby" onPress={leaveLobby} />
      {auth.currentUser?.uid === lobbyData?.host && <Button title="Start Game" onPress={startGame} color="green" />}
    </View>
  )
) : (
  <View>
    <Text style={styles.title}>Click War Reverse Lobbies</Text>
    <Button title="Create Lobby" onPress={createLobby} />
    <FlatList
      data={lobbies}
      keyExtractor={(item) => item.id}
      renderItem={({ item }: { item: any }) => (
        <View style={styles.lobbyItem}>
          <Text>Lobby ID: {item.id}</Text>
          {item.players.map((player: any, index: number) => (
            <Text key={index}>• {player.username}</Text>
          ))}
          <Button title="Join Lobby" onPress={() => joinLobby(item.id)} />
        </View>
      )}
    />
  </View>
)}

    </View>
  );

}
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: "#f4f4f4" 
  },
  title: { 
    fontSize: 24, 
    fontWeight: "bold", 
    marginBottom: 20 
  },
  lobbyItem: { 
    padding: 10, 
    backgroundColor: "#ddd", 
    marginVertical: 5, 
    borderRadius: 5 
  },
  chatBox: { 
    maxHeight: 200, 
    padding: 5, 
    backgroundColor: "#fff", 
    borderRadius: 5, 
    marginBottom: 10 
  },
  chatSender: { 
    fontWeight: "bold" 
  },
  chatInput: { 
    borderWidth: 1, 
    borderColor: "#ccc", 
    padding: 10, 
    borderRadius: 5, 
    marginBottom: 10 
  }
});
