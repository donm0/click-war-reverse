import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, Image, TouchableOpacity } from "react-native"; // ✅ Import Image
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "./firebaseConfig";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, reload } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore"; // ✅ Import getDoc
import { COLORS } from "../theme/colors"; // Import the theme colors

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

      // 🔹 Auto-generate profile picture using RoboHash (Cat Avatars)
      const profilePicUrl = `https://robohash.org/${newUser.uid}.png?set=set4`;

      // ✅ Update Firebase Auth profile with displayName & profilePic
      await updateProfile(newUser, { displayName: username, photoURL: profilePicUrl });
      console.log("✅ Firebase displayName set:", newUser.displayName);

      // Save user info to Firestore
      await setDoc(doc(db, "users", newUser.uid), {
        uid: newUser.uid,
        email: newUser.email,
        username: username,
        profilePic: profilePicUrl, // ✅ Save profile picture to Firestore
        createdAt: new Date(),
      });

      await saveCredentials(email, password); // ✅ Save login for biometric use
      navigation.reset({ index: 0, routes: [{ name: "Lobby" }] });
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

      // ✅ Force refresh to ensure displayName is loaded
      await reload(loggedInUser);
      console.log("🔄 Refreshed Firebase User:", auth.currentUser);

      // 🔹 Ensure profile picture exists for old users
      const userDoc = await getDoc(doc(db, "users", loggedInUser.uid));
      if (userDoc.exists() && userDoc.data().profilePic) {
        console.log("✅ Profile picture found:", userDoc.data().profilePic);
        setProfilePic(userDoc.data().profilePic);
      } else {
        console.log("🚀 Assigning new profile picture...");
        const newProfilePic = `https://robohash.org/${loggedInUser.uid}.png?set=set4`;
        await updateProfile(loggedInUser, { photoURL: newProfilePic });
        await setDoc(doc(db, "users", loggedInUser.uid), { profilePic: newProfilePic }, { merge: true });
        setProfilePic(newProfilePic);
      }

      await saveCredentials(userEmail, userPassword); // ✅ Save login for biometric use
      navigation.reset({ index: 0, routes: [{ name: "Lobby" }] });
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

          <TouchableOpacity style={styles.button} onPress={handleSignUp}>
  <Text style={styles.buttonText}>Sign Up</Text>
</TouchableOpacity>

<TouchableOpacity style={styles.button} onPress={() => handleSignIn()}>
  <Text style={styles.buttonText}>Sign In</Text>
</TouchableOpacity>

        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background, // 🔹 Black background
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: COLORS.primary, // 🔹 Gold title text
    marginBottom: 20,
  },
  input: {
    width: "85%",
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.inputBackground, // 🔹 Dark grey input fields
    color: COLORS.text, // 🔹 Light grey text
    borderColor: COLORS.border, // 🔹 Subtle grey border
    borderWidth: 1,
    marginBottom: 15,
  },
  profilePic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.primary, // 🔹 Gold border around profile pic
  },
  button: {
    backgroundColor: COLORS.buttonBackground, // 🔹 Gold button background
    padding: 12,
    borderRadius: 8,
    width: "85%",
    alignItems: "center",
    marginVertical: 8,
  },
  buttonText: {
    color: COLORS.buttonText, // 🔹 Black text on gold button
    fontWeight: "bold",
    fontSize: 16,
  },
});