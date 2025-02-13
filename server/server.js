const http = require("http");
const WebSocket = require("ws");
const express = require("express");

// Store game state (lobbies & players)
const lobbies = {};

// Create WebSocket server
const app = express();
const PORT = process.env.PORT || 8080;
const server = require("http").createServer();
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
  
// ✅ Start the HTTP & WebSocket server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ WebSocket server running on port ${PORT}`);
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


  const newLobby = {
    id: lobbyId,
    host: data.user.uid,
    players: [{ ...data.user, ws }], // Store player WebSocket reference
    messages: [],
    inProgress: false, // ✅ Track if game is running
    round: 0,
  };  

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

  const player = lobbies[data.lobbyId].players.find(p => p.uid === data.userId);
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

  // Store the message in the lobby
  lobbies[data.lobbyId].messages.push(data.message);
  console.log(`✅ Message stored in lobby ${data.lobbyId}:`, data.message);  // ✅ Confirm message storage

  // ✅ Broadcast message to all players in the lobby
  broadcastToLobby(data.lobbyId, { 
    type: "message",
    lobbyId: data.lobbyId,
    message: data.message 
  });

  console.log(`✅ Broadcasted message to lobby ${data.lobbyId}:`, data.message); // ✅ Confirm broadcast
  break;            

  case "startGame":
  if (!lobbies[data.lobbyId]) return;

  // ✅ Prevent game from starting if it's already in progress
  if (lobbies[data.lobbyId].inProgress) {
    console.warn(`⚠️ Game in ${data.lobbyId} already started, ignoring request.`);
    return;
  }

  lobbies[data.lobbyId].inProgress = true;
  console.log(`🎮 Game started in ${data.lobbyId}`);

  broadcastToLobby(data.lobbyId, { type: "gameStarted", lobbyId: data.lobbyId });

  // Start countdown before round 1
  startCountdown(data.lobbyId);
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

// Start countdown before each round
const startCountdown = (lobbyId) => {
  let count = 5;

  const interval = setInterval(() => {
    if (!lobbies[lobbyId]) {
      clearInterval(interval);
      return;
    }

    broadcastToLobby(lobbyId, { type: "countdown", count });

    if (count === 0) {
      clearInterval(interval);
      broadcastToLobby(lobbyId, { type: "roundStart", lobbyId });
    }

    count--;
  }, 1000);
};
