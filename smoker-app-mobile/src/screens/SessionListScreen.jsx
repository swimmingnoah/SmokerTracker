import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "../api";

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const calculateDuration = (start, end) => {
  if (!start) return "N/A";
  const startTime = new Date(start);
  const endTime = end !== null ? new Date(end) : new Date();
  const diffMs = endTime - startTime;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

export default function SessionListScreen({ navigation }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showHidden, setShowHidden] = useState(false);
  const [meatTypeFilter, setMeatTypeFilter] = useState("All");
  const [meatTypes, setMeatTypes] = useState([]);

  const fetchSessions = useCallback(async () => {
    try {
      setError(null);
      const path = showHidden ? "/sessions?include_hidden=true" : "/sessions";
      const response = await apiFetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSessions(data.sessions);
    } catch (err) {
      setError("Failed to load sessions: " + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showHidden]);

  const fetchMeatTypes = useCallback(async () => {
    try {
      const response = await apiFetch("/meat-types");
      if (!response.ok) return;
      const data = await response.json();
      setMeatTypes(data.meatTypes);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSessions();
      fetchMeatTypes();
    }, [fetchSessions, fetchMeatTypes])
  );

  const handleDelete = (sessionId) => {
    Alert.alert(
      "Delete session?",
      "This will hide it from view (temperature data remains in InfluxDB).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await apiFetch(`/sessions/${encodeURIComponent(sessionId)}`, {
                method: "DELETE",
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              fetchSessions();
            } catch (err) {
              Alert.alert("Error", "Failed to delete session: " + err.message);
            }
          },
        },
      ]
    );
  };

  const handleRestore = async (sessionId) => {
    try {
      const res = await apiFetch(`/sessions/${encodeURIComponent(sessionId)}/restore`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchSessions();
    } catch (err) {
      Alert.alert("Error", "Failed to restore session: " + err.message);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSessions();
    fetchMeatTypes();
  };

  const allVisible = sessions.filter((s) => !s.hidden);
  const hiddenSessions = sessions.filter((s) => s.hidden);
  const visibleSessions =
    meatTypeFilter === "All"
      ? allVisible
      : allVisible.filter((s) => s.meatType === meatTypeFilter);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator size="large" color="#ea580c" />
        <Text className="mt-4 text-gray-600">Loading sessions...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100 p-6">
        <View className="w-full rounded-lg bg-white p-6 shadow">
          <Text className="mb-3 text-xl font-bold text-red-600">Error</Text>
          <Text className="mb-4 text-gray-700">{error}</Text>
          <Pressable
            onPress={fetchSessions}
            className="items-center rounded bg-orange-600 px-4 py-2"
          >
            <Text className="font-medium text-white">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const renderItem = ({ item: session }) => (
    <Pressable
      onPress={() =>
        navigation.navigate("SessionDetail", { id: session.id, session })
      }
      className="mb-3 rounded-lg border-l-4 border-orange-500 bg-white p-5 shadow"
    >
      <View className="flex-row items-start justify-between">
        <Text className="flex-1 pr-2 text-xl font-semibold text-gray-800">
          {session.name}
        </Text>
        <View className="rounded bg-orange-100 px-2 py-0.5">
          <Text className="text-xs font-medium text-orange-800">
            {session.meatType || "N/A"}
          </Text>
        </View>
      </View>
      <Text className="mt-2 text-sm text-gray-600">
        {formatDate(session.startTime)}
      </Text>
      <Text className="text-sm text-gray-600">
        Duration: {calculateDuration(session.startTime, session.endTime)}
      </Text>
      {session.notes ? (
        <Text
          numberOfLines={2}
          className="mt-2 border-t border-gray-200 pt-2 text-xs italic text-gray-500"
        >
          "{session.notes}"
        </Text>
      ) : null}
      <Pressable
        onPress={() => handleDelete(session.id)}
        hitSlop={10}
        className="absolute right-3 top-3"
      >
        <Text className="text-xl text-gray-400">×</Text>
      </Pressable>
    </Pressable>
  );

  return (
    <FlatList
      className="flex-1 bg-gray-100"
      contentContainerStyle={{ padding: 12 }}
      data={visibleSessions}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ea580c" />
      }
      ListHeaderComponent={
        <View className="mb-3">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-gray-800">Smoke Sessions</Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => navigation.navigate("MeatTypes")}
                className="items-center justify-center rounded-lg bg-gray-200 px-3 py-2"
              >
                <Text className="text-gray-700">⚙</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate("CreateSession")}
                className="flex-row items-center rounded-lg bg-orange-600 px-4 py-2"
              >
                <Text className="mr-1 text-white">+</Text>
                <Text className="font-medium text-white">New</Text>
              </Pressable>
            </View>
          </View>

          {meatTypes.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-1 mb-2"
            >
              <View className="flex-row gap-2 px-1">
                <FilterChip
                  label="All"
                  active={meatTypeFilter === "All"}
                  onPress={() => setMeatTypeFilter("All")}
                />
                {meatTypes.map((type) => (
                  <FilterChip
                    key={type}
                    label={type}
                    active={meatTypeFilter === type}
                    onPress={() =>
                      setMeatTypeFilter(type === meatTypeFilter ? "All" : type)
                    }
                  />
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      }
      ListEmptyComponent={
        <View className="items-center rounded-lg bg-white p-8 shadow">
          {meatTypeFilter !== "All" ? (
            <>
              <Text className="mb-3 text-gray-500">
                No sessions found for "{meatTypeFilter}".
              </Text>
              <Pressable onPress={() => setMeatTypeFilter("All")}>
                <Text className="font-medium text-orange-600">Clear filter</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text className="mb-4 text-gray-500">
                No smoke sessions yet. Start your first smoke!
              </Text>
              <Pressable
                onPress={() => navigation.navigate("CreateSession")}
                className="rounded-lg bg-orange-600 px-6 py-3"
              >
                <Text className="font-medium text-white">Create First Session</Text>
              </Pressable>
            </>
          )}
        </View>
      }
      ListFooterComponent={
        <View className="mt-4 mb-10">
          <Pressable
            onPress={() => setShowHidden(!showHidden)}
            className="flex-row items-center"
          >
            <Text className="text-sm font-medium text-gray-500">
              {showHidden ? "Hide deleted sessions" : "Show deleted sessions"}
            </Text>
          </Pressable>

          {showHidden && hiddenSessions.length > 0 && (
            <View className="mt-3">
              {hiddenSessions.map((session) => (
                <View
                  key={session.id}
                  className="mb-3 rounded-lg border-l-4 border-gray-300 bg-gray-200 p-5 opacity-60"
                >
                  <View className="flex-row items-start justify-between">
                    <Text className="flex-1 pr-2 text-xl font-semibold text-gray-500">
                      {session.name}
                    </Text>
                    <Pressable
                      onPress={() => handleRestore(session.id)}
                      hitSlop={10}
                    >
                      <Text className="text-sm font-medium text-green-600">Restore</Text>
                    </Pressable>
                  </View>
                  <Text className="mt-2 text-sm text-gray-400">
                    {formatDate(session.startTime)}
                  </Text>
                  <Text className="text-sm text-gray-400">
                    Duration: {calculateDuration(session.startTime, session.endTime)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {showHidden && hiddenSessions.length === 0 && (
            <Text className="mt-3 text-sm italic text-gray-400">
              No deleted sessions.
            </Text>
          )}
        </View>
      }
    />
  );
}

function FilterChip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-4 py-1.5 ${
        active ? "bg-orange-600" : "bg-gray-200"
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          active ? "text-white" : "text-gray-600"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
