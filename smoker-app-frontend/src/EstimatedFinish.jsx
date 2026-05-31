import { computeFinishEstimate, formatHoursMinutes } from "./planUtils";

// Shared "estimated finish" readout used on the session detail page and the
// homepage "Now Cooking" cards. Pure presentation over computeFinishEstimate:
// pass the average duration (hours), a sample count for the baseline label,
// the elapsed cook time (ms), and the meat type.
//
// The caller decides what "elapsed" means: the detail page passes net
// (pause-adjusted) cook time; the homepage passes wall-clock elapsed to match
// the Elapsed figure shown on the same card.
export default function EstimatedFinish({
	estimatedDurationHours,
	sampleCount = 0,
	elapsedMs,
	meatType,
	label = "Estimated finish",
}) {
	const fin =
		estimatedDurationHours != null
			? computeFinishEstimate(estimatedDurationHours, elapsedMs, Date.now())
			: null;

	return (
		<div>
			<div className="flex justify-between items-center mb-2">
				<p className="text-sm text-neutral-500 font-medium">{label}</p>
				{sampleCount > 0 && estimatedDurationHours != null && (
					<p className="text-xs text-neutral-600">
						Avg {meatType}: {formatHoursMinutes(estimatedDurationHours)} ·{" "}
						{sampleCount} cook{sampleCount === 1 ? "" : "s"}
					</p>
				)}
			</div>

			{fin ? (
				<div>
					<div className="flex justify-between items-baseline mb-2">
						<p className="text-lg font-semibold text-white">
							{fin.overrun
								? "Est. done — running long"
								: `Est. done ~${fin.finishDate.toLocaleTimeString("en-US", {
										hour: "numeric",
										minute: "2-digit",
								  })}`}
						</p>
						<p className="text-sm text-neutral-400">
							{fin.overrun
								? "running long"
								: `~${formatHoursMinutes(
										fin.remainingMs / (60 * 60 * 1000)
								  )} left`}
						</p>
					</div>
					<div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
						<div
							className={`h-full rounded-full ${
								fin.overrun ? "bg-red-500" : "bg-orange-500"
							}`}
							style={{ width: `${fin.progressPct}%` }}
						/>
					</div>
					<p className="text-xs text-neutral-600 mt-1">
						{Math.round(fin.progressPct)}% of average
					</p>
				</div>
			) : (
				<p className="text-neutral-500 italic">
					Not enough {meatType} cooks yet to estimate.
				</p>
			)}
		</div>
	);
}
