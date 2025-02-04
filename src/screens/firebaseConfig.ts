import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB5PbI54YeuNeK90BhXEZ3uzNR2xHTbuoQ",
  authDomain: "click-war-reverse.firebaseapp.com",
  projectId: "click-war-reverse",
  storageBucket: "click-war-reverse.appspot.com",  // Fixed storageBucket URL
  messagingSenderId: "580841920906",
  appId: "1:580841920906:web:ed75b5bb6e61b78ecdd073"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app); // Firebase Authentication
export const db = getFirestore(app); // Firestore Database
