import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { apiFetch, resolveMediaUrl } from "../api";
import TemperatureChart from "./TemperatureChart";

const probeColors = {
  probe_1: "#ef4444",
  probe_2: "#3b82f6",
  firepot: "#f59e0b",
  rtd: "#10b981",
};

const probeNames = {
  probe_1: "Probe 1",
  probe_2: "Probe 2",
  firepot: "Firepot",
  rtd: "RTD",
};

const formatDate = (dateString) =>
  new Date(dateString).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatTime = (date) =>
  new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

const parseLocalDatetimeValue = (value) => {
  // Accepts "YYYY-MM-DD HH:MM" or ISO-like; returns Date or null
  if (!value) return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5])
  );
};

export default function SessionDetailScreen({ route, navigation }) {
  const { id, session: initialSession } = route.params || {};

  const [session, setSession] = useState(initialSession || null);
  const [loadingSession, setLoadingSession] = useState(!initialSession);
  const [temperatureData, setTemperatureData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(initialSession?.name || "");
  const [isEditingMeatType, setIsEditingMeatType] = useState(false);
  const [editedMeatType, setEditedMeatType] = useState(initialSession?.meatType || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(initialSession?.notes || "");
  const [isEditingRecipeUrl, setIsEditingRecipeUrl] = useState(false);
  const [editedRecipeUrl, setEditedRecipeUrl] = useState(initialSession?.recipeUrl || "");
  const [isEditingSpices, setIsEditingSpices] = useState(false);
  const [spicesList, setSpicesList] = useState(
    initialSession?.spices
      ? initialSession.spices.split(",").map((s) => s.trim()).filter(Boolean)
      : []
  );
  const [newSpice, setNewSpice] = useState("");
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [editedWeight, setEditedWeight] = useState(initialSession?.weight || "");
  const [savingField, setSavingField] = useState(null);

  const [hiddenProbes, setHiddenProbes] = useState(new Set());
  const [customProbeNames, setCustomProbeNames] = useState({});
  const [editingProbeName, setEditingProbeName] = useState(null);
  const [editedProbeName, setEditedProbeName] = useState("");

  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [setpoints, setSetpoints] = useState([]);
  const [showSetpoints, setShowSetpoints] = useState(true);
  const [hiddenSetpoints, setHiddenSetpoints] = useState(new Set());

  const [pauses, setPauses] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [editingPauseIndex, setEditingPauseIndex] = useState(null);
  const [editedPauseTime, setEditedPauseTime] = useState("");

  const [meatTypeOptions, setMeatTypeOptions] = useState([]);

  const [isEditingStartTime, setIsEditingStartTime] = useState(false);
  const [editedStartTime, setEditedStartTime] = useState("");
  const [isEditingEndTime, setIsEditingEndTime] = useState(false);
  const [editedEndTime, setEditedEndTime] = useState("");

  const lastFetchedTimeRef = useRef(null);
  const intervalRef = useRef(null);

  const isActiveSession = () => session && session.endTime === null;

  // Fetch session if not passed via params
  useEffect(() => {
    if (session) return;
    (async () => {
      try {
        const res = await apiFetch("/sessions");
        const data = await res.json();
        const found = data.sessions.find((s) => s.id === decodeURIComponent(id));
        if (found) {
          setSession(found);
          setEditedName(found.name);
          setEditedMeatType(found.meatType || "");
          setEditedNotes(found.notes || "");
          setEditedRecipeUrl(found.recipeUrl || "");
          setSpicesList(
            found.spices
              ? found.spices.split(",").map((s) => s.trim()).filter(Boolean)
              : []
          );
          setEditedWeight(found.weight || "");
        } else {
          navigation.goBack();
        }
      } catch {
        navigation.goBack();
      } finally {
        setLoadingSession(false);
      }
    })();
  }, []);

  // Initial data fetch when session is ready
  useEffect(() => {
    if (!session) return;
    navigation.setOptions({ title: session.name });
    lastFetchedTimeRef.current = null;
    fetchTemperatureData(true);
    fetchSetpoints();
    fetchPauses();
    fetchMeatTypeOptions();
    fetchHiddenSetpoints();
    fetchPhotos();
    fetchProbeSettings();
  }, [session?.id]);

  // Polling for active sessions
  useEffect(() => {
    if (!session || !isActiveSession()) return;
    intervalRef.current = setInterval(() => {
      fetchTemperatureData(false);
      fetchSetpoints();
      fetchPauses();
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.id, session?.endTime]);

  const fetchMeatTypeOptions = async () => {
    try {
      const res = await apiFetch("/meat-types");
      if (!res.ok) return;
      const data = await res.json();
      setMeatTypeOptions(data.meatTypes);
    } catch {}
  };

  const fetchHiddenSetpoints = async () => {
    try {
      const encodedId = encodeURIComponent(session.id);
      const res = await apiFetch(`/sessions/${encodedId}/hidden-setpoints`);
      if (!res.ok) return;
      const data = await res.json();
      setHiddenSetpoints(new Set(data.hiddenSetpoints));
    } catch {}
  };

  const saveHiddenSetpoints = async (newSet) => {
    try {
      const encodedId = encodeURIComponent(session.id);
      await apiFetch(`/sessions/${encodedId}/hidden-setpoints`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamps: [...newSet] }),
      });
    } catch {}
  };

  const fetchSetpoints = async () => {
    if (!session) return;
    try {
      const isActive = session.endTime === null;
      const startTime = new Date(session.startTime).toISOString();
      const endTime = isActive
        ? new Date().toISOString()
        : new Date(session.endTime).toISOString();
      const encodedId = encodeURIComponent(session.id);
      const res = await apiFetch(
        `/sessions/${encodedId}/setpoints?start=${encodeURIComponent(startTime)}&end=${encodeURIComponent(endTime)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setSetpoints(data.setpoints);
    } catch {}
  };

  const fetchPauses = async () => {
    if (!session) return;
    try {
      const encodedId = encodeURIComponent(session.id);
      const res = await apiFetch(`/sessions/${encodedId}/pauses`);
      if (!res.ok) return;
      const data = await res.json();
      const events = data.pauses || [];
      setPauses(events);
      setIsPaused(events[events.length - 1]?.type === "pause");
    } catch {}
  };

  const handlePauseResume = async () => {
    try {
      setPauseLoading(true);
      const encodedId = encodeURIComponent(session.id);
      const action = isPaused ? "resume" : "pause";
      const res = await apiFetch(`/sessions/${encodedId}/${action}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchPauses();
    } catch (err) {
      Alert.alert("Error", `Failed to ${isPaused ? "resume" : "pause"}: ${err.message}`);
    } finally {
      setPauseLoading(false);
    }
  };

  const handleEndSession = () => {
    Alert.alert(
      "End session?",
      "This will set the end time to now.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End",
          style: "destructive",
          onPress: async () => {
            try {
              const encodedId = encodeURIComponent(session.id);
              const res = await apiFetch(`/sessions/${encodedId}/end`, {
                method: "POST",
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const data = await res.json();
              setSession({ ...session, endTime: data.endTime });
              if (intervalRef.current) clearInterval(intervalRef.current);
            } catch (err) {
              Alert.alert("Error", "Failed to end session: " + err.message);
            }
          },
        },
      ]
    );
  };

  const fetchTemperatureData = async (isFullFetch) => {
    try {
      if (isFullFetch) {
        setLoading(true);
        setError(null);
      }
      const isActive = isActiveSession();
      const endTime = isActive
        ? new Date().toISOString()
        : new Date(session.endTime).toISOString();
      const startTime =
        !isFullFetch && lastFetchedTimeRef.current
          ? lastFetchedTimeRef.current
          : new Date(session.startTime).toISOString();

      const encodedId = encodeURIComponent(session.id);
      const url = `/sessions/${encodedId}/temperatures?start=${encodeURIComponent(startTime)}&end=${encodeURIComponent(endTime)}`;
      const res = await apiFetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      const result = await res.json();

      const newData = result.data.map((item) => {
        const clamped = { time: new Date(item.time).getTime() };
        for (const key of Object.keys(item)) {
          if (key === "time") continue;
          clamped[key] = item[key] < 0 ? 0 : item[key];
        }
        return clamped;
      });

      if (newData.length > 0) {
        lastFetchedTimeRef.current = new Date(
          newData[newData.length - 1].time
        ).toISOString();
      }

      if (isFullFetch || !lastFetchedTimeRef.current) {
        setTemperatureData(newData);
        calculateStats(newData);
      } else {
        setTemperatureData((prev) => {
          const combined = [...prev, ...newData];
          const seen = new Set();
          const deduped = combined.filter((d) => {
            if (seen.has(d.time)) return false;
            seen.add(d.time);
            return true;
          });
          calculateStats(deduped);
          return deduped;
        });
      }
      setLoading(false);
    } catch (err) {
      setError("Failed to load temperature data: " + err.message);
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    if (data.length === 0) return;
    const probes = Object.keys(data[0]).filter((k) => k !== "time");
    const next = {};
    probes.forEach((probe) => {
      const values = data.map((d) => d[probe]).filter((v) => v !== undefined);
      if (values.length > 0) {
        next[probe] = {
          avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
          max: Math.round(Math.max(...values) * 10) / 10,
          min: Math.round(Math.min(...values) * 10) / 10,
        };
      }
    });
    setStats(next);
  };

  const saveSessionField = async (field, value) => {
    try {
      setSavingField(field);
      const encodedId = encodeURIComponent(session.id);
      const res = await apiFetch(`/sessions/${encodedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSession({ ...session, [field]: value });
    } catch (err) {
      Alert.alert("Error", `Failed to save ${field}: ${err.message}`);
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveStartTime = async () => {
    const parsed = parseLocalDatetimeValue(editedStartTime);
    if (!parsed) {
      Alert.alert("Invalid time", "Use format YYYY-MM-DD HH:MM");
      return;
    }
    try {
      setSavingField("startTime");
      const iso = parsed.toISOString();
      const encodedId = encodeURIComponent(session.id);
      const res = await apiFetch(`/sessions/${encodedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: iso }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSession({ ...session, startTime: iso });
      setIsEditingStartTime(false);
      lastFetchedTimeRef.current = null;
      fetchTemperatureData(true);
      fetchSetpoints();
    } catch (err) {
      Alert.alert("Error", "Failed to save start time: " + err.message);
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveEndTime = async (clear = false) => {
    let iso = "";
    if (!clear) {
      const parsed = parseLocalDatetimeValue(editedEndTime);
      if (!parsed) {
        Alert.alert("Invalid time", "Use format YYYY-MM-DD HH:MM");
        return;
      }
      iso = parsed.toISOString();
    }
    try {
      setSavingField("endTime");
      const encodedId = encodeURIComponent(session.id);
      const res = await apiFetch(`/sessions/${encodedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endTime: iso }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSession({ ...session, endTime: iso || null });
      setIsEditingEndTime(false);
      lastFetchedTimeRef.current = null;
      fetchTemperatureData(true);
      fetchSetpoints();
    } catch (err) {
      Alert.alert("Error", "Failed to save end time: " + err.message);
    } finally {
      setSavingField(null);
    }
  };

  const formatDatetimeInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const fetchProbeSettings = async () => {
    if (!session) return;
    try {
      const encodedId = encodeURIComponent(session.id);
      const res = await apiFetch(`/sessions/${encodedId}/probe-settings`);
      if (!res.ok) return;
      const data = await res.json();
      setHiddenProbes(new Set(data.hiddenProbes || []));
      setCustomProbeNames(data.probeNames || {});
    } catch {}
  };

  const saveProbeSettings = async (hidden, names) => {
    try {
      const encodedId = encodeURIComponent(session.id);
      await apiFetch(`/sessions/${encodedId}/probe-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hiddenProbes: [...hidden], probeNames: names }),
      });
    } catch {}
  };

  const toggleProbeHidden = (probe) => {
    const updated = new Set(hiddenProbes);
    if (updated.has(probe)) updated.delete(probe);
    else updated.add(probe);
    setHiddenProbes(updated);
    saveProbeSettings(updated, customProbeNames);
  };

  const handleSaveProbeName = (probe) => {
    const updated = { ...customProbeNames };
    const trimmed = editedProbeName.trim();
    if (trimmed) updated[probe] = trimmed;
    else delete updated[probe];
    setCustomProbeNames(updated);
    setEditingProbeName(null);
    saveProbeSettings(hiddenProbes, updated);
  };

  const getProbeDisplayName = (probe) =>
    customProbeNames[probe] || probeNames[probe];

  const handleSaveSpices = async (updatedList) => {
    const spicesStr = updatedList.join(", ");
    await saveSessionField("spices", spicesStr);
  };

  const handleAddSpice = () => {
    const spice = newSpice.trim();
    if (!spice || spicesList.includes(spice)) {
      setNewSpice("");
      return;
    }
    const updated = [...spicesList, spice];
    setSpicesList(updated);
    setNewSpice("");
    handleSaveSpices(updated);
  };

  const handleRemoveSpice = (spice) => {
    const updated = spicesList.filter((s) => s !== spice);
    setSpicesList(updated);
    handleSaveSpices(updated);
  };

  const fetchPhotos = async () => {
    if (!session) return;
    try {
      const encodedId = encodeURIComponent(session.id);
      const res = await apiFetch(`/sessions/${encodedId}/photos`);
      if (!res.ok) return;
      const data = await res.json();
      setPhotos(data.photos);
    } catch {}
  };

  const handleAddPhoto = async () => {
    Alert.alert("Add Photo", null, [
      { text: "Cancel", style: "cancel" },
      { text: "Take Photo", onPress: () => pickImage("camera") },
      { text: "Choose from Library", onPress: () => pickImage("library") },
    ]);
  };

  const pickImage = async (source) => {
    try {
      let perm;
      let result;
      if (source === "camera") {
        perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission needed", "Camera permission is required.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
      } else {
        perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission needed", "Photo library permission is required.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
      }
      if (result.canceled) return;
      const asset = result.assets[0];

      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append("photo", {
        uri: asset.uri,
        name: asset.fileName || `photo-${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      });
      const encodedId = encodeURIComponent(session.id);
      const res = await apiFetch(`/sessions/${encodedId}/photos`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await fetchPhotos();
    } catch (err) {
      Alert.alert("Error", "Failed to upload photo: " + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = (filename) => {
    Alert.alert("Delete this photo?", null, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const encodedId = encodeURIComponent(session.id);
            const res = await apiFetch(
              `/sessions/${encodedId}/photos/${filename}`,
              { method: "DELETE" }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await fetchPhotos();
          } catch (err) {
            Alert.alert("Error", "Failed to delete photo: " + err.message);
          }
        },
      },
    ]);
  };

  const handleSavePauseTime = async (index) => {
    try {
      const parsed = parseLocalDatetimeValue(editedPauseTime);
      if (!parsed) {
        Alert.alert("Invalid time", "Use format YYYY-MM-DD HH:MM");
        return;
      }
      const encodedId = encodeURIComponent(session.id);
      const res = await apiFetch(`/sessions/${encodedId}/pauses/${index}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time: parsed.toISOString() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditingPauseIndex(null);
      await fetchPauses();
    } catch (err) {
      Alert.alert("Error", "Failed to update pause time: " + err.message);
    }
  };

  const calculatePausedMs = () => {
    let total = 0;
    let pauseStart = null;
    for (const ev of pauses) {
      if (ev.type === "pause") pauseStart = new Date(ev.time);
      else if (ev.type === "resume" && pauseStart) {
        total += new Date(ev.time) - pauseStart;
        pauseStart = null;
      }
    }
    if (pauseStart) total += Date.now() - pauseStart;
    return total;
  };

  const calculateDuration = () => {
    if (!session?.startTime) return "N/A";
    const start = new Date(session.startTime);
    const end = session.endTime !== null ? new Date(session.endTime) : new Date();
    const net = end - start - calculatePausedMs();
    const hours = Math.floor(net / 3600000);
    const minutes = Math.floor((net % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const handleDelete = () => {
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
              const encodedId = encodeURIComponent(session.id);
              const res = await apiFetch(`/sessions/${encodedId}`, {
                method: "DELETE",
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              navigation.goBack();
            } catch (err) {
              Alert.alert("Error", "Failed to delete session: " + err.message);
            }
          },
        },
      ]
    );
  };

  if (loadingSession) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator size="large" color="#ea580c" />
        <Text className="mt-4 text-gray-600">Loading session...</Text>
      </View>
    );
  }

  if (!session) return null;

  const currentTemps =
    temperatureData.length > 0 ? temperatureData[temperatureData.length - 1] : null;

  return (
    <ScrollView className="flex-1 bg-gray-100" contentContainerStyle={{ padding: 12 }}>
      <View className="mb-4 rounded-lg bg-white p-4 shadow">
        {/* Name */}
        {isEditingName ? (
          <View className="mb-2 flex-row items-center gap-2">
            <TextInput
              value={editedName}
              onChangeText={setEditedName}
              autoFocus
              className="flex-1 rounded border-2 border-orange-500 px-2 py-1 text-xl font-bold text-gray-800"
            />
            <Pressable
              onPress={async () => {
                await saveSessionField("name", editedName);
                setIsEditingName(false);
              }}
              disabled={savingField === "name"}
              className="rounded bg-orange-600 px-3 py-1"
            >
              <Text className="text-sm text-white">Save</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setEditedName(session.name);
                setIsEditingName(false);
              }}
              className="rounded bg-gray-300 px-3 py-1"
            >
              <Text className="text-sm text-gray-700">Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setIsEditingName(true)} className="mb-2">
            <Text className="text-2xl font-bold text-gray-800">
              {session.name}{" "}
              <Text className="text-base text-gray-400">✎</Text>
            </Text>
          </Pressable>
        )}

        {/* Pause/Resume & End buttons for active */}
        {session.endTime === null ? (
          <View className="mb-3 flex-row gap-2">
            <Pressable
              onPress={handlePauseResume}
              disabled={pauseLoading}
              className={`flex-1 items-center rounded-lg px-4 py-3 ${
                isPaused ? "bg-green-600" : "bg-yellow-500"
              }`}
            >
              <Text className="font-medium text-white">
                {pauseLoading ? "..." : isPaused ? "▶ Resume" : "⏸ Pause"}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleEndSession}
              className="flex-1 items-center rounded-lg bg-orange-600 px-4 py-3"
            >
              <Text className="font-medium text-white">End Smoke</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Meat type / duration / weight */}
        <View className="mb-3 flex-row flex-wrap items-center gap-2">
          {isEditingMeatType ? (
            <View className="flex-row flex-wrap items-center gap-1">
              {meatTypeOptions.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setEditedMeatType(opt)}
                  className={`rounded-full px-2.5 py-1 ${
                    editedMeatType === opt ? "bg-orange-600" : "bg-gray-200"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      editedMeatType === opt ? "text-white" : "text-gray-700"
                    }`}
                  >
                    {opt}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={async () => {
                  await saveSessionField("meatType", editedMeatType);
                  setIsEditingMeatType(false);
                }}
                className="rounded bg-orange-600 px-2 py-1"
              >
                <Text className="text-xs text-white">Save</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setEditedMeatType(session.meatType || "");
                  setIsEditingMeatType(false);
                }}
                className="rounded bg-gray-300 px-2 py-1"
              >
                <Text className="text-xs text-gray-700">Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setIsEditingMeatType(true)}
              className="rounded-full bg-orange-100 px-3 py-1"
            >
              <Text className="text-sm font-medium text-orange-800">
                {session.meatType || "N/A"} ✎
              </Text>
            </Pressable>
          )}
          <Text className="text-sm text-gray-600">
            Duration: {calculateDuration()}
          </Text>
        </View>

        {isEditingWeight ? (
          <View className="mb-3 flex-row items-center gap-2">
            <TextInput
              value={editedWeight}
              onChangeText={setEditedWeight}
              autoFocus
              placeholder="e.g. 12 lbs"
              placeholderTextColor="#9ca3af"
              className="flex-1 rounded border-2 border-orange-500 px-3 py-1 text-sm"
            />
            <Pressable
              onPress={async () => {
                await saveSessionField("weight", editedWeight);
                setIsEditingWeight(false);
              }}
              className="rounded bg-orange-600 px-3 py-1"
            >
              <Text className="text-xs text-white">Save</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setEditedWeight(session.weight || "");
                setIsEditingWeight(false);
              }}
              className="rounded bg-gray-300 px-3 py-1"
            >
              <Text className="text-xs text-gray-700">Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setIsEditingWeight(true)} className="mb-3">
            <Text className="text-sm text-gray-600">
              {session.weight ? `Weight: ${session.weight} ✎` : "+ Add weight"}
            </Text>
          </Pressable>
        )}

        <View className="mb-2">
          <Text className="text-xs text-gray-500">Started</Text>
          {isEditingStartTime ? (
            <View className="mt-1 flex-row flex-wrap items-center gap-2">
              <TextInput
                value={editedStartTime}
                onChangeText={setEditedStartTime}
                placeholder="YYYY-MM-DD HH:MM"
                placeholderTextColor="#9ca3af"
                autoFocus
                className="rounded border-2 border-orange-500 px-2 py-1 text-sm"
              />
              <Pressable
                onPress={handleSaveStartTime}
                disabled={savingField === "startTime"}
                className="rounded bg-orange-600 px-3 py-1"
              >
                <Text className="text-xs text-white">
                  {savingField === "startTime" ? "Saving..." : "Save"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setIsEditingStartTime(false)}
                disabled={savingField === "startTime"}
                className="rounded bg-gray-300 px-3 py-1"
              >
                <Text className="text-xs text-gray-700">Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setEditedStartTime(formatDatetimeInput(session.startTime));
                setIsEditingStartTime(true);
              }}
            >
              <Text className="text-base font-semibold text-gray-800">
                {formatDate(session.startTime)}{" "}
                <Text className="text-sm text-gray-400">✎</Text>
              </Text>
            </Pressable>
          )}
        </View>
        <View className="mb-2">
          <Text className="text-xs text-gray-500">Ended</Text>
          {isEditingEndTime ? (
            <View className="mt-1 flex-row flex-wrap items-center gap-2">
              <TextInput
                value={editedEndTime}
                onChangeText={setEditedEndTime}
                placeholder="YYYY-MM-DD HH:MM"
                placeholderTextColor="#9ca3af"
                autoFocus
                className="rounded border-2 border-orange-500 px-2 py-1 text-sm"
              />
              <Pressable
                onPress={() => handleSaveEndTime(false)}
                disabled={savingField === "endTime"}
                className="rounded bg-orange-600 px-3 py-1"
              >
                <Text className="text-xs text-white">
                  {savingField === "endTime" ? "Saving..." : "Save"}
                </Text>
              </Pressable>
              {session.endTime !== null && (
                <Pressable
                  onPress={() => handleSaveEndTime(true)}
                  disabled={savingField === "endTime"}
                  className="rounded bg-red-100 px-3 py-1"
                >
                  <Text className="text-xs text-red-700">Clear</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setIsEditingEndTime(false)}
                disabled={savingField === "endTime"}
                className="rounded bg-gray-300 px-3 py-1"
              >
                <Text className="text-xs text-gray-700">Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setEditedEndTime(
                  session.endTime !== null
                    ? formatDatetimeInput(session.endTime)
                    : formatDatetimeInput(new Date().toISOString())
                );
                setIsEditingEndTime(true);
              }}
            >
              <Text className="text-base font-semibold text-gray-800">
                {session.endTime !== null
                  ? formatDate(session.endTime)
                  : "— still active —"}{" "}
                <Text className="text-sm text-gray-400">✎</Text>
              </Text>
            </Pressable>
          )}
        </View>

        <Section title="Notes" editing={isEditingNotes} onEdit={() => setIsEditingNotes(true)}>
          {isEditingNotes ? (
            <View>
              <TextInput
                value={editedNotes}
                onChangeText={setEditedNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{ minHeight: 96 }}
                className="rounded-lg border border-gray-300 p-3 text-base"
              />
              <View className="mt-2 flex-row gap-2">
                <Pressable
                  onPress={async () => {
                    await saveSessionField("notes", editedNotes);
                    setIsEditingNotes(false);
                  }}
                  className="rounded bg-orange-600 px-4 py-2"
                >
                  <Text className="text-white">Save</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEditedNotes(session.notes || "");
                    setIsEditingNotes(false);
                  }}
                  className="rounded bg-gray-300 px-4 py-2"
                >
                  <Text className="text-gray-700">Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text className="italic text-gray-700">
              {session.notes || "No notes yet. Tap Edit to add notes."}
            </Text>
          )}
        </Section>

        <Section title="Recipe" editing={isEditingRecipeUrl} onEdit={() => setIsEditingRecipeUrl(true)}>
          {isEditingRecipeUrl ? (
            <View>
              <TextInput
                value={editedRecipeUrl}
                onChangeText={setEditedRecipeUrl}
                autoCapitalize="none"
                keyboardType="url"
                placeholder="https://example.com/recipe"
                placeholderTextColor="#9ca3af"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <View className="mt-2 flex-row gap-2">
                <Pressable
                  onPress={async () => {
                    await saveSessionField("recipeUrl", editedRecipeUrl);
                    setIsEditingRecipeUrl(false);
                  }}
                  className="rounded bg-orange-600 px-4 py-2"
                >
                  <Text className="text-sm text-white">Save</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEditedRecipeUrl(session.recipeUrl || "");
                    setIsEditingRecipeUrl(false);
                  }}
                  className="rounded bg-gray-300 px-4 py-2"
                >
                  <Text className="text-sm text-gray-700">Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : session.recipeUrl ? (
            <Pressable onPress={() => Linking.openURL(session.recipeUrl)}>
              <Text className="text-sm text-orange-600 underline" numberOfLines={2}>
                {session.recipeUrl}
              </Text>
            </Pressable>
          ) : (
            <Text className="text-sm italic text-gray-700">
              No recipe link. Tap Edit to add one.
            </Text>
          )}
        </Section>

        <Section
          title="Spices / Rub"
          editing={isEditingSpices}
          onEdit={() => setIsEditingSpices(true)}
          hideEditLabel={isEditingSpices}
        >
          {spicesList.length > 0 && (
            <View className="mb-2 flex-row flex-wrap gap-2">
              {spicesList.map((spice) => (
                <View
                  key={spice}
                  className="flex-row items-center rounded-full bg-amber-100 px-3 py-1"
                >
                  <Text className="text-sm font-medium text-amber-800">{spice}</Text>
                  {isEditingSpices && (
                    <Pressable onPress={() => handleRemoveSpice(spice)} hitSlop={6}>
                      <Text className="ml-1 text-amber-600">×</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}

          {isEditingSpices ? (
            <View>
              <View className="flex-row gap-2">
                <TextInput
                  value={newSpice}
                  onChangeText={setNewSpice}
                  onSubmitEditing={handleAddSpice}
                  placeholder="Type a spice..."
                  placeholderTextColor="#9ca3af"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <Pressable
                  onPress={handleAddSpice}
                  disabled={!newSpice.trim()}
                  className={`items-center justify-center rounded-lg px-4 ${
                    newSpice.trim() ? "bg-orange-600" : "bg-orange-300"
                  }`}
                >
                  <Text className="text-sm text-white">Add</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => {
                  setIsEditingSpices(false);
                  setNewSpice("");
                }}
                className="mt-2"
              >
                <Text className="text-sm text-gray-500">Done</Text>
              </Pressable>
            </View>
          ) : spicesList.length === 0 ? (
            <Text className="text-sm italic text-gray-700">
              No spices listed. Tap Edit to add.
            </Text>
          ) : null}
        </Section>

        <View className="mt-3 rounded-lg bg-gray-50 p-3">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-sm font-medium text-gray-500">Photos</Text>
            <Pressable onPress={handleAddPhoto} disabled={uploadingPhoto}>
              <Text className="text-sm font-medium text-orange-600">
                {uploadingPhoto ? "Uploading..." : "+ Add Photo"}
              </Text>
            </Pressable>
          </View>
          {photos.length > 0 ? (
            <FlatList
              data={photos}
              keyExtractor={(p) => p.filename}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={{ gap: 8 }}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({ item: photo }) => (
                <View className="flex-1 relative">
                  <Pressable onPress={() => Linking.openURL(resolveMediaUrl(photo.url))}>
                    <Image
                      source={{ uri: resolveMediaUrl(photo.url) }}
                      style={{ width: "100%", height: 140, borderRadius: 8 }}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeletePhoto(photo.filename)}
                    className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"
                  >
                    <Text className="text-xs text-white">×</Text>
                  </Pressable>
                </View>
              )}
            />
          ) : (
            <Text className="text-sm italic text-gray-700">
              No photos yet. Tap "Add Photo" to upload.
            </Text>
          )}
        </View>
      </View>

      {/* Current Temperatures */}
      {currentTemps && (
        <View className="mb-4 rounded-lg bg-white p-4 shadow">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-gray-800">
              {isActiveSession() ? "Current Temperatures" : "Final Temperatures"}
            </Text>
            <Text className="text-xs text-gray-400">
              {formatTime(currentTemps.time)}
            </Text>
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {Object.entries(probeColors)
              .filter(([probe]) => !hiddenProbes.has(probe))
              .map(([probe, color]) => {
                const value = currentTemps[probe];
                return (
                  <View
                    key={probe}
                    style={{
                      backgroundColor: `${color}10`,
                      borderLeftWidth: 4,
                      borderLeftColor: color,
                      flexBasis: "48%",
                      padding: 10,
                      borderRadius: 8,
                      position: "relative",
                    }}
                  >
                    {editingProbeName === probe ? (
                      <TextInput
                        value={editedProbeName}
                        onChangeText={setEditedProbeName}
                        autoFocus
                        onSubmitEditing={() => handleSaveProbeName(probe)}
                        onBlur={() => handleSaveProbeName(probe)}
                        className="mb-1 rounded border border-orange-500 px-1 text-center text-xs"
                      />
                    ) : (
                      <Pressable
                        onPress={() => {
                          setEditingProbeName(probe);
                          setEditedProbeName(getProbeDisplayName(probe));
                        }}
                      >
                        <Text className="mb-1 text-center text-xs font-medium text-gray-600">
                          {getProbeDisplayName(probe)}
                        </Text>
                      </Pressable>
                    )}
                    <Text
                      className="text-center text-2xl font-bold"
                      style={{ color }}
                    >
                      {value !== undefined ? `${value}°F` : "—"}
                    </Text>
                    <Pressable
                      onPress={() => toggleProbeHidden(probe)}
                      className="absolute right-1 top-1"
                      hitSlop={6}
                    >
                      <Text className="text-xs text-gray-400">×</Text>
                    </Pressable>
                  </View>
                );
              })}
          </View>
          {hiddenProbes.size > 0 && (
            <Pressable
              onPress={() => {
                setHiddenProbes(new Set());
                saveProbeSettings(new Set(), customProbeNames);
              }}
              className="mt-2"
            >
              <Text className="text-xs font-medium text-blue-600">
                Show {hiddenProbes.size} hidden probe
                {hiddenProbes.size > 1 ? "s" : ""}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Setpoint History */}
      <View className="mb-4 rounded-lg bg-blue-50 p-4">
        <Pressable
          onPress={() => setShowSetpoints(!showSetpoints)}
          className="flex-row items-center justify-between"
        >
          <Text className="text-sm font-medium text-gray-700">
            Temperature Setpoint History
          </Text>
          <Text className="text-gray-500">{showSetpoints ? "▲" : "▼"}</Text>
        </Pressable>
        {showSetpoints && (
          <View className="mt-3">
            {setpoints.length === 0 ? (
              <Text className="text-sm italic text-gray-500">
                No setpoint data available
              </Text>
            ) : (
              (() => {
                const filtered = setpoints.filter((sp) => !hiddenSetpoints.has(sp.time));
                return filtered.map((setpoint, idx) => {
                  const setpointTime = new Date(setpoint.time);
                  const isFirst = setpoints[0] === setpoint;
                  const nextVisible = filtered[idx + 1];
                  const endTime = nextVisible
                    ? new Date(nextVisible.time)
                    : session.endTime
                      ? new Date(session.endTime)
                      : new Date();
                  const durationMs = endTime - setpointTime;
                  const h = Math.floor(durationMs / 3600000);
                  const m = Math.floor((durationMs % 3600000) / 60000);
                  return (
                    <View
                      key={setpoint.time}
                      className="mb-2 flex-row items-center justify-between rounded border-l-4 border-blue-500 bg-white p-3"
                    >
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xl font-bold text-blue-600">
                            {setpoint.value}°F
                          </Text>
                          {isFirst && (
                            <Text className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                              Initial
                            </Text>
                          )}
                          {!nextVisible && (
                            <Text className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                              Current
                            </Text>
                          )}
                        </View>
                        <Text className="mt-1 text-xs text-gray-500">
                          Set at {formatDate(setpoint.time)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-3">
                        <View>
                          <Text className="text-right text-sm font-semibold text-gray-700">
                            {h > 0 ? `${h}h ` : ""}
                            {m}m
                          </Text>
                          <Text className="text-right text-xs text-gray-500">duration</Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            const newSet = new Set([...hiddenSetpoints, setpoint.time]);
                            setHiddenSetpoints(newSet);
                            saveHiddenSetpoints(newSet);
                          }}
                        >
                          <Text className="text-gray-400">×</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                });
              })()
            )}
            {hiddenSetpoints.size > 0 && (
              <Pressable
                onPress={() => {
                  setHiddenSetpoints(new Set());
                  saveHiddenSetpoints(new Set());
                }}
              >
                <Text className="mt-1 text-xs font-medium text-blue-600">
                  Show {hiddenSetpoints.size} hidden setpoint
                  {hiddenSetpoints.size > 1 ? "s" : ""}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Pause History */}
      {pauses.length > 0 && (
        <View className="mb-4 rounded-lg bg-yellow-50 p-4">
          <Text className="mb-3 text-sm font-medium text-gray-700">
            Pause History
          </Text>
          {pauses.map((event, index) => {
            const isPauseEvent = event.type === "pause";
            const nextEvent = pauses[index + 1];
            let durationLabel = null;
            if (isPauseEvent && nextEvent?.type === "resume") {
              const ms = new Date(nextEvent.time) - new Date(event.time);
              const h = Math.floor(ms / 3600000);
              const m = Math.floor((ms % 3600000) / 60000);
              durationLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;
            } else if (isPauseEvent && !nextEvent) {
              durationLabel = "ongoing";
            }
            const isEditing = editingPauseIndex === index;
            return (
              <View
                key={index}
                className={`mb-2 flex-row items-center justify-between rounded border-l-4 bg-white p-3 ${
                  isPauseEvent ? "border-yellow-400" : "border-green-400"
                }`}
              >
                <View className="flex-1">
                  <Text
                    className={`text-sm font-semibold ${
                      isPauseEvent ? "text-yellow-700" : "text-green-700"
                    }`}
                  >
                    {isPauseEvent ? "Paused" : "Resumed"}
                  </Text>
                  {isEditing ? (
                    <View className="mt-1 flex-row flex-wrap items-center gap-2">
                      <TextInput
                        value={editedPauseTime}
                        onChangeText={setEditedPauseTime}
                        placeholder="YYYY-MM-DD HH:MM"
                        placeholderTextColor="#9ca3af"
                        autoFocus
                        className="rounded border-2 border-orange-500 px-2 py-1 text-xs"
                      />
                      <Pressable
                        onPress={() => handleSavePauseTime(index)}
                        className="rounded bg-orange-600 px-2 py-1"
                      >
                        <Text className="text-xs text-white">Save</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setEditingPauseIndex(null)}
                        className="rounded bg-gray-300 px-2 py-1"
                      >
                        <Text className="text-xs text-gray-700">Cancel</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => {
                        setEditingPauseIndex(index);
                        const d = new Date(event.time);
                        const pad = (n) => String(n).padStart(2, "0");
                        setEditedPauseTime(
                          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
                            d.getDate()
                          )} ${pad(d.getHours())}:${pad(d.getMinutes())}`
                        );
                      }}
                    >
                      <Text className="mt-0.5 text-xs text-gray-500">
                        {formatDate(event.time)}
                      </Text>
                    </Pressable>
                  )}
                </View>
                {durationLabel && !isEditing && (
                  <View className="ml-3">
                    <Text className="text-right text-sm font-semibold text-gray-700">
                      {durationLabel}
                    </Text>
                    <Text className="text-right text-xs text-gray-500">
                      off smoker
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Chart */}
      {loading ? (
        <View className="mb-4 items-center rounded-lg bg-white p-8 shadow">
          <ActivityIndicator size="large" color="#ea580c" />
          <Text className="mt-3 text-gray-600">Loading temperature data...</Text>
        </View>
      ) : error ? (
        <View className="mb-4 rounded-lg bg-white p-4 shadow">
          <Text className="text-red-600">{error}</Text>
        </View>
      ) : temperatureData.length > 0 ? (
        <View className="mb-4 rounded-lg bg-white p-3 shadow">
          <Text className="mb-2 text-lg font-bold text-gray-800">
            Temperature Over Time
          </Text>
          <TemperatureChart
            data={temperatureData}
            probeColors={probeColors}
            probeDisplayName={getProbeDisplayName}
            hiddenProbes={hiddenProbes}
            pauses={pauses}
          />
        </View>
      ) : null}

      {/* Stats */}
      {stats && (
        <View className="mb-4 rounded-lg bg-white p-4 shadow">
          <Text className="mb-3 text-lg font-bold text-gray-800">
            Temperature Statistics
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {Object.entries(stats)
              .filter(([probe]) => !hiddenProbes.has(probe))
              .map(([probe, data]) => (
                <View
                  key={probe}
                  className="rounded-lg border border-gray-200 p-3"
                  style={{ flexBasis: "48%" }}
                >
                  <Text
                    className="mb-2 font-semibold"
                    style={{ color: probeColors[probe] }}
                  >
                    {getProbeDisplayName(probe)}
                  </Text>
                  <Row label="Avg:" value={`${data.avg}°F`} />
                  <Row label="Max:" value={`${data.max}°F`} />
                  <Row label="Min:" value={`${data.min}°F`} />
                </View>
              ))}
          </View>
        </View>
      )}

      <Pressable
        onPress={handleDelete}
        className="mb-10 items-center rounded-lg border border-red-300 bg-white p-3"
      >
        <Text className="text-red-600">Delete Session</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, editing, onEdit, hideEditLabel, children }) {
  return (
    <View className="mt-3 rounded-lg bg-gray-50 p-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-medium text-gray-500">{title}</Text>
        {!editing && !hideEditLabel && (
          <Pressable onPress={onEdit}>
            <Text className="text-sm font-medium text-orange-600">Edit</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View className="flex-row justify-between py-0.5">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm font-medium text-gray-800">{value}</Text>
    </View>
  );
}
