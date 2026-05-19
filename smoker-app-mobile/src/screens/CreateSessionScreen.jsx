import { useEffect, useState } from "react";
import {
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

export default function CreateSessionScreen({ navigation }) {
  const [name, setName] = useState("");
  const [meatType, setMeatType] = useState("");
  const [notes, setNotes] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [weight, setWeight] = useState("");
  const [spicesList, setSpicesList] = useState([]);
  const [newSpice, setNewSpice] = useState("");
  const [creating, setCreating] = useState(false);
  const [meatTypeOptions, setMeatTypeOptions] = useState([]);

  useEffect(() => {
    fetchMeatTypes();
  }, []);

  const fetchMeatTypes = async () => {
    try {
      const response = await apiFetch("/meat-types");
      if (response.ok) {
        const data = await response.json();
        setMeatTypeOptions(data.meatTypes);
        if (data.meatTypes.length > 0 && !meatType) {
          setMeatType(data.meatTypes[0]);
        }
      }
    } catch {}
  };

  const addSpice = () => {
    const spice = newSpice.trim();
    if (!spice || spicesList.includes(spice)) {
      setNewSpice("");
      return;
    }
    setSpicesList([...spicesList, spice]);
    setNewSpice("");
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter a session name.");
      return;
    }

    try {
      setCreating(true);
      const response = await apiFetch("/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          meatType: meatType.trim(),
          notes: notes.trim(),
          recipeUrl: recipeUrl.trim(),
          weight: weight.trim(),
          spices: spicesList.join(", "),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      navigation.replace("SessionDetail", {
        id: data.session.id,
        session: data.session,
      });
    } catch (err) {
      Alert.alert("Error", "Failed to create session: " + err.message);
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-gray-100"
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View className="rounded-lg bg-white p-5 shadow">
          <Text className="mb-6 text-2xl font-bold text-gray-800">
            Start New Smoke Session
          </Text>

          <Field label="Session Name *">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., Saturday Brisket"
              placeholderTextColor="#9ca3af"
              className="rounded-lg border border-gray-300 px-4 py-3 text-base"
            />
          </Field>

          <Field label="Meat Type">
            {meatTypeOptions.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {meatTypeOptions.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setMeatType(opt)}
                    className={`rounded-full px-3 py-1.5 ${
                      meatType === opt ? "bg-orange-600" : "bg-gray-200"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        meatType === opt ? "text-white" : "text-gray-700"
                      }`}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text className="italic text-gray-500">
                No meat types configured yet.
              </Text>
            )}
            <Pressable
              onPress={() => navigation.navigate("MeatTypes")}
              className="mt-2"
            >
              <Text className="text-sm font-medium text-orange-600">
                Manage Meat Types
              </Text>
            </Pressable>
          </Field>

          <Field label="Weight (Optional)">
            <TextInput
              value={weight}
              onChangeText={setWeight}
              placeholder="e.g. 12 lbs"
              placeholderTextColor="#9ca3af"
              className="rounded-lg border border-gray-300 px-4 py-3 text-base"
            />
          </Field>

          <Field label="Recipe URL (Optional)">
            <TextInput
              value={recipeUrl}
              onChangeText={setRecipeUrl}
              placeholder="https://example.com/recipe"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              keyboardType="url"
              className="rounded-lg border border-gray-300 px-4 py-3 text-base"
            />
          </Field>

          <Field label="Spices / Rub (Optional)">
            {spicesList.length > 0 && (
              <View className="mb-2 flex-row flex-wrap gap-2">
                {spicesList.map((spice) => (
                  <Pressable
                    key={spice}
                    onPress={() =>
                      setSpicesList(spicesList.filter((s) => s !== spice))
                    }
                    className="flex-row items-center rounded-full bg-amber-100 px-3 py-1"
                  >
                    <Text className="text-sm font-medium text-amber-800">
                      {spice}
                    </Text>
                    <Text className="ml-1 text-amber-600">×</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View className="flex-row gap-2">
              <TextInput
                value={newSpice}
                onChangeText={setNewSpice}
                onSubmitEditing={addSpice}
                placeholder="Type a spice..."
                placeholderTextColor="#9ca3af"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base"
              />
              <Pressable
                onPress={addSpice}
                disabled={!newSpice.trim()}
                className={`items-center justify-center rounded-lg px-4 ${
                  newSpice.trim() ? "bg-orange-600" : "bg-orange-300"
                }`}
              >
                <Text className="font-medium text-white">Add</Text>
              </Pressable>
            </View>
          </Field>

          <Field label="Notes (Optional)">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about this smoke..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="rounded-lg border border-gray-300 px-4 py-3 text-base"
              style={{ minHeight: 96 }}
            />
          </Field>

          <View className="flex-row gap-3">
            <Pressable
              onPress={handleSubmit}
              disabled={creating}
              className={`flex-1 items-center rounded-lg px-6 py-3 ${
                creating ? "bg-orange-300" : "bg-orange-600"
              }`}
            >
              <Text className="font-medium text-white">
                {creating ? "Creating..." : "Start Session"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.goBack()}
              disabled={creating}
              className="flex-1 items-center rounded-lg bg-gray-300 px-6 py-3"
            >
              <Text className="font-medium text-gray-700">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-sm font-medium text-gray-700">{label}</Text>
      {children}
    </View>
  );
}
