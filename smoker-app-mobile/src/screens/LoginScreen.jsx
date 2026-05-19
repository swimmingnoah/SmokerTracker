import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { apiFetch } from "../api";
import { setStoredKey } from "../auth";

export default function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password) return;
    setError("");
    setLoading(true);
    try {
      const response = await apiFetch("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: password }),
      });
      const data = await response.json();
      if (data.valid) {
        await setStoredKey(password);
        onLogin();
      } else {
        setError("Invalid password");
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-gray-100 px-6">
      <View className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lg">
        <Text className="mb-2 text-center text-2xl font-bold text-gray-800">
          Smoker Tracker
        </Text>
        <Text className="mb-6 text-center text-sm text-gray-500">
          Enter your password to continue
        </Text>

        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoFocus
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          onSubmitEditing={handleSubmit}
          className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-base"
        />

        {error ? (
          <Text className="mb-3 text-center text-sm text-red-600">{error}</Text>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={loading || !password}
          className={`w-full items-center rounded-lg px-6 py-3 ${
            loading || !password ? "bg-orange-400" : "bg-orange-600"
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-medium text-white">Log In</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
