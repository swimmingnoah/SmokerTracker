import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CONFIG, apiFetch } from "./config";
import {
	parseWeightLbs,
	computeEstimate,
	formatHoursMinutes,
	formatDateTime,
	isoToLocalInput,
	localInputToISO,
	buildTimeOptions,
	snapTimeToInterval,
} from "./planUtils";

const TIME_INTERVAL_MIN = 30;
const TIME_OPTIONS = buildTimeOptions(TIME_INTERVAL_MIN);

function PlanSession() {
	const navigate = useNavigate();
	const { id: editingId } = useParams();
	const isEditing = Boolean(editingId);

	const [name, setName] = useState("");
	const [meatType, setMeatType] = useState("");
	const [weight, setWeight] = useState("");
	const [recipeUrl, setRecipeUrl] = useState("");
	const [notes, setNotes] = useState("");
	const [spicesList, setSpicesList] = useState([]);
	const [newSpice, setNewSpice] = useState("");
	const [targetEndDate, setTargetEndDate] = useState("");
	const [targetEndTime, setTargetEndTime] = useState("");

	const [pastSessions, setPastSessions] = useState([]);
	const [meatTypeOptions, setMeatTypeOptions] = useState([]);
	const [savedSpices, setSavedSpices] = useState([]);

	const [saving, setSaving] = useState(false);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		(async () => {
			try {
				const [sessionsRes, meatRes, spicesRes] = await Promise.all([
					fetch(`${CONFIG.apiUrl}/sessions`),
					apiFetch(`${CONFIG.apiUrl}/meat-types`),
					apiFetch(`${CONFIG.apiUrl}/spices`),
				]);
				if (sessionsRes.ok) {
					const data = await sessionsRes.json();
					setPastSessions(data.sessions || []);
				}
				let meatTypes = [];
				if (meatRes.ok) {
					const data = await meatRes.json();
					meatTypes = data.meatTypes || [];
					setMeatTypeOptions(meatTypes);
				}
				if (spicesRes.ok) {
					const data = await spicesRes.json();
					setSavedSpices(data.spices || []);
				}

				if (isEditing) {
					const planRes = await apiFetch(`${CONFIG.apiUrl}/plans`);
					if (planRes.ok) {
						const data = await planRes.json();
						const plan = (data.plans || []).find((p) => p.id === editingId);
						if (plan) {
							setName(plan.name || "");
							setMeatType(plan.meatType || "");
							setWeight(plan.weight || "");
							setRecipeUrl(plan.recipeUrl || "");
							setNotes(plan.notes || "");
							setSpicesList(
								(plan.spices || "")
									.split(",")
									.map((s) => s.trim())
									.filter(Boolean)
							);
							const localStr = isoToLocalInput(plan.targetEndTime);
							if (localStr) {
								const [datePart, timePart] = localStr.split("T");
								setTargetEndDate(datePart || "");
								setTargetEndTime(snapTimeToInterval(timePart, TIME_INTERVAL_MIN));
							}
						}
					}
				} else if (meatTypes.length > 0) {
					setMeatType(meatTypes[0]);
				}
			} catch (err) {
				console.error("Error loading plan data:", err);
			} finally {
				setLoaded(true);
			}
		})();
	}, [editingId, isEditing]);

	const plannedWeightLbs = useMemo(() => parseWeightLbs(weight), [weight]);
	const estimate = useMemo(
		() => computeEstimate(pastSessions, meatType, plannedWeightLbs),
		[pastSessions, meatType, plannedWeightLbs]
	);

	const targetEndLocal = useMemo(() => {
		if (!targetEndDate || !targetEndTime) return "";
		return `${targetEndDate}T${targetEndTime}`;
	}, [targetEndDate, targetEndTime]);

	const suggestedStartISO = useMemo(() => {
		if (!targetEndLocal || estimate.estimatedDurationHours == null) return "";
		const end = new Date(targetEndLocal);
		if (isNaN(end.getTime())) return "";
		const start = new Date(
			end.getTime() - estimate.estimatedDurationHours * 60 * 60 * 1000
		);
		return start.toISOString();
	}, [targetEndLocal, estimate.estimatedDurationHours]);

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

	const addSpice = (raw) => {
		const spice = raw.trim().replace(/,/g, "");
		if (!spice || spicesList.includes(spice)) return;
		setSpicesList([...spicesList, spice]);
		setNewSpice("");
		persistSpice(spice);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!name.trim()) {
			alert("Please enter a plan name");
			return;
		}

		try {
			setSaving(true);
			const body = {
				name: name.trim(),
				meatType: meatType.trim(),
				weight: weight.trim(),
				recipeUrl: recipeUrl.trim(),
				spices: spicesList.join(", "),
				notes: notes.trim(),
				targetEndTime: targetEndLocal ? localInputToISO(targetEndLocal) : "",
			};

			const url = isEditing
				? `${CONFIG.apiUrl}/plans/${encodeURIComponent(editingId)}`
				: `${CONFIG.apiUrl}/plans`;
			const response = await apiFetch(url, {
				method: isEditing ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			navigate("/");
		} catch (err) {
			console.error("Error saving plan:", err);
			alert("Failed to save plan: " + err.message);
			setSaving(false);
		}
	};

	if (!loaded) {
		return (
			<div className="flex items-center justify-center py-20">
				<div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
			</div>
		);
	}

	const estimateLabel = (() => {
		if (estimate.method === "weighted") {
			return `Based on ${estimate.sampleCount} past smoke${estimate.sampleCount === 1 ? "" : "s"} of ${meatType} with recorded weight — avg ${estimate.avgHrPerLb.toFixed(2)} h/lb → ~${formatHoursMinutes(estimate.estimatedDurationHours)}`;
		}
		if (estimate.method === "plain") {
			return `Based on ${estimate.sampleCount} past smoke${estimate.sampleCount === 1 ? "" : "s"} of ${meatType} (no recorded weights) — average duration ~${formatHoursMinutes(estimate.estimatedDurationHours)}`;
		}
		if (meatType) {
			return `No completed past smokes of ${meatType} yet — enter a target end time to save the plan.`;
		}
		return "";
	})();

	return (
		<div className="max-w-2xl mx-auto">
			<div className="mb-6">
				<button
					onClick={() => navigate("/")}
					className="flex items-center text-orange-600 hover:text-orange-700 font-medium"
				>
					← Back to Sessions
				</button>
			</div>
			<div className="bg-white rounded-lg shadow-lg p-8">
				<h2 className="text-2xl font-bold text-gray-800 mb-6">
					{isEditing ? "Edit Plan" : "Plan a Smoke"}
				</h2>

				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Plan Name *
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							placeholder="e.g., Sunday Brisket"
							required
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Meat Type
						</label>
						{meatTypeOptions.length > 0 ? (
							<select
								value={meatType}
								onChange={(e) => setMeatType(e.target.value)}
								className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							>
								{meatTypeOptions.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						) : (
							<p className="text-sm text-gray-500 italic">
								No meat types configured yet.
							</p>
						)}
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Weight
						</label>
						<input
							type="text"
							value={weight}
							onChange={(e) => setWeight(e.target.value)}
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							placeholder="e.g. 12 lbs"
						/>
						{weight && plannedWeightLbs == null && (
							<p className="mt-1 text-xs text-amber-600">
								Couldn't read a number from "{weight}" — estimate will fall back to a plain average.
							</p>
						)}
					</div>

					{/* Estimate panel */}
					{estimateLabel && (
						<div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
							{estimateLabel}
						</div>
					)}

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Target End Time
						</label>
						<div className="flex flex-col sm:flex-row gap-2">
							<input
								type="date"
								value={targetEndDate}
								onChange={(e) => setTargetEndDate(e.target.value)}
								className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							/>
							<select
								value={targetEndTime}
								onChange={(e) => setTargetEndTime(e.target.value)}
								className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
							>
								<option value="">Select time...</option>
								{TIME_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</div>
						{suggestedStartISO && (
							<p className="mt-2 text-sm text-gray-700">
								Suggested start:{" "}
								<span className="font-semibold text-orange-700">
									{formatDateTime(suggestedStartISO)}
								</span>
							</p>
						)}
						{targetEndLocal && !suggestedStartISO && estimate.method === "none" && (
							<p className="mt-2 text-sm text-gray-500 italic">
								No historical data — can't suggest a start time yet.
							</p>
						)}
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Recipe URL (Optional)
						</label>
						<input
							type="url"
							value={recipeUrl}
							onChange={(e) => setRecipeUrl(e.target.value)}
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							placeholder="https://example.com/recipe"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Spices / Rub (Optional)
						</label>
						{spicesList.length > 0 && (
							<div className="flex flex-wrap gap-2 mb-2">
								{spicesList.map((spice) => (
									<span
										key={spice}
										className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium"
									>
										{spice}
										<button
											type="button"
											onClick={() => setSpicesList(spicesList.filter((s) => s !== spice))}
											className="text-amber-600 hover:text-red-600 ml-0.5"
										>
											×
										</button>
									</span>
								))}
							</div>
						)}
						<div className="flex gap-2">
							<input
								type="text"
								value={newSpice}
								onChange={(e) => setNewSpice(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										addSpice(newSpice);
									}
								}}
								className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
								placeholder="Type a spice and press Enter..."
							/>
							<button
								type="button"
								onClick={() => addSpice(newSpice)}
								disabled={!newSpice.trim()}
								className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
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
												onClick={() => addSpice(spice)}
												className="bg-gray-100 text-gray-700 hover:bg-amber-100 hover:text-amber-800 px-3 py-1 rounded-full text-sm border border-gray-200"
											>
												+ {spice}
											</button>
										))}
								</div>
							</div>
						)}
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Notes (Optional)
						</label>
						<textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							rows="4"
							placeholder="Any plan notes..."
						/>
					</div>

					<div className="flex gap-4">
						<button
							type="submit"
							disabled={saving}
							className="flex-1 bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{saving ? "Saving..." : isEditing ? "Update Plan" : "Save Plan"}
						</button>
						<button
							type="button"
							onClick={() => navigate("/")}
							disabled={saving}
							className="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-400 disabled:opacity-50"
						>
							Cancel
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default PlanSession;
