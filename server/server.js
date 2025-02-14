const http = require("http");
const WebSocket = require("ws");
const express = require("express");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


// Store game state (lobbies & players)
const lobbies = {};

// Create WebSocket server
const app = express();
const PORT = process.env.PORT || 8080;
const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });

// ✅ Add an HTTP route for Render to detect
app.get("/", (req, res) => {
  res.send("WebSocket server is running!");
});

// Function to broadcast updates to all players in a lobby
const broadcastToLobby = (lobbyId, data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && lobbies[lobbyId]?.players.some(p => p.ws === client)) {
      client.send(JSON.stringify(data));
    }
  });
};

const playGameRound = async (lobbyId) => {
  if (!lobbies[lobbyId]) return;

  try {
    lobbies[lobbyId].round += 1; // ✅ Increase round number

    // ✅ Step 1: Countdown before the round starts
    for (let count = 5; count > 0; count--) {
      broadcastToLobby(lobbyId, { type: "countdown", count });
      await delay(1000);
    }

    // ✅ Step 2: Set up the round
    const numButtons = Math.min(5, 3 + Math.floor(lobbies[lobbyId].round / 2)); // Increase button count each round
    const buttons = Array.from({ length: numButtons }, (_, i) => ["🔵", "🟢", "🔴", "🟡", "🟠"][i]);
    const safeIndex = Math.floor(Math.random() * numButtons);

    lobbies[lobbyId].safeIndex = safeIndex;
    lobbies[lobbyId].buttons = buttons;

    console.log(`🎲 Round ${lobbies[lobbyId].round}: Safe button is ${buttons[safeIndex]}`);

    // ✅ Step 3: Send game choices to players
    broadcastToLobby(lobbyId, {
      type: "chooseButton",
      lobbyId,
      message: {
        sender: "Bot 🤖",
        text: `🎲 **Round ${lobbies[lobbyId].round}** - Pick a button!`,
        buttons,
      },
    });

    // ✅ Step 4: Wait for player choices
    await delay(6000);

    // ✅ Step 5: Reveal results
    const correctButton = buttons[safeIndex];
    broadcastToLobby(lobbyId, {
      type: "gameResult",
      lobbyId,
      message: {
        sender: "Bot 🤖",
        text: `🚨 **Round ${lobbies[lobbyId].round} Over!** The safe button was **${correctButton}**!`,
      },
    });

    // ✅ Step 6: Continue to the next round if there are still players
    setTimeout(() => playGameRound(lobbyId), 3000);

  } catch (error) {
    console.error("❌ Error in game round:", error);
  }
};

// Handle new connections
wss.on("connection", (ws) => {
  console.log("New player connected!");

  // 🔹 Send a ping every 25 seconds to keep the connection alive
  const keepAliveInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 25000);

  ws.on("close", () => {
    clearInterval(keepAliveInterval);
    console.log("Player disconnected.");
  });
  

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case "getLobbies":
  const lobbyList = Object.values(lobbies).map((lobby) => ({
    id: lobby.id,
    host: lobby.host,
    players: lobby.players.map(({ uid, username }) => ({ uid, username })), // Send only relevant player info
    inProgress: lobby.inProgress,
    round: lobby.round,
  }));

  console.log("📢 Sending lobbies:", lobbyList); // ✅ Log clean lobby data
  ws.send(JSON.stringify({ type: "lobbies", lobbies: lobbyList }));
  break;

  case "createLobby":
  console.log("📥 Received createLobby request:", data);

  const lobbyId = Math.random().toString(36).substring(2, 10); // Generate random lobby ID

  const newLobby = {
    id: lobbyId,
    host: data.user.uid,
    players: [{ ...data.user, ws }], // Store player WebSocket reference
    messages: [],
    inProgress: false, 
    round: 0,
  };

  lobbies[lobbyId] = newLobby;
  console.log(`✅ Lobby created:`, newLobby);

  // Send lobby ID back to the creator
  ws.send(
    JSON.stringify({
      type: "lobbyCreated",
      lobbyId: lobbyId,
    })
  );

  // Broadcast updated lobby list to all players
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "updateLobbies", lobbies: Object.values(lobbies) }));
    }
  });
  break; 

    lobbies[lobbyId] = newLobby;
    console.log(`✅ Lobby created:`, newLobby);

    // Send the correct lobby ID back to the client
    ws.send(
      JSON.stringify({
        type: "lobbyCreated",
        lobbyId: lobbyId,
      })
    );

    // ✅ Broadcast updated lobby list to all players
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "updateLobbies", lobbies: Object.values(lobbies) }));
      }
    });
    break;       

          case "reconnect":
  if (!lobbies[data.lobbyId]) {
    ws.send(JSON.stringify({ type: "error", message: "Lobby does not exist" }));
    return;
  }

  if (player) {
    player.ws = ws; // 🔥 Update WebSocket reference for the reconnected player
    console.log(`🔄 Player ${data.userId} successfully reconnected to ${data.lobbyId}`);
  } else {
    console.warn(`⚠️ Player ${data.userId} tried to reconnect, but was not found in ${data.lobbyId}`);
  }

  broadcastToLobby(data.lobbyId, { type: "lobbyUpdate", lobbyId: data.lobbyId, lobby: lobbies[data.lobbyId] });
  break;
          
  case "joinLobby":
  if (!lobbies[data.lobbyId]) {
    ws.send(JSON.stringify({ type: "error", message: "Lobby does not exist" }));
    return;
  }

  // Prevent duplicate players
  const existingPlayer = lobbies[data.lobbyId].players.find(p => p.uid === data.user.uid);
  if (existingPlayer) {
    console.warn(`⚠️ Player ${data.user.username} (UID: ${data.user.uid}) is already in lobby ${data.lobbyId}`);
  } else {
    lobbies[data.lobbyId].players.push({ ...data.user, ws }); // ✅ Add player to the lobby
    console.log(`✅ ${data.user.username} joined lobby ${data.lobbyId}`);
  }

  // ✅ Broadcast updated lobby info to all players
  broadcastToLobby(data.lobbyId, { 
    type: "lobbyUpdate", 
    lobbyId: data.lobbyId, 
    lobby: {
      ...lobbies[data.lobbyId],
      players: lobbies[data.lobbyId].players.map(({ ws, ...player }) => player), // Remove WebSocket reference
    }
  });

  // ✅ Send a system message announcing the new player
  const joinMessage = {
    type: "message",
    lobbyId: data.lobbyId,
    message: {
      sender: "Bot 🤖",
      text: `🎉 ${data.user.username} has joined the game!`,
      timestamp: new Date().toISOString(),
    }
  };

  broadcastToLobby(data.lobbyId, joinMessage); // ✅ Send bot message
  break;

  case "leaveLobby":
    if (!lobbies[data.lobbyId]) return;
  
    const leavingPlayer = lobbies[data.lobbyId].players.find(p => p.uid === data.userId);
    const leavingPlayerName = leavingPlayer ? leavingPlayer.username : "Unknown Player";
  
    lobbies[data.lobbyId].players = lobbies[data.lobbyId].players.filter(p => p.uid !== data.userId);
    console.log(`👋 ${leavingPlayerName} left ${data.lobbyId}`);
  
    // ✅ Send a bot message announcing the player left
    const leaveMessage = {
      type: "message",
      lobbyId: data.lobbyId,
      message: {
        sender: "Bot 🤖",
        text: `👋 ${leavingPlayerName} has left the game.`,
        timestamp: new Date().toISOString(),
      }
    };
  
    broadcastToLobby(data.lobbyId, leaveMessage); // ✅ Send bot message
  
    break;                      

    case "sendMessage":
      console.log("📩 Received message request:", data);  // ✅ Debug message reception
    
      if (!lobbies[data.lobbyId]) {
        console.log(`❌ Lobby ${data.lobbyId} not found.`);
        return;
      }
    
      // 🔍 Find sender's profile pic from lobby players
      const senderProfilePic = lobbies[data.lobbyId]?.players.find(p => p.username === data.message.sender)?.profilePic || "https://via.placeholder.com/40";
    
      // ✅ Attach profile pic if missing
      const messageWithPic = {
        ...data.message,
        profilePic: data.message.profilePic || senderProfilePic, // Ensure it always has a profile pic
      };
    
      // Store the message in the lobby
      lobbies[data.lobbyId].messages.push(messageWithPic);
      console.log(`✅ Message stored in lobby ${data.lobbyId}:`, messageWithPic);  // ✅ Confirm message storage
    
      // ✅ Broadcast message to all players in the lobby
      broadcastToLobby(data.lobbyId, { 
        type: "message",
        lobbyId: data.lobbyId,
        message: messageWithPic 
      });
    
      console.log(`✅ Broadcasted message to lobby ${data.lobbyId}:`, messageWithPic); // ✅ Confirm broadcast
      break;
              

  case "startGame":
  if (!lobbies[data.lobbyId]) return;

  if (lobbies[data.lobbyId].inProgress) {
    console.warn(`⚠️ Game in ${data.lobbyId} already started.`);
    return;
  }

  lobbies[data.lobbyId].inProgress = true;
  console.log(`🎮 Game started in ${data.lobbyId}`);

  // ✅ Start the game asynchronously
  playGameRound(data.lobbyId);
  break;

  case "playerChoice":
  if (!lobbies[data.lobbyId]) return;

  const { userId, choice } = data;
  const safeIndex = lobbies[data.lobbyId].safeIndex;
  const buttons = lobbies[data.lobbyId].buttons;

  // Check if the player survived
  const survived = choice === safeIndex;
  let remainingLives = lobbies[data.lobbyId].playerLives[userId];

  if (!survived) {
    remainingLives--; // Lose a life if incorrect choice
  }

  // Update player lives
  lobbies[data.lobbyId].playerLives[userId] = remainingLives;

  console.log(`📩 Player ${userId} chose ${buttons[choice]}. Safe button: ${buttons[safeIndex]}`);

  // ✅ Send ephemeral message to the player
  const player = lobbies[data.lobbyId].players.find(p => p.uid === userId);
  if (player) {
    player.ws.send(JSON.stringify({
      type: "ephemeralMessage",
      message: {
        text: survived
          ? `✅ You survived! Remaining lives: ${remainingLives}`
          : `❌ You lost a life! Remaining lives: ${remainingLives}`,
      },
    }));
  }

  // ✅ Reveal all buttons to everyone
  broadcastToLobby(data.lobbyId, {
    type: "revealButtons",
    buttons: buttons.map((btn, i) => ({
      text: btn,
      type: i === safeIndex ? "safe" : "trap",
    })),
  });

  // ✅ Announce eliminated players
  const eliminatedPlayers = lobbies[data.lobbyId].players.filter(player => lobbies[data.lobbyId].playerLives[player.uid] <= 0);
  eliminatedPlayers.forEach(player => {
    broadcastToLobby(data.lobbyId, {
      type: "message",
      lobbyId: data.lobbyId,
      message: {
        sender: "Bot 🤖",
        text: `💀 ${player.username} has been eliminated!`,
      },
    });
  });

  // ✅ Remove eliminated players
  lobbies[data.lobbyId].players = lobbies[data.lobbyId].players.filter(player => lobbies[data.lobbyId].playerLives[player.uid] > 0);

  // ✅ Check if game is over
  if (lobbies[data.lobbyId].players.length === 1) {
    const winner = lobbies[data.lobbyId].players[0];
    broadcastToLobby(data.lobbyId, {
      type: "gameOver",
      winner: winner.username,
    });
    delete lobbies[data.lobbyId]; // Reset lobby
  } else {
    setTimeout(() => playGameRound(data.lobbyId), 3000); // Start new round
  }
  break;

case "nextRound":
  if (!lobbies[data.lobbyId]) return;
  lobbies[data.lobbyId].round += 1;
  console.log(`Round ${lobbies[data.lobbyId].round} started in ${data.lobbyId}`);
  startCountdown(data.lobbyId);
  break;

      case "closeLobby":
        delete lobbies[data.lobbyId];
        console.log(`Lobby ${data.lobbyId} closed`);
        broadcastToLobby(data.lobbyId, { type: "lobbyClosed", lobbyId: data.lobbyId });
        break;
    }
  });

  // Handle player disconnection
  ws.on("close", () => {
    console.log("Player disconnected.");
    Object.keys(lobbies).forEach(lobbyId => {
      lobbies[lobbyId].players = lobbies[lobbyId].players.filter(p => p.ws !== ws);
      if (lobbies[lobbyId].players.length === 0) {
        delete lobbies[lobbyId];
        console.log(`Lobby ${lobbyId} closed due to inactivity`);
      }
    });
  });
});


// ✅ Start the HTTP & WebSocket server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ WebSocket server running on port ${PORT}`);
});