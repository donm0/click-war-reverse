import React, { useState } from "react";
import { View, Text, Button, Image, StyleSheet, Alert } from "react-native";
import { auth, db } from "./firebaseConfig";
import * as ImagePicker from "expo-image-picker";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";

export default function ProfileScreen({ navigation }: any) {
  const [profilePic, setProfilePic] = useState(auth.currentUser?.photoURL || "https://via.placeholder.com/100");

  // 🔹 Pick Image
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProfilePic(result.assets[0].uri);
      uploadProfilePicture(result.assets[0].uri);
    }
  };

  // 🔹 Upload Image to Firebase Storage
  const uploadProfilePicture = async (imageUri: string) => {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const storage = getStorage();
      const storageRef = ref(storage, `profile_pics/${auth.currentUser?.uid}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      await updateProfile(auth.currentUser!, { photoURL: url });
      await updateDoc(doc(db, "users", auth.currentUser!.uid), { profilePic: url });

      Alert.alert("Profile updated successfully!");

      // ✅ Navigate to the Lobby after profile setup
      navigation.reset({ index: 0, routes: [{ name: "Lobby" }] });
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Settings</Text>
      <Image source={{ uri: profilePic }} style={styles.profilePic} />
      <Button title="Change Profile Picture" onPress={pickImage} />
      <Button title="Go to Lobby" onPress={() => navigation.reset({ index: 0, routes: [{ name: "Lobby" }] })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  profilePic: { width: 100, height: 100, borderRadius: 50, marginBottom: 10 },
});
