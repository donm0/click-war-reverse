import React, { useState, useEffect } from "react";
import { View, Text, Button, FlatList, StyleSheet, TextInput, Image } from "react-native";
import { auth } from "./firebaseConfig";
import { useWebSocket } from "../context/WebSocketProvider";
import { useRef, useCallback } from "react"; // ✅ Correct import
import moment from "moment";
import { KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from "react-native";


export default function LobbyScreen({ navigation }: any) {
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [selectedLobby, setSelectedLobby] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lobbyData, setLobbyData] = useState<any>(null);
  const selectedLobbyRef = useRef<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  type ChatMessage = {
    sender: string;
    text: string;
    timestamp?: string;
    profilePic?: string; // ✅ Profile picture URL
    senderColor?: string; // ✅ Unique username colors
    isCurrentUser?: boolean; // ✅ Identify current user
  };  
  
  console.log("🔍 Rendering LobbyScreen");

  useEffect(() => {
    selectedLobbyRef.current = selectedLobby; // ✅ Keep track of selected lobby safely
  }, [selectedLobby]);

  const ws = useWebSocket();

  // ✅ Handle incoming WebSocket messages
  useEffect(() => {
    if (!ws) return;
  
    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      console.log("📩 Received WebSocket Message:", JSON.stringify(data, null, 2)); // ✅ Log everything
    }
  },
)
  
  // Auto fetch lobbies
  // ✅ Correct useEffect for auto-fetching lobbies (without logging messages)
useEffect(() => {
  if (!ws) return;
  ws.send(JSON.stringify({ type: "getLobbies" }));
}, []); // 🔥 Runs only once  

// ✅ NEW: Separate useEffect to track messages state changes
useEffect(() => {
  console.log("📜 Messages state updated:", messages);
}, [messages]); 

//Handle Messages
useEffect(() => {
  if (!ws) return;

  const handleMessage = (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    console.log("📩 Received WebSocket Message:", data);

    if (data.type === "lobbyCreated") {
      console.log("✅ Setting Selected Lobby:", data.lobbyId);
      setSelectedLobby(data.lobbyId);
    }

    if (data.type === "message" && data.lobbyId === selectedLobbyRef.current) {
      console.log("📨 New Chat Message:", data.message);
    
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          sender: data.message.sender,
          text: data.message.text,
          timestamp: data.message.timestamp || new Date().toISOString(),
          profilePic: data.message.profilePic || "https://via.placeholder.com/40", // Default profile picture
          senderColor: getUsernameColor(data.message.sender),
          isCurrentUser: data.message.sender === auth.currentUser?.displayName, // Check if it's the current user
        },
      ]);     

      // ✅ Auto-scroll to the latest message
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }    
  };

  ws.addEventListener("message", handleMessage);
  return () => {
    ws.removeEventListener("message", handleMessage);
  };
}, [ws]); // ✅ Removed `selectedLobby` dependency

  // ✅ Create a new lobby
  const createLobby = () => {
    const user = auth.currentUser;
    if (!user) return alert("You need to be signed in!");
  
    console.log("🛠 Requesting lobby creation...");
  
    ws?.send(
      JSON.stringify({
        type: "createLobby",
        user: {
          uid: user.uid,
          username: user.displayName || "Player",
        },
      })
    );
  };   

  // ✅ Join a lobby
  const joinLobby = (lobbyId: string) => {
    const user = auth.currentUser;
    if (!user) return alert("You need to be signed in!");
  
    console.log("👤 Joining lobby as:", user.displayName || "Unknown");
  
    ws?.send(
      JSON.stringify({
        type: "joinLobby",
        lobbyId,
        user: { uid: user.uid, username: user.displayName || "Player" },
      })
    );
  
    setSelectedLobby(lobbyId);
  };  

  // ✅ Leave the lobby
  const leaveLobby = () => {
    if (!selectedLobby) return;

    ws?.send(
      JSON.stringify({
        type: "leaveLobby",
        lobbyId: selectedLobby,
        userId: auth.currentUser?.uid,
      })
    );

    setSelectedLobby(null);
  };

  // ✅ Send a message to chat
  const sendMessage = () => {
    if (!selectedLobby || chatMessage.trim() === "") return;

    console.log("🔥 Firebase User:", auth.currentUser);

    const messageData = {
  type: "sendMessage",
  lobbyId: selectedLobby,
  message: {
    sender: auth.currentUser?.displayName || "Player",
    text: chatMessage,
    timestamp: new Date().toISOString(), // ✅ Add timestamp
  },
};
  
    console.log("📤 Sending Message to WebSocket:", messageData); // ✅ Debug outgoing message
  
    ws?.send(JSON.stringify(messageData));
  
    setChatMessage(""); // ✅ Clear input after sending
  };  

  const getUsernameColor = (username: string) => {
    const colors = ["#E57373", "#81C784", "#64B5F6", "#FFD54F", "#BA68C8"];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash % colors.length)];
  };
  

  // ✅ Start a game round (Bot posts buttons in chat)
  const startGameRound = () => {
    if (!selectedLobby) return;
  
    const buttons = ["🔵", "🟢", "🔴"];
    const safeIndex = Math.floor(Math.random() * buttons.length);
  
    const botMessage = {
      type: "sendMessage",
      lobbyId: selectedLobby,
      message: {
        sender: "Bot 🤖",
        text: "🎲 Pick a button! Tap below:",
        buttons, // ✅ These buttons will appear in the chatbox
        safeIndex, // ✅ Used for game logic
      },
    };
  
    ws?.send(JSON.stringify(botMessage));
  
    // Reveal results after 6 seconds
    setTimeout(() => revealResults(safeIndex), 6000);
  };
  

  // ✅ Reveal results after 6 seconds
  const revealResults = (safeIndex: number) => {
    const resultMessage = {
      type: "sendMessage",
      lobbyId: selectedLobby,
      message: {
        sender: "Bot 🤖",
        text: `🚨 Round over! The safe button was ${safeIndex === 0 ? "🔵" : safeIndex === 1 ? "🟢" : "🔴"}!`,
      },
    };
  
    ws?.send(JSON.stringify(resultMessage));
  };  

  const chooseButton = (buttonIndex: number) => {
    if (!selectedLobby) return;
  
    const choiceMessage = {
      type: "playerChoice",
      lobbyId: selectedLobby,
      userId: auth.currentUser?.uid,
      choice: buttonIndex,
    };
  
    ws?.send(JSON.stringify(choiceMessage));
  };  

  console.log("📝 Rendering with messages:", messages);

  // ✅ Place this function before the return statement
  const renderChatMessage = useCallback(({ item }: { item: ChatMessage }) => {
    return (
      <View style={[styles.messageContainer, item.isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage]}>
        <Image source={{ uri: item.profilePic }} style={[styles.profilePic, item.isCurrentUser ? styles.currentUserPic : null]} />
        <View style={[styles.messageBubble, item.isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble]}>
          <View style={styles.messageHeader}>
            <Text style={[styles.chatSender, { color: item.senderColor }]}>{item.sender}</Text>
            <Text style={[
  styles.chatTimestamp, 
  { color: item.isCurrentUser ? "#FFF" : "#000" } // ✅ White for blue, Black for grey
]}>
  {moment(item.timestamp).format("h:mm A")}
</Text>
          </View>
          <Text style={styles.chatText}>{item.text}</Text>
        </View>
      </View>
    );
  }, []);  

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          {selectedLobby ? (
            <View style={{ flex: 1, justifyContent: "space-between" }}>
              <Text style={styles.title}>Lobby Chat</Text>
  
              <View style={[styles.chatContainer, { flex: 1 }]}>
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  keyExtractor={(item, index) => `${index}-${item.sender}-${item.text}`}
                  renderItem={renderChatMessage}
                  onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                  onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />
              </View>
  
              {/* ✅ Input & Buttons Stay at Bottom */}
              <View style={{ paddingBottom: 10 }}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Type a message..."
                  value={chatMessage}
                  onChangeText={setChatMessage}
                  onSubmitEditing={sendMessage}
                />
                <Button title="Send" onPress={sendMessage} />
                <Button title="Start Game Round" onPress={startGameRound} color="green" />
                <Button title="Leave Lobby" onPress={leaveLobby} />
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={styles.title}>Click War Reverse Lobbies</Text>
              <Button title="Create Lobby" onPress={createLobby} />
              <FlatList
                data={lobbies}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View style={styles.lobbyItem}>
                    <Text>Lobby ID: {item.id}</Text>
                    {item.players?.map((player: any) => (
                      <Text key={`${item.id}-player-${player.uid}`}>• {player.username || "Unknown Player"}</Text>
                    ))}
                    <Button title="Join Lobby" onPress={() => joinLobby(item.id)} />
                  </View>
                )}
              />
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );  
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f4f4f4" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  lobbyItem: { padding: 10, backgroundColor: "#ddd", marginVertical: 5, borderRadius: 5 },

  // ✅ Fix: Chatbox styles
  emptyChatText: { textAlign: "center", color: "#999", marginTop: 10 },
  chatContainer: { flex: 1, backgroundColor: "#fff", borderRadius: 5, padding: 10, marginBottom: 10,  minHeight: 400, maxHeight: "75%" },
  messageContainer: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  currentUserMessage: { flexDirection: "row-reverse", alignSelf: "flex-end" },
  otherUserMessage: { flexDirection: "row", alignSelf: "flex-start" },  
  profilePic: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  messageBubble: { maxWidth: "75%", padding: 10, borderRadius: 10 },
  currentUserBubble: { backgroundColor: "#007AFF", alignSelf: "flex-end" },
  otherUserBubble: { backgroundColor: "#E5E5EA", alignSelf: "flex-start" },
  chatSender: { fontWeight: "bold" },
  chatText: { color: "#333" },
  chatInput: { borderWidth: 1, borderColor: "#ccc", padding: 15, borderRadius: 10, marginBottom: 10 },
  currentUserPic: { marginLeft: 10, marginRight: 0 },
  

  // ✅ Fix: Button container inside chat
  buttonContainer: { flexDirection: "row", marginTop: 5, gap: 5 },

  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatTimestamp: {
    fontSize: 12,
    color: "#FFF",
    opacity: 0.7
  },  
});
