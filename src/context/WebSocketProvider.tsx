import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";

// Create a WebSocket context
const WebSocketContext = createContext<WebSocket | null>(null);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const wsRef = useRef<WebSocket | null>(null); // ✅ Use useRef to prevent unnecessary re-renders
  const reconnectInterval = useRef<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);

  // Function to connect WebSocket
  const connectWebSocket = () => {
    console.log("🛠 Attempting WebSocket connection...");

    // ✅ Close any existing WebSocket before reconnecting
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      console.log("📴 Closing existing WebSocket before reconnecting...");
      wsRef.current.close();
    }

    // Create a new WebSocket connection
    wsRef.current = new WebSocket("ws://192.168.1.40:8080");

    wsRef.current.onopen = () => {
      console.log("✅ Connected to WebSocket");
      setConnecting(false);
      setError(null);

      // ✅ Stop reconnect attempts since we're connected
      if (reconnectInterval.current) {
        console.log("🛑 Clearing reconnect interval since we are connected.");
        clearInterval(reconnectInterval.current);
        reconnectInterval.current = null;
      }
    };

    wsRef.current.onclose = () => {
      console.log("❌ Disconnected from WebSocket");
      setConnecting(true);

      // ✅ Auto-reconnect after 5 seconds if not already attempting
      if (!reconnectInterval.current) {
        reconnectInterval.current = setInterval(() => {
          console.log("♻️ Attempting WebSocket reconnect...");
          connectWebSocket();
        }, 5000);
      }
    };

    wsRef.current.onerror = (event) => {
      console.error("❌ WebSocket Error:", event);
      setError("WebSocket connection error");
      setConnecting(false);
    };
  };

  // Effect to start WebSocket connection on mount
  useEffect(() => {
    connectWebSocket();

    return () => {
      console.log("📴 WebSocketProvider unmounted, closing socket.");
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
      }
      if (reconnectInterval.current) {
        clearInterval(reconnectInterval.current);
      }
    };
  }, []);

  console.log("📌 Render WebSocketProvider:", { ws: wsRef.current, error, connecting });

  // ✅ Display Connection Errors
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "red", fontWeight: "bold" }}>⚠️ {error}</Text>
      </View>
    );
  }

  // ✅ Show Loading Until Connected
  if (connecting) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>🔄 Connecting to WebSocket...</Text>
      </View>
    );
  }

  console.log("🎯 Rendering children inside WebSocketProvider");

  return (
    <WebSocketContext.Provider value={wsRef.current}>
      <View style={{ flex: 1 }}>
        <Text>✅ WebSocket is {wsRef.current ? "connected" : "not connected"}</Text>
        {wsRef.current?.url && <Text>🔗 Connected to: {wsRef.current.url}</Text>}
        {children}
      </View>
    </WebSocketContext.Provider>
  );
};

// Custom hook for WebSocket usage
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    console.warn("⚠️ useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};
