import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CONFIG, apiFetch } from './config';
import {
	parseWeightLbs,
	computeEstimate,
	formatHoursMinutes,
	formatDateTime,
} from './planUtils';
import EstimatedFinish from './EstimatedFinish';

// Stable color per meat type so cards stay visually consistent across reloads.
const MEAT_PALETTE = [
	{ pill: 'text-orange-300 bg-orange-500/15 border-orange-500/30' },
	{ pill: 'text-amber-200 bg-amber-400/15 border-amber-400/30' },
	{ pill: 'text-rose-300 bg-rose-500/15 border-rose-500/30' },
	{ pill: 'text-sky-200 bg-sky-400/15 border-sky-400/30' },
	{ pill: 'text-violet-200 bg-violet-400/15 border-violet-400/30' },
	{ pill: 'text-emerald-200 bg-emerald-400/15 border-emerald-400/30' },
	{ pill: 'text-cyan-200 bg-cyan-400/15 border-cyan-400/30' },
];

function meatColor(meatType) {
	if (!meatType) return MEAT_PALETTE[0];
	let h = 0;
	for (let i = 0; i < meatType.length; i++) h = (h * 31 + meatType.charCodeAt(i)) >>> 0;
	return MEAT_PALETTE[h % MEAT_PALETTE.length];
}

function SessionList() {
	const navigate = useNavigate();
	const [sessions, setSessions] = useState([]);
	const [plans, setPlans] = useState([]);
	const [stats, setStats] = useState({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showHidden, setShowHidden] = useState(false);
	const [meatTypeFilter, setMeatTypeFilter] = useState('All');
	const [meatTypes, setMeatTypes] = useState([]);
	const [startingPlanId, setStartingPlanId] = useState(null);

	useEffect(() => {
		fetchSessions();
		fetchMeatTypes();
		fetchPlans();
		fetchStats();
	}, [showHidden]);

	const fetchSessions = async () => {
		try {
			setLoading(true);
			setError(null);
			const url = showHidden
				? `${CONFIG.apiUrl}/sessions?include_hidden=true`
				: `${CONFIG.apiUrl}/sessions`;
			const response = await fetch(url);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const data = await response.json();
			setSessions(data.sessions);
			setLoading(false);
		} catch (err) {
			setError('Failed to load sessions: ' + err.message);
			setLoading(false);
		}
	};

	const fetchMeatTypes = async () => {
		try {
			const response = await apiFetch(`${CONFIG.apiUrl}/meat-types`);
			if (!response.ok) return;
			const data = await response.json();
			setMeatTypes(data.meatTypes);
		} catch (err) {
			console.error('Error fetching meat types:', err);
		}
	};

	const fetchPlans = async () => {
		try {
			const response = await apiFetch(`${CONFIG.apiUrl}/plans`);
			if (!response.ok) return;
			const data = await response.json();
			setPlans(data.plans || []);
		} catch (err) {
			console.error('Error fetching plans:', err);
		}
	};

	const fetchStats = async () => {
		try {
			const response = await apiFetch(`${CONFIG.apiUrl}/sessions/stats`);
			if (!response.ok) return;
			const data = await response.json();
			setStats(data.stats || {});
		} catch (err) {
			console.error('Error fetching stats:', err);
		}
	};

	const handleDeletePlan = async (e, planId) => {
		e.stopPropagation();
		const confirmed = window.confirm('Delete this plan?');
		if (!confirmed) return;
		try {
			const response = await apiFetch(`${CONFIG.apiUrl}/plans/${encodeURIComponent(planId)}`, {
				method: 'DELETE',
			});
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			fetchPlans();
		} catch (err) {
			alert('Failed to delete plan: ' + err.message);
		}
	};

	const handleStartPlan = async (e, planId) => {
		e.stopPropagation();
		try {
			setStartingPlanId(planId);
			const response = await apiFetch(`${CONFIG.apiUrl}/plans/${encodeURIComponent(planId)}/start`, {
				method: 'POST',
			});
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const data = await response.json();
			navigate(`/sessions/${encodeURIComponent(data.session.id)}`, {
				state: { session: data.session },
			});
		} catch (err) {
			alert('Failed to start plan: ' + err.message);
			setStartingPlanId(null);
		}
	};

	const handleDelete = async (sessionId) => {
		const confirmed = window.confirm(
			'Are you sure you want to delete this session? This will hide it from view (temperature data remains in InfluxDB).'
		);
		if (!confirmed) return;

		try {
			const response = await apiFetch(`${CONFIG.apiUrl}/sessions/${sessionId}`, {
				method: 'DELETE',
			});
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			fetchSessions();
		} catch (err) {
			alert('Failed to delete session: ' + err.message);
		}
	};

	const handleRestore = async (e, sessionId) => {
		e.stopPropagation();
		try {
			const response = await apiFetch(`${CONFIG.apiUrl}/sessions/${sessionId}/restore`, {
				method: 'POST',
			});
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			fetchSessions();
		} catch (err) {
			alert('Failed to restore session: ' + err.message);
		}
	};

	const formatShortDate = (dateString) => {
		if (!dateString) return 'N/A';
		const date = new Date(dateString);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
		});
	};

	const calculateDuration = (start, end) => {
		if (!start) return 'N/A';
		const startTime = new Date(start);
		const endTime = end !== null ? new Date(end) : new Date();
		const diffMs = endTime - startTime;
		const hours = Math.floor(diffMs / (1000 * 60 * 60));
		const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
		return `${hours}h ${minutes}m`;
	};

	const handleDeleteClick = (e, sessionId) => {
		e.stopPropagation();
		handleDelete(sessionId);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-20">
				<div className="text-center">
					<div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
					<p className="mt-4 text-neutral-500">Loading sessions...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md">
				<h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
				<p className="text-neutral-300 mb-4">{error}</p>
				<button
					onClick={fetchSessions}
					className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg"
				>
					Retry
				</button>
			</div>
		);
	}

	const allVisible = sessions.filter((s) => !s.hidden);
	const hiddenSessions = sessions.filter((s) => s.hidden);
	const activeSessions = allVisible.filter((s) => !s.endTime);
	const completedCount = allVisible.length - activeSessions.length;

	const visibleSessions = meatTypeFilter === 'All'
		? allVisible
		: allVisible.filter((s) => s.meatType === meatTypeFilter);

	// Count sessions per meat type for filter chip badges
	const meatTypeCounts = allVisible.reduce((acc, s) => {
		const t = s.meatType || 'N/A';
		acc[t] = (acc[t] || 0) + 1;
		return acc;
	}, {});

	return (
		<div className="space-y-10">
			{/* Page header + actions */}
			<section className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
				<div>
					<p className="text-xs uppercase tracking-[0.25em] text-neutral-500 mb-2">Cookbook</p>
					<h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Smoke Sessions</h2>
					<p className="text-sm text-neutral-500 mt-1">
						{completedCount} completed
						{activeSessions.length > 0 && ` · ${activeSessions.length} active`}
						{plans.length > 0 && ` · ${plans.length} planned`}
					</p>
				</div>
				<div className="flex items-center gap-2 flex-shrink-0">
					<button
						onClick={() => navigate('/meat-types')}
						className="w-10 h-10 rounded-xl border border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white flex items-center justify-center"
						title="Manage meat types"
					>
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
					</button>
					<button
						onClick={() => navigate('/plan/new')}
						className="px-3 sm:px-4 py-2.5 rounded-xl border border-neutral-800 text-neutral-200 hover:border-orange-500/50 hover:text-orange-400 font-medium flex items-center gap-2 text-sm"
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						<span className="hidden sm:inline">Plan a Smoke</span>
						<span className="sm:hidden">Plan</span>
					</button>
					<button
						onClick={() => navigate('/sessions/new')}
						className="px-3 sm:px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold flex items-center gap-2 text-sm shadow-lg shadow-orange-500/20"
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
						</svg>
						<span className="hidden sm:inline">New Session</span>
						<span className="sm:hidden">New</span>
					</button>
				</div>
			</section>

			{/* Active cook hero strip */}
			{activeSessions.length > 0 && (
				<section>
					<div className="flex items-center gap-2 mb-3">
						<span className="pulse-dot"></span>
						<h3 className="text-xs uppercase tracking-[0.25em] text-orange-400 font-semibold">Now Cooking</h3>
					</div>
					<div className="space-y-3">
						{activeSessions.map((session) => {
							const s = stats[session.id] || {};
							return (
								<div
									key={session.id}
									onClick={() => navigate(`/sessions/${encodeURIComponent(session.id)}`, { state: { session } })}
									className="block bg-gradient-to-br from-neutral-900 via-neutral-900 to-orange-950/40 rounded-2xl border border-orange-500/30 p-5 sm:p-6 hover:border-orange-500/60 transition cursor-pointer group"
								>
									<div className="grid lg:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center">
										<div>
											<div className="flex items-center gap-2 mb-1 flex-wrap">
												<span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 rounded ${meatColor(session.meatType).pill}`}>
													{session.meatType || 'N/A'}
												</span>
												{session.weight && (
													<span className="text-[10px] uppercase tracking-widest text-neutral-500">{session.weight}</span>
												)}
											</div>
											<h4 className="text-xl sm:text-2xl font-bold text-white group-hover:text-orange-300 transition">{session.name}</h4>
											<p className="text-xs text-neutral-500 mt-1">Started {formatShortDate(session.startTime)}</p>
										</div>
										<div>
											<div className="text-[10px] uppercase tracking-widest text-neutral-500">Avg Ambient</div>
											<div className="mono text-xl sm:text-2xl font-bold text-white">
												{s.avgAmbient != null ? <>{s.avgAmbient}<span className="text-sm text-neutral-500">°F</span></> : '—'}
											</div>
										</div>
										<div>
											<div className="text-[10px] uppercase tracking-widest text-neutral-500">Peak Meat</div>
											<div className="mono text-xl sm:text-2xl font-bold text-white">
												{s.peakMeat != null ? <>{s.peakMeat}<span className="text-sm text-neutral-500">°F</span></> : '—'}
											</div>
										</div>
										<div>
											<div className="text-[10px] uppercase tracking-widest text-neutral-500">Elapsed</div>
											<div className="mono text-xl sm:text-2xl font-bold text-white">{calculateDuration(session.startTime, session.endTime)}</div>
										</div>
										<svg className="w-5 h-5 text-neutral-600 group-hover:text-orange-400 transition hidden lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
										</svg>
									</div>
									{(() => {
										// Wall-clock elapsed (matches the Elapsed figure above)
										// vs the same-meat average. Hidden when there's no history.
										const est = computeEstimate(sessions, session.meatType, null);
										if (est.estimatedDurationHours == null) return null;
										const elapsedMs =
											Date.now() - new Date(session.startTime).getTime();
										return (
											<div className="mt-4 pt-4 border-t border-orange-500/15">
												<EstimatedFinish
													estimatedDurationHours={est.estimatedDurationHours}
													sampleCount={est.sampleCount}
													elapsedMs={elapsedMs}
													meatType={session.meatType}
												/>
											</div>
										);
									})()}
								</div>
							);
						})}
					</div>
				</section>
			)}

			{/* Planned smokes */}
			{plans.length > 0 && (
				<section>
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-xs uppercase tracking-[0.25em] text-neutral-500 font-semibold">Planned Smokes</h3>
						<span className="text-xs text-neutral-600 mono">{plans.length}</span>
					</div>
					<div className="grid md:grid-cols-2 gap-4">
						{plans.map((plan) => {
							const estimate = computeEstimate(sessions, plan.meatType, parseWeightLbs(plan.weight));
							let suggestedStartISO = '';
							if (plan.targetEndTime && estimate.estimatedDurationHours != null) {
								const end = new Date(plan.targetEndTime);
								if (!isNaN(end.getTime())) {
									suggestedStartISO = new Date(
										end.getTime() - estimate.estimatedDurationHours * 60 * 60 * 1000
									).toISOString();
								}
							}
							const isStarting = startingPlanId === plan.id;
							return (
								<div
									key={plan.id}
									className="bg-neutral-900 rounded-2xl border border-amber-500/20 border-l-2 border-l-amber-400 p-5 relative overflow-hidden"
								>
									<div className="absolute -top-8 -right-8 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>
									<div className="relative">
										<div className="flex items-start justify-between mb-3 gap-2">
											<div>
												<span className="text-[10px] uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">Planned</span>
												<h4 className="text-lg font-semibold text-white mt-2">{plan.name}</h4>
											</div>
											{(plan.meatType || plan.weight) && (
												<span className="text-[10px] uppercase tracking-widest text-neutral-500 mono text-right">
													{plan.meatType}{plan.weight ? ` · ${plan.weight}` : ''}
												</span>
											)}
										</div>
										<dl className="text-xs text-neutral-400 space-y-1 mb-4">
											{plan.targetEndTime && (
												<div className="flex justify-between gap-2">
													<dt className="text-neutral-500">Target end</dt>
													<dd className="mono text-neutral-200 text-right">{formatDateTime(plan.targetEndTime)}</dd>
												</div>
											)}
											{suggestedStartISO && (
												<div className="flex justify-between gap-2">
													<dt className="text-neutral-500">Suggested start</dt>
													<dd className="mono text-orange-400 font-semibold text-right">{formatDateTime(suggestedStartISO)}</dd>
												</div>
											)}
											{!suggestedStartISO && plan.targetEndTime && (
												<div className="italic text-neutral-600">No historical data — can't suggest a start.</div>
											)}
											{estimate.estimatedDurationHours != null && (
												<div className="flex justify-between gap-2">
													<dt className="text-neutral-500">Est. duration</dt>
													<dd className="mono text-neutral-300 text-right">~{formatHoursMinutes(estimate.estimatedDurationHours)}</dd>
												</div>
											)}
										</dl>
										<div className="flex gap-2">
											<button
												onClick={(e) => handleStartPlan(e, plan.id)}
												disabled={isStarting}
												className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50"
											>
												{isStarting ? 'Starting...' : 'Start Now'}
											</button>
											<button
												onClick={(e) => {
													e.stopPropagation();
													navigate(`/plan/${encodeURIComponent(plan.id)}`);
												}}
												className="px-3 py-2 rounded-lg border border-neutral-800 text-neutral-300 hover:border-neutral-700 text-sm"
											>
												Edit
											</button>
											<button
												onClick={(e) => handleDeletePlan(e, plan.id)}
												className="w-9 h-9 rounded-lg border border-neutral-800 text-neutral-500 hover:text-red-400 hover:border-red-500/30 flex items-center justify-center"
												title="Delete plan"
											>
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
												</svg>
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</section>
			)}

			{/* History */}
			<section>
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-xs uppercase tracking-[0.25em] text-neutral-500 font-semibold">History</h3>
					<span className="text-xs text-neutral-600 mono">{allVisible.length - activeSessions.length} cooks</span>
				</div>

				{/* Filter chips */}
				{meatTypes.length > 0 && (
					<div className="flex gap-2 overflow-x-auto pb-3 mb-5">
						<button
							onClick={() => setMeatTypeFilter('All')}
							className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
								meatTypeFilter === 'All'
									? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
									: 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-700'
							}`}
						>
							All <span className="mono opacity-70 ml-1">{allVisible.length}</span>
						</button>
						{meatTypes.map((type) => {
							const count = meatTypeCounts[type] || 0;
							const isActive = meatTypeFilter === type;
							return (
								<button
									key={type}
									onClick={() => setMeatTypeFilter(isActive ? 'All' : type)}
									className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
										isActive
											? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
											: 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-700'
									}`}
								>
									{type} <span className="mono opacity-50 ml-1">{count}</span>
								</button>
							);
						})}
					</div>
				)}

				{visibleSessions.length === 0 && !showHidden ? (
					<div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center">
						{meatTypeFilter !== 'All' ? (
							<>
								<p className="text-neutral-400 mb-4">No sessions found for "{meatTypeFilter}".</p>
								<button
									onClick={() => setMeatTypeFilter('All')}
									className="text-orange-400 hover:text-orange-300 font-medium"
								>
									Clear filter
								</button>
							</>
						) : (
							<>
								<p className="text-neutral-400 mb-4">No smoke sessions yet. Start your first smoke!</p>
								<button
									onClick={() => navigate('/sessions/new')}
									className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium"
								>
									Create First Session
								</button>
							</>
						)}
					</div>
				) : (
					<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{visibleSessions.filter((s) => s.endTime).map((session) => {
							const s = stats[session.id] || {};
							const color = meatColor(session.meatType);
							return (
								<div
									key={session.id}
									onClick={() => navigate(`/sessions/${encodeURIComponent(session.id)}`, { state: { session } })}
									className="group bg-neutral-900 rounded-2xl border border-neutral-800 hover:border-orange-500/40 transition-colors relative p-5 cursor-pointer"
								>
									<button
										onClick={(e) => handleDeleteClick(e, session.id)}
										className="absolute top-3 right-3 z-10 w-7 h-7 rounded-md text-neutral-600 hover:text-red-400 hover:bg-neutral-800/80 flex items-center justify-center"
										title="Delete session"
									>
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									</button>
									<span className={`text-[10px] uppercase tracking-widest border px-2 py-0.5 rounded ${color.pill}`}>
										{session.meatType || 'N/A'}
									</span>
									<h4 className="text-lg font-semibold text-white group-hover:text-orange-300 transition mt-3 pr-6">
										{session.name}
									</h4>
									<div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-500 flex-wrap">
										<span>{formatShortDate(session.startTime)}</span>
										<span className="text-neutral-700">·</span>
										<span className="mono text-neutral-400">{calculateDuration(session.startTime, session.endTime)}</span>
										{session.weight && (
											<>
												<span className="text-neutral-700">·</span>
												<span className="mono text-neutral-400">{session.weight}</span>
											</>
										)}
									</div>
									<div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-neutral-800">
										<div>
											<div className="text-[9px] uppercase tracking-wider text-neutral-600">Avg Ambient</div>
											<div className="mono text-sm font-semibold text-neutral-100">
												{s.avgAmbient != null ? <>{s.avgAmbient}<span className="text-neutral-500">°</span></> : '—'}
											</div>
										</div>
										<div>
											<div className="text-[9px] uppercase tracking-wider text-neutral-600">Peak Meat</div>
											<div className="mono text-sm font-semibold text-neutral-100">
												{s.peakMeat != null ? <>{s.peakMeat}<span className="text-neutral-500">°</span></> : '—'}
											</div>
										</div>
										<div>
											<div className="text-[9px] uppercase tracking-wider text-neutral-600">Pauses</div>
											<div className="mono text-sm font-semibold text-neutral-100">
												{s.pauseCount != null ? s.pauseCount : '—'}
											</div>
										</div>
									</div>
									{session.notes && (
										<p className="text-xs text-neutral-600 italic mt-4 line-clamp-2">
											"{session.notes}"
										</p>
									)}
								</div>
							);
						})}
					</div>
				)}

				{/* Hidden sessions toggle */}
				<div className="mt-8">
					<button
						onClick={() => setShowHidden(!showHidden)}
						className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1.5 font-medium"
					>
						{showHidden ? 'Hide deleted sessions' : 'Show deleted sessions'}
						<svg
							className={`w-4 h-4 transition-transform ${showHidden ? 'rotate-180' : ''}`}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
						</svg>
					</button>

					{showHidden && hiddenSessions.length > 0 && (
						<div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{hiddenSessions.map((session) => (
								<div
									key={session.id}
									className="bg-neutral-900/50 rounded-2xl border border-neutral-800 p-5 opacity-60 relative"
								>
									<button
										onClick={(e) => handleRestore(e, session.id)}
										className="absolute top-3 right-3 text-neutral-500 hover:text-emerald-400 transition-colors"
										title="Restore session"
									>
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
										</svg>
									</button>
									<span className="text-[10px] uppercase tracking-widest border border-neutral-700 text-neutral-500 px-2 py-0.5 rounded">
										{session.meatType || 'N/A'}
									</span>
									<h4 className="text-lg font-semibold text-neutral-400 mt-3 pr-6">{session.name}</h4>
									<div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-600">
										<span>{formatShortDate(session.startTime)}</span>
										<span>·</span>
										<span className="mono">{calculateDuration(session.startTime, session.endTime)}</span>
									</div>
								</div>
							))}
						</div>
					)}

					{showHidden && hiddenSessions.length === 0 && (
						<p className="mt-4 text-sm text-neutral-600 italic">No deleted sessions.</p>
					)}
				</div>
			</section>
		</div>
	);
}

export default SessionList;
