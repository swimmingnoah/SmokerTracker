import { useState, useEffect } from "react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import { CONFIG } from "./config";

function SessionDetail({ session, onBack, onDelete }) {
	const [temperatureData, setTemperatureData] = useState([]);
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Editing states
	const [isEditingName, setIsEditingName] = useState(false);
	const [isEditingMeatType, setIsEditingMeatType] = useState(false);
	const [isEditingNotes, setIsEditingNotes] = useState(false);
	const [editedName, setEditedName] = useState(session.name);
	const [editedMeatType, setEditedMeatType] = useState(session.meatType);
	const [editedNotes, setEditedNotes] = useState(session.notes || "");
	const [savingField, setSavingField] = useState(null);
	const [setpoints, setSetpoints] = useState([]);
	const [loadingSetpoints, setLoadingSetpoints] = useState(false);

	useEffect(() => {
		fetchTemperatureData();
	}, [session]);

	useEffect(() => {
		fetchTemperatureData();
		fetchSetpoints();
	}, [session]);

	// Also refresh setpoints every 30 seconds
	useEffect(() => {
		const interval = setInterval(() => {
			fetchTemperatureData();
			fetchSetpoints();
		}, 30000);

		return () => clearInterval(interval);
	}, [session]);

	const fetchSetpoints = async () => {
		try {
			setLoadingSetpoints(true);

			const encodedSessionId = encodeURIComponent(session.id);
			const response = await fetch(
				`${CONFIG.apiUrl}/sessions/${encodedSessionId}/setpoints`
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

			// Update local session object
			session.endTime = data.endTime;

			alert("Session ended successfully!");

			// Optionally go back to session list
			// onBack();
		} catch (err) {
			console.error("Error ending session:", err);
			alert("Failed to end session: " + err.message);
		}
	};

	const fetchTemperatureData = async () => {
		try {
			setLoading(true);
			setError(null);

			const sessionEndTime = new Date(session.endTime);
			const sessionStartTime = new Date(session.startTime);
			const isActiveSession =
				Math.abs(sessionEndTime - sessionStartTime) < 60000;

			const endTime = isActiveSession
				? new Date().toISOString()
				: new Date(session.endTime).toISOString();

			const startTime = new Date(session.startTime).toISOString();

			console.log("Fetching temps from", startTime, "to", endTime);

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

			const data = result.data.map((item) => ({
				...item,
				time: new Date(item.time),
			}));

			console.log("Temperature data points:", data.length);
			setTemperatureData(data);
			calculateStats(data);
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

	const calculateDuration = () => {
		if (!session.startTime) return "N/A";
		const startTime = new Date(session.startTime);
		var endTime = new Date();
		if (session.endTime !== null) {
			endTime = new Date(session.endTime);
		}
		const diffMs = endTime - startTime;
		const hours = Math.floor(diffMs / (1000 * 60 * 60));
		const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
		return `${hours}h ${minutes}m`;
	};

	const handleDelete = () => {
		onDelete(session.id);
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

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<button
					onClick={onBack}
					className="flex items-center text-orange-600 hover:text-orange-700 font-medium"
				>
					← Back to Sessions
				</button>
			</div>

			<div className="bg-white rounded-lg shadow-lg p-6 mb-6">
				{/* Editable Name */}
				<div className="flex justify-between items-center mb-2">
					{isEditingName ? (
						<div className="flex items-center gap-2">
							<input
								type="text"
								value={editedName}
								onChange={(e) => setEditedName(e.target.value)}
								className="flex-1 text-3xl font-bold text-gray-800 px-2 py-1 border-2 border-orange-500 rounded focus:outline-none"
								autoFocus
							/>
							<button
								onClick={handleSaveName}
								disabled={savingField === "name"}
								className="bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 text-sm disabled:opacity-50"
							>
								{savingField === "name" ? "Saving..." : "Save"}
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
							<h2 className="text-3xl font-bold text-gray-800">
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
						<button
							onClick={(e) => handleEndSession(e, session.id)}
							className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 flex items-center gap-2"
						>
							End Smoke
						</button>
					) : (
						""
					)}
				</div>

				<div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
					{/* Editable Meat Type */}
					{isEditingMeatType ? (
						<div className="flex items-center gap-2">
							<input
								type="text"
								value={editedMeatType}
								onChange={(e) => setEditedMeatType(e.target.value)}
								className="px-3 py-1 border-2 border-orange-500 rounded focus:outline-none"
								placeholder="Meat type"
								autoFocus
							/>
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

					<span>⏱️ Duration: {calculateDuration()}</span>
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
								✏️ Edit
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
			</div>

			{/* Setpoint History Section */}
			<div className="mt-4 p-4 bg-blue-50 rounded-lg">
				<h3 className="text-sm font-medium text-gray-700 mb-3">
					🎯 Temperature Setpoint History
				</h3>

				{loadingSetpoints ? (
					<p className="text-sm text-gray-500">Loading setpoints...</p>
				) : setpoints.length === 0 ? (
					<p className="text-sm text-gray-500 italic">
						No setpoint data available
					</p>
				) : (
					<div className="space-y-2">
						{setpoints.map((setpoint, index) => {
							const setpointTime = new Date(setpoint.time);
							const nextSetpoint = setpoints[index + 1];
							const endTime = nextSetpoint
								? new Date(nextSetpoint.time)
								: new Date(session.endTime);

							const durationMs = endTime - setpointTime;
							const hours = Math.floor(durationMs / (1000 * 60 * 60));
							const minutes = Math.floor(
								(durationMs % (1000 * 60 * 60)) / (1000 * 60)
							);

							return (
								<div
									key={index}
									className="flex items-center justify-between p-3 bg-white rounded border-l-4 border-blue-500"
								>
									<div>
										<div className="flex items-center gap-2">
											<span className="text-2xl font-bold text-blue-600">
												{setpoint.value}°F
											</span>
											{index === 0 && (
												<span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
													Initial
												</span>
											)}
											{index === setpoints.length - 1 && !nextSetpoint && (
												<span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
													Current
												</span>
											)}
										</div>
										<div className="text-xs text-gray-500 mt-1">
											Set at {formatDate(setpoint.time)}
										</div>
									</div>
									<div className="text-right">
										<div className="text-sm font-semibold text-gray-700">
											{hours > 0 ? `${hours}h ` : ""}
											{minutes}m
										</div>
										<div className="text-xs text-gray-500">duration</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

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
					<div className="bg-white rounded-lg shadow-lg p-6 mb-6">
						<h3 className="text-xl font-bold text-gray-800 mb-4">
							Temperature Over Time
						</h3>
						<ResponsiveContainer width="100%" height={400}>
							<LineChart data={temperatureData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis
									dataKey="time"
									tickFormatter={formatTime}
									angle={-45}
									textAnchor="end"
									height={80}
								/>
								<YAxis />
								<Tooltip
									labelFormatter={(value) => formatTime(new Date(value))}
									formatter={(value) => [`${value}°F`]}
								/>
								<Legend />
								{Object.keys(probeColors).map(
									(probe) =>
										temperatureData.some((d) => d[probe] !== undefined) && (
											<Line
												key={probe}
												type="monotone"
												dataKey={probe}
												stroke={probeColors[probe]}
												name={probeNames[probe]}
												dot={false}
												strokeWidth={2}
											/>
										)
								)}
							</LineChart>
						</ResponsiveContainer>
					</div>

					{stats && (
						<div className="bg-white rounded-lg shadow-lg p-6">
							<h3 className="text-xl font-bold text-gray-800 mb-4">
								Temperature Statistics
							</h3>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								{Object.entries(stats).map(([probe, data]) => (
									<div key={probe} className="border rounded-lg p-4">
										<h4
											className="font-semibold text-gray-700 mb-3"
											style={{ color: probeColors[probe] }}
										>
											{probeNames[probe]}
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
