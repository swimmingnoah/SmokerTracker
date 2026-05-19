import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiFetch } from "../api";

export default function MeatTypesScreen() {
  const [meatTypes, setMeatTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [editedName, setEditedName] = useState("");

  useEffect(() => {
    fetchMeatTypes();
  }, []);

  const fetchMeatTypes = async () => {
    try {
      setLoading(true);
      const response = await apiFetch("/meat-types");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setMeatTypes(data.meatTypes);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    const name = newType.trim();
    if (!name) return;
    try {
      setAdding(true);
      const response = await apiFetch("/meat-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setNewType("");
      await fetchMeatTypes();
    } catch (err) {
      Alert.alert("Error", "Failed to add meat type: " + err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRename = async (oldName) => {
    const name = editedName.trim();
    if (!name || name === oldName) {
      setEditingType(null);
      return;
    }
    try {
      const response = await apiFetch(
        `/meat-types/${encodeURIComponent(oldName)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      setEditingType(null);
      await fetchMeatTypes();
    } catch (err) {
      Alert.alert("Error", "Failed to rename meat type: " + err.message);
    }
  };

  const handleDelete = (meatType) => {
    Alert.alert(`Remove "${meatType}"?`, null, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const response = await apiFetch(
              `/meat-types/${encodeURIComponent(meatType)}`,
              { method: "DELETE" }
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            await fetchMeatTypes();
          } catch (err) {
            Alert.alert("Error", "Failed to remove meat type: " + err.message);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-gray-100"
    >
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="rounded-lg bg-white p-5 shadow">
          <Text className="mb-6 text-2xl font-bold text-gray-800">Meat Types</Text>

          <View className="mb-6 flex-row gap-2">
            <TextInput
              value={newType}
              onChangeText={setNewType}
              onSubmitEditing={handleAdd}
              placeholder="Add a new meat type..."
              placeholderTextColor="#9ca3af"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-base"
            />
            <Pressable
              onPress={handleAdd}
              disabled={adding || !newType.trim()}
              className={`items-center justify-center rounded-lg px-5 ${
                adding || !newType.trim() ? "bg-orange-300" : "bg-orange-600"
              }`}
            >
              <Text className="font-medium text-white">
                {adding ? "Adding..." : "Add"}
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#ea580c" />
              <Text className="mt-2 text-gray-500">Loading...</Text>
            </View>
          ) : meatTypes.length === 0 ? (
            <Text className="py-8 text-center italic text-gray-500">
              No meat types yet. Add your first one above.
            </Text>
          ) : (
            <View>
              {meatTypes.map((type) => (
                <View
                  key={type}
                  className="mb-2 flex-row items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  {editingType === type ? (
                    <View className="flex-1 flex-row items-center gap-2">
                      <TextInput
                        value={editedName}
                        onChangeText={setEditedName}
                        autoFocus
                        onSubmitEditing={() => handleRename(type)}
                        className="flex-1 rounded-lg border-2 border-orange-500 px-3 py-1 text-sm"
                      />
                      <Pressable
                        onPress={() => handleRename(type)}
                        className="rounded bg-orange-600 px-3 py-1"
                      >
                        <Text className="text-sm text-white">Save</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setEditingType(null)}
                        className="rounded bg-gray-300 px-3 py-1"
                      >
                        <Text className="text-sm text-gray-700">Cancel</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <View className="rounded-full bg-orange-100 px-3 py-1">
                        <Text className="text-sm font-medium text-orange-800">
                          {type}
                        </Text>
                      </View>
                      <View className="flex-row gap-3">
                        <Pressable
                          onPress={() => {
                            setEditingType(type);
                            setEditedName(type);
                          }}
                        >
                          <Text className="text-sm text-orange-600">Edit</Text>
                        </Pressable>
                        <Pressable onPress={() => handleDelete(type)}>
                          <Text className="text-sm text-red-600">Remove</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
