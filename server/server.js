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
    lobbies[lobbyId].round += 1;
    console.log(`🔄 Starting Round ${lobbies[lobbyId].round} in ${lobbyId}`);

    // Step 1: Countdown before the round starts
    for (let count = 5; count > 0; count--) {
      broadcastToLobby(lobbyId, { type: "countdown", count });
      await delay(1000);
    }

    // Step 2: Generate buttons & safe index
    const numButtons = Math.min(5, 3 + Math.floor(lobbies[lobbyId].round / 2));
    const buttons = ["🔵", "🟢", "🔴", "🟡", "🟠"].slice(0, numButtons);
    const safeIndex = Math.floor(Math.random() * numButtons);

    lobbies[lobbyId].safeIndex = safeIndex;
    lobbies[lobbyId].buttons = buttons;
    console.log(`🎲 Round ${lobbies[lobbyId].round}: Safe button is ${buttons[safeIndex]}`);

    // Step 3: Send game choices to players
    broadcastToLobby(lobbyId, {
      type: "chooseButton",
      lobbyId,
      message: {
        sender: "Bot 🤖",
        profilePic: "https://i.imgur.com/RIEHDLC.jpeg",
        text: `🎲 **Round ${lobbies[lobbyId].round}** - Pick a button!`,
        buttons,
      },
    });

    // Step 4: Wait for player choices
    await delay(6000);

    // Step 5: Reveal results
    const correctButton = buttons[safeIndex];
    broadcastToLobby(lobbyId, {
      type: "gameResult",
      lobbyId,
      message: {
        sender: "Bot 🤖",
        profilePic: "https://i.imgur.com/RIEHDLC.jpeg",
        text: `🚨 **Round ${lobbies[lobbyId].round} Over!** The safe button was **${correctButton}**!`,
      },
    });

    // Step 6: Continue to the next round if there are still players
    setTimeout(() => playGameRound(lobbyId), 3000);
  } catch (error) {
    console.error("❌ Error in game round:", error);
  }
};

// Handle new connections
wss.on("connection", (ws) => {

  // 🔹 Send a ping every 25 seconds to keep the connection alive
  const keepAliveInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 25000);

  ws.on("close", () => {
    clearInterval(keepAliveInterval);
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

  ws.send(JSON.stringify({ type: "lobbies", lobbies: lobbyList }));
  break;

  case "createLobby":

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
    
      if (!lobbies[data.lobbyId]) {
        console.log(`❌ Lobby ${data.lobbyId} not found.`);
        return;
      }
    
      // 🔍 Find sender's profile pic from lobby players
      const senderProfilePic = lobbies[data.lobbyId]?.players.find(p => p.username === data.message.sender)?.profilePic || "https://via.placeholder.com/40";
    
 // ✅ If sender is the bot, set the bot's profile picture
 if (data.message.sender === "Bot 🤖") {
  let senderProfilePic = lobbies[data.lobbyId]?.players.find(p => p.username === data.message.sender)?.profilePic || "https://via.placeholder.com/40";

// If the sender is the bot, use the bot's profile picture
if (data.message.sender === "Bot 🤖") {
  senderProfilePic = "https://i.imgur.com/RIEHDLC.jpeg";
}
}


      // ✅ Attach profile pic if missing
      const messageWithPic = {
        ...data.message,
        profilePic: data.message.profilePic || senderProfilePic, // Ensure it always has a profile pic
      };
    
      // Store the message in the lobby
      lobbies[data.lobbyId].messages.push(messageWithPic);
    
      // ✅ Broadcast message to all players in the lobby
      broadcastToLobby(data.lobbyId, { 
        type: "message",
        lobbyId: data.lobbyId,
        message: messageWithPic 
      });
      break;
              

      case "startGame":
        if (!lobbies[data.lobbyId]) {
          console.warn(`⚠️ Attempted to start a game in non-existent lobby: ${data.lobbyId}`);
          return;
        }
      
        if (lobbies[data.lobbyId].inProgress) {
          console.warn(`⚠️ Game in ${data.lobbyId} already started.`);
          return;
        }
      
        console.log(`🎮 Game started in ${data.lobbyId}`);
      
        // ✅ Initialize lives if not already set
        if (!lobbies[data.lobbyId].playerLives) {
          lobbies[data.lobbyId].playerLives = {};
          for (const player of lobbies[data.lobbyId].players) {
            lobbies[data.lobbyId].playerLives[player.uid] = 3; // Set initial lives
          }
          console.log(`❤️ Initialized player lives:`, lobbies[data.lobbyId].playerLives);
        }
      
        // ✅ Start the game asynchronously
        playGameRound(data.lobbyId);
        break;      

  case "playerChoice":
    console.log("📩 Received playerChoice event:", data);
  if (!lobbies[data.lobbyId]) return;

  const userId = data.userId; // Ensure this is defined
  const choice = data.choice;
  const safeIndex = lobbies[data.lobbyId].safeIndex;
  const buttons = lobbies[data.lobbyId].buttons;

  console.log(`📩 Player ${userId} chose ${buttons[choice]}. Safe button: ${buttons[safeIndex]}`);

  // Ensure playerLives is initialized
  if (!lobbies[data.lobbyId].playerLives) {
    lobbies[data.lobbyId].playerLives = {};
  }

  if (!lobbies[data.lobbyId].playerLives[userId]) {
    lobbies[data.lobbyId].playerLives[userId] = 3; // Default 3 lives
  }

  let remainingLives = lobbies[data.lobbyId].playerLives[userId];

  // Check if the player survived
  const survived = choice === safeIndex;

  if (!survived) {
    remainingLives--; // Lose a life if incorrect choice
    lobbies[data.lobbyId].playerLives[userId] = remainingLives;
  }

  console.log(`🔥 ${userId} Lives Remaining: ${remainingLives}`);

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

    console.log(`💀 Eliminated: ${eliminatedPlayers.map(p => p.username).join(", ")}`);

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

    console.log(`🏆 Game Over - Winner: ${winner.username}`);

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