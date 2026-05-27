export function parseWeightLbs(weightStr) {
	if (!weightStr) return null;
	const match = String(weightStr).match(/(\d+(?:\.\d+)?)/);
	if (!match) return null;
	const num = parseFloat(match[1]);
	return num > 0 ? num : null;
}

export function computeEstimate(pastSessions, meatType, plannedWeightLbs) {
	if (!meatType || !Array.isArray(pastSessions)) {
		return { sampleCount: 0, avgHrPerLb: null, estimatedDurationHours: null, method: 'none' };
	}

	const matches = pastSessions.filter(
		(s) => !s.hidden && s.meatType === meatType && s.endTime && s.startTime
	);

	if (matches.length === 0) {
		return { sampleCount: 0, avgHrPerLb: null, estimatedDurationHours: null, method: 'none' };
	}

	const weightedSamples = [];
	const durationSamples = [];
	for (const s of matches) {
		const durationMs = new Date(s.endTime) - new Date(s.startTime);
		if (durationMs <= 0) continue;
		const durationHours = durationMs / (1000 * 60 * 60);
		durationSamples.push(durationHours);
		const w = parseWeightLbs(s.weight);
		if (w) weightedSamples.push(durationHours / w);
	}

	if (weightedSamples.length > 0 && plannedWeightLbs) {
		const avgHrPerLb =
			weightedSamples.reduce((a, b) => a + b, 0) / weightedSamples.length;
		return {
			sampleCount: weightedSamples.length,
			avgHrPerLb,
			estimatedDurationHours: avgHrPerLb * plannedWeightLbs,
			method: 'weighted',
		};
	}

	if (durationSamples.length > 0) {
		const avg = durationSamples.reduce((a, b) => a + b, 0) / durationSamples.length;
		return {
			sampleCount: durationSamples.length,
			avgHrPerLb: null,
			estimatedDurationHours: avg,
			method: 'plain',
		};
	}

	return { sampleCount: 0, avgHrPerLb: null, estimatedDurationHours: null, method: 'none' };
}

export function formatHoursMinutes(hours) {
	if (hours == null || isNaN(hours)) return 'N/A';
	const totalMin = Math.max(0, Math.round(hours * 60));
	const h = Math.floor(totalMin / 60);
	const m = totalMin % 60;
	return `${h}h ${m}m`;
}

// Convert an ISO 8601 string (UTC, with Z) into the local datetime-local input format.
export function isoToLocalInput(iso) {
	if (!iso) return '';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '';
	const pad = (n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert a datetime-local input value (no timezone, interpreted as local) to an ISO string.
export function localInputToISO(localStr) {
	if (!localStr) return '';
	const d = new Date(localStr);
	if (isNaN(d.getTime())) return '';
	return d.toISOString();
}

// Build an array of time options at the given interval (minutes) covering 00:00..23:30.
// Each entry is { value: "HH:MM" (24-hour), label: "h:mm AM/PM" }.
export function buildTimeOptions(intervalMinutes = 30) {
	const out = [];
	for (let h = 0; h < 24; h++) {
		for (let m = 0; m < 60; m += intervalMinutes) {
			const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
			const period = h < 12 ? "AM" : "PM";
			const h12 = h % 12 === 0 ? 12 : h % 12;
			const label = `${h12}:${String(m).padStart(2, "0")} ${period}`;
			out.push({ value, label });
		}
	}
	return out;
}

// Round a "HH:MM" string up/nearest to the given interval. Returns one of the option values.
export function snapTimeToInterval(timeStr, intervalMinutes = 30) {
	if (!timeStr) return "";
	const [hStr, mStr] = timeStr.split(":");
	const h = parseInt(hStr, 10);
	const m = parseInt(mStr, 10);
	if (isNaN(h) || isNaN(m)) return "";
	const totalMin = h * 60 + Math.round(m / intervalMinutes) * intervalMinutes;
	const clamped = Math.min(totalMin, 23 * 60 + (60 - intervalMinutes));
	const newH = Math.floor(clamped / 60);
	const newM = clamped % 60;
	return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export function formatDateTime(iso) {
	if (!iso) return 'N/A';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return 'N/A';
	return d.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}
