import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, Image } from "react-native"; // ✅ Import Image
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "./firebaseConfig";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, reload } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore"; // ✅ Import getDoc

export default function AuthScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [profilePic, setProfilePic] = useState<string | null>(null); // ✅ Store profile picture locally

  useEffect(() => {
    checkBiometricLogin();
  }, []);

  // 🔹 Try biometric login first
  const checkBiometricLogin = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem("email");
      const savedPassword = await AsyncStorage.getItem("password");

      if (savedEmail && savedPassword) {
        const biometricAuth = await LocalAuthentication.authenticateAsync({
          promptMessage: "Log in with Biometrics",
          fallbackLabel: "Use password",
        });

        if (biometricAuth.success) {
          handleSignIn(savedEmail, savedPassword);
        }
      }
    } catch (error) {
      console.log("Biometric login failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Save credentials after successful login
  const saveCredentials = async (email: string, password: string) => {
    await AsyncStorage.setItem("email", email);
    await AsyncStorage.setItem("password", password);
  };

  // 🔹 Sign Up Function
  const handleSignUp = async () => {
    try {
      if (!username.trim()) {
        Alert.alert("Error", "Please enter a username.");
        return;
      }
  
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
  
      // ✅ Generate a default profile picture (RoboHash Cat Avatars)
      const profilePicUrl = `https://robohash.org/${newUser.uid}.png?set=set4`;
  
      // ✅ Update Firebase Auth profile
      await updateProfile(newUser, { displayName: username, photoURL: profilePicUrl });
  
      // ✅ Save user info to Firestore
      await setDoc(doc(db, "users", newUser.uid), {
        uid: newUser.uid,
        email: newUser.email,
        username: username,
        profilePic: profilePicUrl,
        createdAt: new Date(),
      });
  
      await saveCredentials(email, password); // ✅ Save login for biometric use
  
      // ✅ Navigate to ProfileScreen if user needs to pick a custom image
      navigation.reset({ index: 0, routes: [{ name: "ProfileScreen" }] });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };
  

  // 🔹 Sign In Function
  const handleSignIn = async (emailInput?: string, passwordInput?: string) => {
    try {
      const userEmail = emailInput || email;
      const userPassword = passwordInput || password;
  
      const userCredential = await signInWithEmailAndPassword(auth, userEmail, userPassword);
      const loggedInUser = userCredential.user;
  
      await reload(loggedInUser); // 🔄 Refresh user data
      console.log("🔄 Refreshed Firebase User:", auth.currentUser);
  
      await saveCredentials(userEmail, userPassword); // ✅ Save login for biometric use
  
      // ✅ Check if the user has a profile picture
      if (loggedInUser.photoURL) {
        navigation.reset({ index: 0, routes: [{ name: "Lobby" }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: "ProfileScreen" }] });
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };  

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="blue" />
      ) : (
        <>
          <Text style={styles.title}>Click War Reverse Login</Text>

          {/* ✅ Profile Picture Display */}
          {profilePic && <Image source={{ uri: profilePic }} style={styles.profilePic} />}

          <TextInput style={styles.input} placeholder="Username" value={username} onChangeText={setUsername} />
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

          <Button title="Sign Up" onPress={handleSignUp} />
          <Button title="Sign In" onPress={() => handleSignIn()} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  input: { borderWidth: 1, padding: 10, width: "80%", marginBottom: 10 },

  profilePic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
});
