import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	ReferenceArea,
} from "recharts";
import { CONFIG, apiFetch } from "./config";

function SessionDetail() {
	const { id } = useParams();
	const location = useLocation();
	const navigate = useNavigate();

	const [session, setSession] = useState(location.state?.session || null);
	const [loadingSession, setLoadingSession] = useState(!location.state?.session);
	const [temperatureData, setTemperatureData] = useState([]);
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Editing states
	const [isEditingName, setIsEditingName] = useState(false);
	const [isEditingMeatType, setIsEditingMeatType] = useState(false);
	const [isEditingNotes, setIsEditingNotes] = useState(false);
	const [editedName, setEditedName] = useState(session?.name || "");
	const [editedMeatType, setEditedMeatType] = useState(session?.meatType || "");
	const [editedNotes, setEditedNotes] = useState(session?.notes || "");
	const [isEditingRecipeUrl, setIsEditingRecipeUrl] = useState(false);
	const [editedRecipeUrl, setEditedRecipeUrl] = useState(session?.recipeUrl || "");
	const [isEditingSpices, setIsEditingSpices] = useState(false);
	const [spicesList, setSpicesList] = useState(
		session?.spices ? session.spices.split(",").map((s) => s.trim()).filter(Boolean) : []
	);
	const [newSpice, setNewSpice] = useState("");
	const [savedSpices, setSavedSpices] = useState([]);
	const [isEditingWeight, setIsEditingWeight] = useState(false);
	const [editedWeight, setEditedWeight] = useState(session?.weight || "");
	const [savingField, setSavingField] = useState(null);
	const [hiddenProbes, setHiddenProbes] = useState(new Set());
	const [customProbeNames, setCustomProbeNames] = useState({});
	const [editingProbeName, setEditingProbeName] = useState(null);
	const [editedProbeName, setEditedProbeName] = useState("");
	const [photos, setPhotos] = useState([]);
	const [uploadingPhoto, setUploadingPhoto] = useState(false);
	const [setpoints, setSetpoints] = useState([]);
	const [loadingSetpoints, setLoadingSetpoints] = useState(false);
	const [showSetpoints, setShowSetpoints] = useState(true);
	const [hiddenSetpoints, setHiddenSetpoints] = useState(new Set());
	const [pauses, setPauses] = useState([]);
	const [isPaused, setIsPaused] = useState(false);
	const [pauseLoading, setPauseLoading] = useState(false);
	const [editingPauseIndex, setEditingPauseIndex] = useState(null);
	const [editedPauseTime, setEditedPauseTime] = useState("");
	const [meatTypeOptions, setMeatTypeOptions] = useState([]);

	// Ref for incremental fetch — tracks last data point timestamp
	const lastFetchedTimeRef = useRef(null);
	const intervalRef = useRef(null);

	const isActiveSession = () => {
		if (!session) return false;
		return session.endTime === null;
	};

	// Fetch session from API if not passed via router state
	useEffect(() => {
		if (session) return;
		apiFetch(`${CONFIG.apiUrl}/sessions`)
			.then((r) => r.json())
			.then((data) => {
				const found = data.sessions.find((s) => s.id === decodeURIComponent(id));
				if (found) {
					setSession(found);
					setEditedName(found.name);
					setEditedMeatType(found.meatType || "");
					setEditedNotes(found.notes || "");
					setEditedRecipeUrl(found.recipeUrl || "");
					setSpicesList(found.spices ? found.spices.split(",").map((s) => s.trim()).filter(Boolean) : []);
					setEditedWeight(found.weight || "");
				} else {
					navigate("/");
				}
				setLoadingSession(false);
			})
			.catch(() => navigate("/"));
	}, []);

	// Initial data fetch
	useEffect(() => {
		if (!session) return;
		lastFetchedTimeRef.current = null; // Reset for full fetch
		fetchTemperatureData(true);
		fetchSetpoints();
		fetchPauses();
		fetchMeatTypeOptions();
		fetchSavedSpices();
		fetchHiddenSetpoints();
		fetchPhotos();
		fetchProbeSettings();
	}, [session]);

	const fetchHiddenSetpoints = async () => {
		try {
			const encodedSessionId = encodeURIComponent(session.id);
			const response = await apiFetch(`${CONFIG.apiUrl}/sessions/${encodedSessionId}/hidden-setpoints`);
			if (!response.ok) return;
			const data = await response.json();
			setHiddenSetpoints(new Set(data.hiddenSetpoints));
		} catch (err) {
			console.error("Error fetching hidden setpoints:", err);
		}
	};

	const saveHiddenSetpoints = async (newSet) => {
		try {
			const encodedSessionId = encodeURIComponent(session.id);
			await apiFetch(`${CONFIG.apiUrl}/sessions/${encodedSessionId}/hidden-setpoints`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ timestamps: [...newSet] }),
			});
		} catch (err) {
			console.error("Error saving hidden setpoints:", err);
		}
	};

	const handleSavePauseTime = async (index) => {
		try {
			const newTime = new Date(editedPauseTime).toISOString();
			const encodedSessionId = encodeURIComponent(session.id);
			const response = await apiFetch(
				`${CONFIG.apiUrl}/sessions/${encodedSessionId}/pauses/${index}`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ time: newTime }),
				}
			);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			setEditingPauseIndex(null);
			await fetchPauses();
		} catch (err) {
			alert("Failed to update pause time: " + err.message);
		}
	};

	const toLocalDatetimeValue = (isoString) => {
		const d = new Date(isoString);
		const offset = d.getTimezoneOffset();
		const local = new Date(d.getTime() - offset * 60000);
		return local.toISOString().slice(0, 16);
	};

	const fetchMeatTypeOptions = async () => {
		try {
			const response = await apiFetch(`${CONFIG.apiUrl}/meat-types`);
			if (!response.ok) return;
			const data = await response.json();
			setMeatTypeOptions(data.meatTypes);
		} catch (err) {
			console.error("Error fetching meat types:", err);
		}
	};

	const fetchSavedSpices = async () => {
		try {
			const response = await apiFetch(`${CONFIG.apiUrl}/spices`);
			if (!response.ok) return;
			const data = await response.json();
			setSavedSpices(data.spices);
		} catch (err) {
			console.error("Error fetching saved spices:", err);
		}
	};

	const persistSpice = async (spice) => {
		if (savedSpices.includes(spice)) return;
		try {
			await apiFetch(`${CONFIG.apiUrl}/spices`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: spice }),
			});
			setSavedSpices((prev) => [...prev, spice].sort());
		} catch (err) {
			console.error("Error saving spice:", err);
		}
	};

	// Smart polling — only for active sessions
	useEffect(() => {
		if (!session) return;
		if (!isActiveSession()) return; // No polling for completed sessions

		intervalRef.current = setInterval(() => {
			fetchTemperatureData(false); // Incremental fetch
			fetchSetpoints();
			fetchPauses();
		}, 30000);

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [session]);

	const fetchSetpoints = async () => {
		try {
			setLoadingSetpoints(true);

			const isActive = session.endTime === null;

			const startTime = new Date(session.startTime).toISOString();
			const endTime = isActive
				? new Date().toISOString()
				: new Date(session.endTime).toISOString();

			const encodedSessionId = encodeURIComponent(session.id);
			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodedSessionId}/setpoints?start=${encodeURIComponent(startTime)}&end=${encodeURIComponent(endTime)}`
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			setSetpoints(result.setpoints);
			setLoadingSetpoints(false);
		} catch (err) {
			console.error("Error fetching setpoints:", err);
			setLoadingSetpoints(false);
		}
	};

	const fetchPauses = async () => {
		try {
			const encodedSessionId = encodeURIComponent(session.id);
			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodedSessionId}/pauses`
			);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const result = await response.json();
			const events = result.pauses || [];
			setPauses(events);
			// Determine current pause state from last event
			const last = events[events.length - 1];
			setIsPaused(last?.type === "pause");
		} catch (err) {
			console.error("Error fetching pauses:", err);
		}
	};

	const handlePauseResume = async () => {
		try {
			setPauseLoading(true);
			const encodedSessionId = encodeURIComponent(session.id);
			const action = isPaused ? "resume" : "pause";
			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodedSessionId}/${action}`,
				{ method: "POST" }
			);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			await fetchPauses();
		} catch (err) {
			alert(`Failed to ${isPaused ? "resume" : "pause"} session: ` + err.message);
		} finally {
			setPauseLoading(false);
		}
	};

	const handleEndSession = async () => {
		const confirmed = window.confirm(
			"Are you sure you want to end this session? This will set the end time to now."
		);

		if (!confirmed) return;

		try {
			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodeURIComponent(session.id)}/end`,
				{
					method: "POST",
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			// Update local session object and stop polling
			setSession({ ...session, endTime: data.endTime });
			if (intervalRef.current) clearInterval(intervalRef.current);

			alert("Session ended successfully!");
		} catch (err) {
			console.error("Error ending session:", err);
			alert("Failed to end session: " + err.message);
		}
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

			// Incremental: use last fetched time as start, otherwise use session start
			const startTime = (!isFullFetch && lastFetchedTimeRef.current)
				? lastFetchedTimeRef.current
				: new Date(session.startTime).toISOString();

			const encodedSessionId = encodeURIComponent(session.id);
			const url = `${
				CONFIG.apiUrl
			}/sessions/${encodedSessionId}/temperatures?start=${encodeURIComponent(
				startTime
			)}&end=${encodeURIComponent(endTime)}`;

			const response = await fetch(url);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(
					errorData.error || `HTTP error! status: ${response.status}`
				);
			}

			const result = await response.json();

			const newData = result.data.map((item) => {
				// Clamp negative values to 0; store time as ms for numeric XAxis
				const clamped = { time: new Date(item.time).getTime() };
				for (const key of Object.keys(item)) {
					if (key === "time") continue;
					clamped[key] = item[key] < 0 ? 0 : item[key];
				}
				return clamped;
			});

			// Update last fetched time to the latest data point
			if (newData.length > 0) {
				lastFetchedTimeRef.current = new Date(newData[newData.length - 1].time).toISOString();
			}

			if (isFullFetch || !lastFetchedTimeRef.current) {
				// Full fetch — replace all data
				setTemperatureData(newData);
				calculateStats(newData);
			} else {
				// Incremental — append new data points
				setTemperatureData((prev) => {
					const combined = [...prev, ...newData];
					// Deduplicate by time (in case of overlap at the boundary)
					const seen = new Set();
					const deduped = combined.filter((d) => {
						const key = d.time;
						if (seen.has(key)) return false;
						seen.add(key);
						return true;
					});
					calculateStats(deduped);
					return deduped;
				});
			}

			setLoading(false);
		} catch (err) {
			console.error("Error fetching temperature data:", err);
			setError("Failed to load temperature data: " + err.message);
			setLoading(false);
		}
	};

	const handleSaveName = async () => {
		try {
			setSavingField("name");

			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodeURIComponent(session.id)}`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						name: editedName,
					}),
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			session.name = editedName;
			setIsEditingName(false);
			setSavingField(null);
		} catch (err) {
			console.error("Error saving name:", err);
			alert("Failed to save name: " + err.message);
			setSavingField(null);
		}
	};

	const handleSaveMeatType = async () => {
		try {
			setSavingField("meatType");

			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodeURIComponent(session.id)}`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						meatType: editedMeatType,
					}),
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			session.meatType = editedMeatType;
			setIsEditingMeatType(false);
			setSavingField(null);
		} catch (err) {
			console.error("Error saving meat type:", err);
			alert("Failed to save meat type: " + err.message);
			setSavingField(null);
		}
	};

	const handleSaveNotes = async () => {
		try {
			setSavingField("notes");

			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodeURIComponent(session.id)}`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						notes: editedNotes,
					}),
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			session.notes = editedNotes;
			setIsEditingNotes(false);
			setSavingField(null);
		} catch (err) {
			console.error("Error saving notes:", err);
			alert("Failed to save notes: " + err.message);
			setSavingField(null);
		}
	};

	const handleSaveRecipeUrl = async () => {
		try {
			setSavingField("recipeUrl");
			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodeURIComponent(session.id)}`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ recipeUrl: editedRecipeUrl }),
				}
			);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			session.recipeUrl = editedRecipeUrl;
			setIsEditingRecipeUrl(false);
			setSavingField(null);
		} catch (err) {
			console.error("Error saving recipe URL:", err);
			alert("Failed to save recipe URL: " + err.message);
			setSavingField(null);
		}
	};

	const handleSaveWeight = async () => {
		try {
			setSavingField("weight");
			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodeURIComponent(session.id)}`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ weight: editedWeight }),
				}
			);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			session.weight = editedWeight;
			setIsEditingWeight(false);
			setSavingField(null);
		} catch (err) {
			console.error("Error saving weight:", err);
			alert("Failed to save weight: " + err.message);
			setSavingField(null);
		}
	};

	const fetchProbeSettings = async () => {
		try {
			const encodedSessionId = encodeURIComponent(session.id);
			const response = await fetch(`${CONFIG.apiUrl}/sessions/${encodedSessionId}/probe-settings`);
			if (!response.ok) return;
			const data = await response.json();
			setHiddenProbes(new Set(data.hiddenProbes || []));
			setCustomProbeNames(data.probeNames || {});
		} catch (err) {
			console.error("Error fetching probe settings:", err);
		}
	};

	const saveProbeSettings = async (hidden, names) => {
		try {
			const encodedSessionId = encodeURIComponent(session.id);
			await fetch(`${CONFIG.apiUrl}/sessions/${encodedSessionId}/probe-settings`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					hiddenProbes: [...hidden],
					probeNames: names,
				}),
			});
		} catch (err) {
			console.error("Error saving probe settings:", err);
		}
	};

	const toggleProbeHidden = (probe) => {
		const updated = new Set(hiddenProbes);
		if (updated.has(probe)) {
			updated.delete(probe);
		} else {
			updated.add(probe);
		}
		setHiddenProbes(updated);
		saveProbeSettings(updated, customProbeNames);
	};

	const handleSaveProbeName = (probe) => {
		const updated = { ...customProbeNames, [probe]: editedProbeName.trim() };
		if (!editedProbeName.trim()) {
			delete updated[probe];
		}
		setCustomProbeNames(updated);
		setEditingProbeName(null);
		saveProbeSettings(hiddenProbes, updated);
	};

	const getProbeDisplayName = (probe) => {
		return customProbeNames[probe] || probeNames[probe];
	};

	const handleSaveSpices = async (updatedList) => {
		const spicesStr = updatedList.join(", ");
		try {
			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodeURIComponent(session.id)}`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ spices: spicesStr }),
				}
			);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			session.spices = spicesStr;
		} catch (err) {
			console.error("Error saving spices:", err);
			alert("Failed to save spices: " + err.message);
		}
	};

	const handleAddSpice = (raw) => {
		const source = typeof raw === "string" ? raw : newSpice;
		const spice = source.trim().replace(/,/g, "");
		if (!spice) return;
		if (spicesList.includes(spice)) {
			setNewSpice("");
			return;
		}
		const updated = [...spicesList, spice];
		setSpicesList(updated);
		setNewSpice("");
		handleSaveSpices(updated);
		persistSpice(spice);
	};

	const handleRemoveSpice = (spice) => {
		const updated = spicesList.filter((s) => s !== spice);
		setSpicesList(updated);
		handleSaveSpices(updated);
	};

	const fetchPhotos = async () => {
		try {
			const encodedSessionId = encodeURIComponent(session.id);
			const response = await fetch(`${CONFIG.apiUrl}/sessions/${encodedSessionId}/photos`);
			if (!response.ok) return;
			const data = await response.json();
			setPhotos(data.photos);
		} catch (err) {
			console.error("Error fetching photos:", err);
		}
	};

	const handlePhotoUpload = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		try {
			setUploadingPhoto(true);
			const formData = new FormData();
			formData.append("photo", file);

			const encodedSessionId = encodeURIComponent(session.id);
			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodedSessionId}/photos`,
				{ method: "POST", body: formData }
			);

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || `HTTP error! status: ${response.status}`);
			}

			await fetchPhotos();
		} catch (err) {
			alert("Failed to upload photo: " + err.message);
		} finally {
			setUploadingPhoto(false);
			e.target.value = "";
		}
	};

	const handleDeletePhoto = async (filename) => {
		if (!window.confirm("Delete this photo?")) return;
		try {
			const encodedSessionId = encodeURIComponent(session.id);
			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodedSessionId}/photos/${filename}`,
				{ method: "DELETE" }
			);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			await fetchPhotos();
		} catch (err) {
			alert("Failed to delete photo: " + err.message);
		}
	};

	const handleCancelEdit = (field) => {
		switch (field) {
			case "name":
				setEditedName(session.name);
				setIsEditingName(false);
				break;
			case "meatType":
				setEditedMeatType(session.meatType);
				setIsEditingMeatType(false);
				break;
			case "notes":
				setEditedNotes(session.notes || "");
				setIsEditingNotes(false);
				break;
			case "recipeUrl":
				setEditedRecipeUrl(session.recipeUrl || "");
				setIsEditingRecipeUrl(false);
				break;
			case "weight":
				setEditedWeight(session.weight || "");
				setIsEditingWeight(false);
				break;
		}
	};

	const calculateStats = (data) => {
		if (data.length === 0) return;

		const probes = Object.keys(data[0]).filter((key) => key !== "time");
		const statsData = {};

		probes.forEach((probe) => {
			const values = data.map((d) => d[probe]).filter((v) => v !== undefined);
			if (values.length > 0) {
				statsData[probe] = {
					avg:
						Math.round(
							(values.reduce((a, b) => a + b, 0) / values.length) * 10
						) / 10,
					max: Math.round(Math.max(...values) * 10) / 10,
					min: Math.round(Math.min(...values) * 10) / 10,
				};
			}
		});

		setStats(statsData);
	};

	const formatTime = (date) => {
		return date.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const formatDate = (dateString) => {
		const date = new Date(dateString);
		return date.toLocaleString("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const calculatePausedMs = () => {
		let totalPausedMs = 0;
		let pauseStart = null;
		for (const event of pauses) {
			if (event.type === "pause") {
				pauseStart = new Date(event.time);
			} else if (event.type === "resume" && pauseStart) {
				totalPausedMs += new Date(event.time) - pauseStart;
				pauseStart = null;
			}
		}
		// Currently paused — count ongoing pause
		if (pauseStart) {
			totalPausedMs += Date.now() - pauseStart;
		}
		return totalPausedMs;
	};

	const calculateDuration = () => {
		if (!session.startTime) return "N/A";
		const startTime = new Date(session.startTime);
		const endTime = session.endTime !== null ? new Date(session.endTime) : new Date();
		const netMs = endTime - startTime - calculatePausedMs();
		const hours = Math.floor(netMs / (1000 * 60 * 60));
		const minutes = Math.floor((netMs % (1000 * 60 * 60)) / (1000 * 60));
		return `${hours}h ${minutes}m`;
	};

	const handleDelete = async () => {
		const confirmed = window.confirm(
			"Are you sure you want to delete this session? This will hide it from view (temperature data remains in InfluxDB)."
		);
		if (!confirmed) return;

		try {
			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodeURIComponent(session.id)}`,
				{ method: "DELETE" }
			);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			alert("Session deleted successfully!");
			navigate("/");
		} catch (err) {
			alert("Failed to delete session: " + err.message);
		}
	};

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

	// Get current (latest) temperatures from the data
	const getCurrentTemps = () => {
		if (temperatureData.length === 0) return null;
		return temperatureData[temperatureData.length - 1];
	};

	if (loadingSession) {
		return (
			<div className="flex items-center justify-center py-20">
				<div className="text-center">
					<div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
					<p className="mt-4 text-gray-600">Loading session...</p>
				</div>
			</div>
		);
	}

	const currentTemps = getCurrentTemps();

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<button
					onClick={() => navigate("/")}
					className="flex items-center text-orange-600 hover:text-orange-700 font-medium"
				>
					← Back to Sessions
				</button>
			</div>

			<div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
				{/* Editable Name */}
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
					{isEditingName ? (
						<div className="flex items-center gap-2 w-full sm:w-auto">
							<input
								type="text"
								value={editedName}
								onChange={(e) => setEditedName(e.target.value)}
								className="flex-1 text-xl sm:text-3xl font-bold text-gray-800 px-2 py-1 border-2 border-orange-500 rounded focus:outline-none min-w-0"
								autoFocus
							/>
							<button
								onClick={handleSaveName}
								disabled={savingField === "name"}
								className="bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 text-sm disabled:opacity-50 whitespace-nowrap"
							>
								{savingField === "name" ? "..." : "Save"}
							</button>
							<button
								onClick={() => handleCancelEdit("name")}
								disabled={savingField === "name"}
								className="bg-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-400 text-sm disabled:opacity-50"
							>
								Cancel
							</button>
						</div>
					) : (
						<div className="flex items-center gap-2 group">
							<h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
								{session.name}
							</h2>
							<button
								onClick={() => setIsEditingName(true)}
								className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-orange-600 transition-opacity"
							>
								✏️
							</button>
						</div>
					)}

					{session.endTime === null ? (
						<div className="flex items-center gap-2 w-full sm:w-auto">
							<button
								onClick={handlePauseResume}
								disabled={pauseLoading}
								className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base ${
									isPaused
										? "bg-green-600 text-white hover:bg-green-700"
										: "bg-yellow-500 text-white hover:bg-yellow-600"
								}`}
							>
								{pauseLoading ? "..." : isPaused ? "▶ Resume" : "⏸ Pause"}
							</button>
							<button
								onClick={handleEndSession}
								className="flex-1 sm:flex-none bg-orange-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:bg-orange-700 flex items-center justify-center gap-2 text-sm sm:text-base"
							>
								End Smoke
							</button>
						</div>
					) : (
						""
					)}
				</div>

				<div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-4">
					{/* Editable Meat Type */}
					{isEditingMeatType ? (
						<div className="flex flex-wrap items-center gap-2">
							<select
								value={editedMeatType}
								onChange={(e) => setEditedMeatType(e.target.value)}
								className="px-3 py-1 border-2 border-orange-500 rounded focus:outline-none text-sm"
								autoFocus
							>
								{meatTypeOptions.map((opt) => (
									<option key={opt} value={opt}>{opt}</option>
								))}
							</select>
							<button
								onClick={handleSaveMeatType}
								disabled={savingField === "meatType"}
								className="bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700 text-xs disabled:opacity-50"
							>
								{savingField === "meatType" ? "..." : "Save"}
							</button>
							<button
								onClick={() => handleCancelEdit("meatType")}
								disabled={savingField === "meatType"}
								className="bg-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-400 text-xs disabled:opacity-50"
							>
								Cancel
							</button>
						</div>
					) : (
						<div className="flex items-center gap-1 group">
							<span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-medium">
								{session.meatType || "N/A"}
							</span>
							<button
								onClick={() => setIsEditingMeatType(true)}
								className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-orange-600 text-xs"
							>
								✏️
							</button>
						</div>
					)}

					<span>Duration: {calculateDuration()}</span>

					{/* Weight */}
					{isEditingWeight ? (
						<div className="flex items-center gap-2">
							<input
								type="text"
								value={editedWeight}
								onChange={(e) => setEditedWeight(e.target.value)}
								className="px-3 py-1 border-2 border-orange-500 rounded focus:outline-none text-sm w-28"
								placeholder="e.g. 12 lbs"
								autoFocus
							/>
							<button
								onClick={handleSaveWeight}
								disabled={savingField === "weight"}
								className="bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700 text-xs disabled:opacity-50"
							>
								{savingField === "weight" ? "..." : "Save"}
							</button>
							<button
								onClick={() => handleCancelEdit("weight")}
								disabled={savingField === "weight"}
								className="bg-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-400 text-xs disabled:opacity-50"
							>
								Cancel
							</button>
						</div>
					) : (
						<div className="flex items-center gap-1 group">
							<span className="text-gray-600">
								{session.weight ? `Weight: ${session.weight}` : ""}
							</span>
							<button
								onClick={() => setIsEditingWeight(true)}
								className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-orange-600 text-xs"
							>
								{session.weight ? "✏️" : "+ Weight"}
							</button>
						</div>
					)}
				</div>

				<div className="grid md:grid-cols-2 gap-4 mb-4">
					<div>
						<p className="text-sm text-gray-500">Started</p>
						<p className="text-lg font-semibold text-gray-800">
							{formatDate(session.startTime)}
						</p>
					</div>
					{session.endTime !== null ? (
						<div>
							<p className="text-sm text-gray-500">Ended</p>
							<p className="text-lg font-semibold text-gray-800">
								{formatDate(session.endTime)}
							</p>
						</div>
					) : (
						""
					)}
				</div>

				{/* Editable Notes Section */}
				<div className="mt-4 p-4 bg-gray-50 rounded-lg">
					<div className="flex justify-between items-center mb-2">
						<p className="text-sm text-gray-500 font-medium">Notes</p>
						{!isEditingNotes && (
							<button
								onClick={() => setIsEditingNotes(true)}
								className="text-sm text-orange-600 hover:text-orange-700 font-medium"
							>
								Edit
							</button>
						)}
					</div>

					{isEditingNotes ? (
						<div>
							<textarea
								value={editedNotes}
								onChange={(e) => setEditedNotes(e.target.value)}
								className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
								rows="4"
								placeholder="Add notes about this smoke session..."
							/>
							<div className="flex gap-2 mt-2">
								<button
									onClick={handleSaveNotes}
									disabled={savingField === "notes"}
									className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50"
								>
									{savingField === "notes" ? "Saving..." : "Save"}
								</button>
								<button
									onClick={() => handleCancelEdit("notes")}
									disabled={savingField === "notes"}
									className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 disabled:opacity-50"
								>
									Cancel
								</button>
							</div>
						</div>
					) : (
						<p className="text-gray-700 italic whitespace-pre-wrap">
							{session.notes || "No notes yet. Click Edit to add notes."}
						</p>
					)}
				</div>

				{/* Recipe URL Section */}
				<div className="mt-4 p-4 bg-gray-50 rounded-lg">
					<div className="flex justify-between items-center mb-2">
						<p className="text-sm text-gray-500 font-medium">Recipe</p>
						{!isEditingRecipeUrl && (
							<button
								onClick={() => setIsEditingRecipeUrl(true)}
								className="text-sm text-orange-600 hover:text-orange-700 font-medium"
							>
								Edit
							</button>
						)}
					</div>

					{isEditingRecipeUrl ? (
						<div>
							<input
								type="url"
								value={editedRecipeUrl}
								onChange={(e) => setEditedRecipeUrl(e.target.value)}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
								placeholder="https://example.com/recipe"
							/>
							<div className="flex gap-2 mt-2">
								<button
									onClick={handleSaveRecipeUrl}
									disabled={savingField === "recipeUrl"}
									className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50 text-sm"
								>
									{savingField === "recipeUrl" ? "Saving..." : "Save"}
								</button>
								<button
									onClick={() => handleCancelEdit("recipeUrl")}
									disabled={savingField === "recipeUrl"}
									className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 disabled:opacity-50 text-sm"
								>
									Cancel
								</button>
							</div>
						</div>
					) : session.recipeUrl ? (
						<a
							href={session.recipeUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-orange-600 hover:text-orange-700 underline text-sm break-all"
						>
							{session.recipeUrl}
						</a>
					) : (
						<p className="text-gray-700 italic text-sm">
							No recipe link. Click Edit to add one.
						</p>
					)}
				</div>

				{/* Spices Section */}
				<div className="mt-4 p-4 bg-gray-50 rounded-lg">
					<div className="flex justify-between items-center mb-2">
						<p className="text-sm text-gray-500 font-medium">Spices / Rub</p>
						{!isEditingSpices && (
							<button
								onClick={() => setIsEditingSpices(true)}
								className="text-sm text-orange-600 hover:text-orange-700 font-medium"
							>
								Edit
							</button>
						)}
					</div>

					{spicesList.length > 0 && (
						<div className="flex flex-wrap gap-2 mb-2">
							{spicesList.map((spice) => (
								<span
									key={spice}
									className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium"
								>
									{spice}
									{isEditingSpices && (
										<button
											onClick={() => handleRemoveSpice(spice)}
											className="text-amber-600 hover:text-red-600 ml-0.5"
										>
											×
										</button>
									)}
								</span>
							))}
						</div>
					)}

					{isEditingSpices ? (
						<div>
							<div className="flex gap-2">
								<input
									type="text"
									value={newSpice}
									onChange={(e) => setNewSpice(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleAddSpice();
										}
									}}
									className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
									placeholder="Type a spice and press Enter..."
									autoFocus
								/>
								<button
									onClick={() => handleAddSpice()}
									disabled={!newSpice.trim()}
									className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm"
								>
									Add
								</button>
							</div>
							{savedSpices.filter((s) => !spicesList.includes(s)).length > 0 && (
								<div className="mt-2">
									<p className="text-xs text-gray-500 mb-1">Saved spices — click to add:</p>
									<div className="flex flex-wrap gap-2">
										{savedSpices
											.filter((s) => !spicesList.includes(s))
											.map((spice) => (
												<button
													key={spice}
													type="button"
													onClick={() => handleAddSpice(spice)}
													className="bg-gray-100 text-gray-700 hover:bg-amber-100 hover:text-amber-800 px-3 py-1 rounded-full text-sm border border-gray-200"
												>
													+ {spice}
												</button>
											))}
									</div>
								</div>
							)}
							<button
								onClick={() => {
									setIsEditingSpices(false);
									setNewSpice("");
								}}
								className="text-sm text-gray-500 hover:text-gray-700 mt-2"
							>
								Done
							</button>
						</div>
					) : spicesList.length === 0 ? (
						<p className="text-gray-700 italic text-sm">
							No spices listed. Click Edit to add.
						</p>
					) : null}
				</div>

				{/* Photos Section */}
				<div className="mt-4 p-4 bg-gray-50 rounded-lg">
					<div className="flex justify-between items-center mb-3">
						<p className="text-sm text-gray-500 font-medium">Photos</p>
						<label className="text-sm text-orange-600 hover:text-orange-700 font-medium cursor-pointer">
							{uploadingPhoto ? "Uploading..." : "Add Photo"}
							<input
								type="file"
								accept="image/*"
								capture="environment"
								onChange={handlePhotoUpload}
								disabled={uploadingPhoto}
								className="hidden"
							/>
						</label>
					</div>

					{photos.length > 0 ? (
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
							{photos.map((photo) => (
								<div key={photo.filename} className="relative group">
									<a href={photo.url} target="_blank" rel="noopener noreferrer">
										<img
											src={photo.url}
											alt="Session photo"
											className="w-full h-32 sm:h-40 object-cover rounded-lg"
										/>
									</a>
									<button
										onClick={() => handleDeletePhoto(photo.filename)}
										className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
										title="Delete photo"
									>
										×
									</button>
								</div>
							))}
						</div>
					) : (
						<p className="text-gray-700 italic text-sm">
							No photos yet. Tap "Add Photo" to upload.
						</p>
					)}
				</div>
			</div>

			{/* Current Temperatures Card */}
			{currentTemps && (
				<div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
					<div className="flex justify-between items-center mb-4">
						<h3 className="text-lg sm:text-xl font-bold text-gray-800">
							{isActiveSession() ? "Current Temperatures" : "Final Temperatures"}
						</h3>
						<span className="text-xs text-gray-400">
							{formatTime(new Date(currentTemps.time))}
						</span>
					</div>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
						{Object.entries(probeColors)
							.filter(([probe]) => !hiddenProbes.has(probe))
							.map(([probe, color]) => {
							const value = currentTemps[probe];
							return (
								<div
									key={probe}
									className="rounded-lg p-3 sm:p-4 text-center relative group"
									style={{ backgroundColor: `${color}10`, borderLeft: `4px solid ${color}` }}
								>
									{editingProbeName === probe ? (
										<div className="flex items-center gap-1 mb-1">
											<input
												type="text"
												value={editedProbeName}
												onChange={(e) => setEditedProbeName(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter") handleSaveProbeName(probe);
													if (e.key === "Escape") setEditingProbeName(null);
												}}
												className="w-full px-1 py-0.5 text-xs border border-orange-500 rounded focus:outline-none text-center"
												autoFocus
											/>
										</div>
									) : (
										<p
											className="text-xs sm:text-sm font-medium text-gray-600 mb-1 cursor-pointer hover:text-orange-600"
											onClick={() => {
												setEditingProbeName(probe);
												setEditedProbeName(customProbeNames[probe] || probeNames[probe]);
											}}
											title="Click to rename"
										>
											{getProbeDisplayName(probe)}
										</p>
									)}
									<p
										className="text-2xl sm:text-3xl font-bold"
										style={{ color }}
									>
										{value !== undefined ? `${value}°F` : "—"}
									</p>
									<button
										onClick={() => toggleProbeHidden(probe)}
										className="absolute top-1 right-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
										title="Hide this probe"
									>
										<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							);
						})}
					</div>
					{hiddenProbes.size > 0 && (
						<button
							onClick={() => {
								setHiddenProbes(new Set());
								saveProbeSettings(new Set(), customProbeNames);
							}}
							className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-3"
						>
							Show {hiddenProbes.size} hidden probe{hiddenProbes.size > 1 ? 's' : ''}
						</button>
					)}
				</div>
			)}

			{/* Setpoint History Section */}
			<div className="mt-4 p-4 bg-blue-50 rounded-lg">
				<button
					onClick={() => setShowSetpoints(!showSetpoints)}
					className="flex items-center justify-between w-full text-left"
				>
					<h3 className="text-sm font-medium text-gray-700">
						Temperature Setpoint History
					</h3>
					<svg
						className={`w-4 h-4 text-gray-500 transition-transform ${showSetpoints ? 'rotate-180' : ''}`}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{showSetpoints && (
					<div className="mt-3">
						{loadingSetpoints ? (
							<p className="text-sm text-gray-500">Loading setpoints...</p>
						) : setpoints.length === 0 ? (
							<p className="text-sm text-gray-500 italic">
								No setpoint data available
							</p>
						) : (
							<div className="space-y-2">
								{setpoints.filter((sp) => !hiddenSetpoints.has(sp.time)).map((setpoint, _filteredIndex, filteredArr) => {
									const setpointTime = new Date(setpoint.time);
									const isFirst = setpoints[0] === setpoint;
									// Find next visible setpoint for duration calc
									const nextVisible = filteredArr[_filteredIndex + 1];
									const endTime = nextVisible
										? new Date(nextVisible.time)
										: new Date(session.endTime);

									const durationMs = endTime - setpointTime;
									const hours = Math.floor(durationMs / (1000 * 60 * 60));
									const minutes = Math.floor(
										(durationMs % (1000 * 60 * 60)) / (1000 * 60)
									);

									return (
										<div
											key={setpoint.time}
											className="flex items-center justify-between p-3 bg-white rounded border-l-4 border-blue-500"
										>
											<div>
												<div className="flex items-center gap-2">
													<span className="text-xl sm:text-2xl font-bold text-blue-600">
														{setpoint.value}°F
													</span>
													{isFirst && (
														<span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
															Initial
														</span>
													)}
													{!nextVisible && (
														<span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
															Current
														</span>
													)}
												</div>
												<div className="text-xs text-gray-500 mt-1">
													Set at {formatDate(setpoint.time)}
												</div>
											</div>
											<div className="flex items-center gap-3">
												<div className="text-right">
													<div className="text-sm font-semibold text-gray-700">
														{hours > 0 ? `${hours}h ` : ""}
														{minutes}m
													</div>
													<div className="text-xs text-gray-500">duration</div>
												</div>
												<button
													onClick={() => {
														const newSet = new Set([...hiddenSetpoints, setpoint.time]);
														setHiddenSetpoints(newSet);
														saveHiddenSetpoints(newSet);
													}}
													className="text-gray-300 hover:text-red-500 transition-colors"
													title="Hide this setpoint"
												>
													<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
													</svg>
												</button>
											</div>
										</div>
									);
								})}
								{hiddenSetpoints.size > 0 && (
									<button
										onClick={() => {
											setHiddenSetpoints(new Set());
											saveHiddenSetpoints(new Set());
										}}
										className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1"
									>
										Show {hiddenSetpoints.size} hidden setpoint{hiddenSetpoints.size > 1 ? 's' : ''}
									</button>
								)}
							</div>
						)}
					</div>
				)}
			</div>

		{/* Pause History Section */}
		{pauses.length > 0 && (
			<div className="mt-4 p-4 bg-yellow-50 rounded-lg">
				<h3 className="text-sm font-medium text-gray-700 mb-3">
					Pause History
				</h3>
				<div className="space-y-2">
					{pauses.map((event, index) => {
						const isPauseEvent = event.type === "pause";
						const nextEvent = pauses[index + 1];
						let durationLabel = null;
						if (isPauseEvent && nextEvent?.type === "resume") {
							const ms = new Date(nextEvent.time) - new Date(event.time);
							const h = Math.floor(ms / (1000 * 60 * 60));
							const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
							durationLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;
						} else if (isPauseEvent && !nextEvent) {
							durationLabel = "ongoing";
						}
						const isEditing = editingPauseIndex === index;
						return (
							<div
								key={index}
								className={`flex items-center justify-between p-3 bg-white rounded border-l-4 ${
									isPauseEvent ? "border-yellow-400" : "border-green-400"
								}`}
							>
								<div className="flex-1 min-w-0">
									<span className={`text-sm font-semibold ${isPauseEvent ? "text-yellow-700" : "text-green-700"}`}>
										{isPauseEvent ? "Paused" : "Resumed"}
									</span>
									{isEditing ? (
										<div className="flex flex-wrap items-center gap-2 mt-1">
											<input
												type="datetime-local"
												value={editedPauseTime}
												onChange={(e) => setEditedPauseTime(e.target.value)}
												className="px-2 py-1 border-2 border-orange-500 rounded text-xs focus:outline-none"
												autoFocus
											/>
											<button
												onClick={() => handleSavePauseTime(index)}
												className="bg-orange-600 text-white px-2 py-1 rounded text-xs hover:bg-orange-700"
											>
												Save
											</button>
											<button
												onClick={() => setEditingPauseIndex(null)}
												className="bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-400"
											>
												Cancel
											</button>
										</div>
									) : (
										<div
											className="text-xs text-gray-500 mt-0.5 cursor-pointer hover:text-orange-600"
											onClick={() => {
												setEditingPauseIndex(index);
												setEditedPauseTime(toLocalDatetimeValue(event.time));
											}}
											title="Click to edit time"
										>
											{formatDate(event.time)}
										</div>
									)}
								</div>
								{durationLabel && !isEditing && (
									<div className="text-right ml-3">
										<div className="text-sm font-semibold text-gray-700">{durationLabel}</div>
										<div className="text-xs text-gray-500">off smoker</div>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		)}

			{loading ? (
				<div className="bg-white rounded-lg shadow-lg p-12 text-center">
					<div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
					<p className="mt-4 text-gray-600">Loading temperature data...</p>
				</div>
			) : error ? (
				<div className="bg-white rounded-lg shadow-lg p-8">
					<p className="text-red-600">{error}</p>
				</div>
			) : (
				<>
					<div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-6">
						<h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
							Temperature Over Time
						</h3>
						<ResponsiveContainer width="100%" height={400}>
							<LineChart data={temperatureData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis
									dataKey="time"
									type="number"
									domain={["dataMin", "dataMax"]}
									tickFormatter={(ts) => formatTime(new Date(ts))}
									angle={-45}
									textAnchor="end"
									height={80}
								/>
								<YAxis domain={[0, 'auto']} />
								<Tooltip
									labelFormatter={(ts) => formatTime(new Date(ts))}
									formatter={(value) => [`${value}°F`]}
								/>
								<Legend />
								{pauses.reduce((areas, event, index) => {
									if (event.type === "pause") {
										const resumeEvent = pauses[index + 1];
										const x1 = new Date(event.time).getTime();
										const x2 = resumeEvent?.type === "resume"
											? new Date(resumeEvent.time).getTime()
											: Date.now();
										areas.push(
											<ReferenceArea
												key={`pause-${index}`}
												x1={x1}
												x2={x2}
												fill="#fbbf24"
												fillOpacity={0.2}
												stroke="#f59e0b"
												strokeOpacity={0.4}
												label={{ value: "Paused", position: "insideTop", fill: "#b45309", fontSize: 11 }}
											/>
										);
									}
									return areas;
								}, [])}
								{Object.keys(probeColors)
									.filter((probe) => !hiddenProbes.has(probe))
									.map(
									(probe) =>
										temperatureData.some((d) => d[probe] !== undefined) && (
											<Line
												key={probe}
												type="monotone"
												dataKey={probe}
												stroke={probeColors[probe]}
												name={getProbeDisplayName(probe)}
												dot={false}
												strokeWidth={2}
											/>
										)
								)}
							</LineChart>
						</ResponsiveContainer>
					</div>

					{stats && (
						<div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
							<h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
								Temperature Statistics
							</h3>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
								{Object.entries(stats)
									.filter(([probe]) => !hiddenProbes.has(probe))
									.map(([probe, data]) => (
									<div key={probe} className="border rounded-lg p-4">
										<h4
											className="font-semibold text-gray-700 mb-3"
											style={{ color: probeColors[probe] }}
										>
											{getProbeDisplayName(probe)}
										</h4>
										<div className="space-y-2 text-sm">
											<div className="flex justify-between">
												<span className="text-gray-500">Avg:</span>
												<span className="font-medium">{data.avg}°F</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-500">Max:</span>
												<span className="font-medium">{data.max}°F</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-500">Min:</span>
												<span className="font-medium">{data.min}°F</span>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}

export default SessionDetail;
