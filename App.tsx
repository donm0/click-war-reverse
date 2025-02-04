import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import AuthScreen from "./src/screens/AuthScreen";  // Make sure "src" is lowercase
import LobbyScreen from "./src/screens/LobbyScreen"; // Make sure "src" is lowercase

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Auth" component={AuthScreen} options={{ title: "Login" }} />
        <Stack.Screen name="Lobby" component={LobbyScreen} options={{ title: "Lobbies" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
