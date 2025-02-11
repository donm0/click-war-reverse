import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import AuthScreen from "./src/screens/AuthScreen"; 
import LobbyScreen from "./src/screens/LobbyScreen";
import ProfileScreen from "./src/screens/ProfileScreen"; // ✅ Import Profile Screen
import { WebSocketProvider } from "./src/context/WebSocketProvider";

const Stack = createStackNavigator();

console.log("🛠 Debugging: Rendering App.tsx");

export default function App() {
  return (
    <WebSocketProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Auth" component={AuthScreen} options={{ title: "Login" }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile Setup" }} /> 
          <Stack.Screen name="Lobby" component={LobbyScreen} options={{ title: "Lobbies" }} />
        </Stack.Navigator>
      </NavigationContainer>
    </WebSocketProvider>
  );
}
