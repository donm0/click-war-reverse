import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import AuthScreen from "./src/screens/AuthScreen"; 
import LobbyScreen from "./src/screens/LobbyScreen";
import ProfileScreen from "./src/screens/ProfileScreen"; 
import { WebSocketProvider } from "./src/context/WebSocketProvider";

const Stack = createStackNavigator();

console.log("🛠 Debugging: Rendering App.tsx");

export default function App() {
  return (
    <WebSocketProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Auth" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthScreen} />
          <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
          <Stack.Screen name="Lobby" component={LobbyScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </WebSocketProvider>
  );
}
