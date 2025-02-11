import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, UserCredential } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB5PbI54YeuNeK90BhXEZ3uzNR2xHTbuoQ",
  authDomain: "click-war-reverse.firebaseapp.com",
  projectId: "click-war-reverse",
  storageBucket: "click-war-reverse.appspot.com",
  messagingSenderId: "580841920906",
  appId: "1:580841920906:web:ed75b5bb6e61b78ecdd073",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * 🔐 Function to store user credentials securely
 */
export const storeUserCredentials = async (email: string, password: string) => {
  try {
    await AsyncStorage.setItem("userEmail", email);
    await AsyncStorage.setItem("userPassword", password);
  } catch (error) {
    console.error("Error storing credentials:", error);
  }
};

/**
 * 🔓 Function to attempt biometric authentication
 */
export const authenticateWithBiometrics = async (): Promise<boolean> => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    console.log("Biometric authentication not available");
    return false;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Authenticate to sign in",
    fallbackLabel: "Use password instead",
  });

  return result.success;
};

/**
 * 🔄 Function to auto-login using stored credentials and biometrics
 */
export const biometricSignIn = async (): Promise<UserCredential | null> => {
  try {
    const email = await AsyncStorage.getItem("userEmail");
    const password = await AsyncStorage.getItem("userPassword");

    if (!email || !password) {
      console.log("No saved credentials, manual login required");
      return null;
    }

    // Attempt biometric authentication
    const isAuthenticated = await authenticateWithBiometrics();
    if (!isAuthenticated) {
      console.log("Biometric authentication failed or canceled");
      return null;
    }

    // Sign in with Firebase
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Error with biometric sign-in:", error);
    return null;
  }
};

/**
 * 🚪 Function to log out and clear stored credentials
 */
export const logout = async () => {
  try {
    await signOut(auth);
    await AsyncStorage.removeItem("userEmail");
    await AsyncStorage.removeItem("userPassword");
    console.log("User logged out and credentials cleared");
  } catch (error) {
    console.error("Error logging out:", error);
  }
};
