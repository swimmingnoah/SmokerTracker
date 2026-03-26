import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CONFIG } from './config';

function SessionList() {
	const navigate = useNavigate();
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showHidden, setShowHidden] = useState(false);
	const [meatTypeFilter, setMeatTypeFilter] = useState('All');
	const [meatTypes, setMeatTypes] = useState([]);

	useEffect(() => {
		fetchSessions();
		fetchMeatTypes();
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
			const response = await fetch(`${CONFIG.apiUrl}/meat-types`);
			if (!response.ok) return;
			const data = await response.json();
			setMeatTypes(data.meatTypes);
		} catch (err) {
			console.error('Error fetching meat types:', err);
		}
	};

	const handleDelete = async (sessionId) => {
		const confirmed = window.confirm(
			'Are you sure you want to delete this session? This will hide it from view (temperature data remains in InfluxDB).'
		);
		if (!confirmed) return;

		try {
			const response = await fetch(`${CONFIG.apiUrl}/sessions/${sessionId}`, {
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
			const response = await fetch(`${CONFIG.apiUrl}/sessions/${sessionId}/restore`, {
				method: 'POST',
			});
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			fetchSessions();
		} catch (err) {
			alert('Failed to restore session: ' + err.message);
		}
	};

	const formatDate = (dateString) => {
		if (!dateString) return 'N/A';
		const date = new Date(dateString);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
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
					<div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
					<p className="mt-4 text-gray-600">Loading sessions...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
				<h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
				<p className="text-gray-700 mb-4">{error}</p>
				<button
					onClick={fetchSessions}
					className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
				>
					Retry
				</button>
			</div>
		);
	}

	const allVisible = sessions.filter((s) => !s.hidden);
	const hiddenSessions = sessions.filter((s) => s.hidden);

	// Apply meat type filter
	const visibleSessions = meatTypeFilter === 'All'
		? allVisible
		: allVisible.filter((s) => s.meatType === meatTypeFilter);

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<h2 className="text-2xl font-bold text-gray-800">Smoke Sessions</h2>
				<div className="flex items-center gap-3">
					<button
						onClick={() => navigate('/meat-types')}
						className="text-gray-500 hover:text-orange-600 transition-colors"
						title="Manage meat types"
					>
						<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
					</button>
					<button
						onClick={() => navigate('/sessions/new')}
						className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 flex items-center gap-2"
					>
						<svg
							className="w-5 h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 4v16m8-8H4"
							/>
						</svg>
						Start New Session
					</button>
				</div>
			</div>

			{/* Meat Type Filter */}
			{meatTypes.length > 0 && (
				<div className="flex flex-wrap gap-2 mb-6">
					<button
						onClick={() => setMeatTypeFilter('All')}
						className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
							meatTypeFilter === 'All'
								? 'bg-orange-600 text-white'
								: 'bg-gray-200 text-gray-600 hover:bg-gray-300'
						}`}
					>
						All
					</button>
					{meatTypes.map((type) => (
						<button
							key={type}
							onClick={() => setMeatTypeFilter(type === meatTypeFilter ? 'All' : type)}
							className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
								meatTypeFilter === type
									? 'bg-orange-600 text-white'
									: 'bg-gray-200 text-gray-600 hover:bg-gray-300'
							}`}
						>
							{type}
						</button>
					))}
				</div>
			)}

			{visibleSessions.length === 0 && !showHidden ? (
				<div className="bg-white rounded-lg shadow p-8 text-center">
					{meatTypeFilter !== 'All' ? (
						<>
							<p className="text-gray-500 mb-4">
								No sessions found for "{meatTypeFilter}".
							</p>
							<button
								onClick={() => setMeatTypeFilter('All')}
								className="text-orange-600 hover:text-orange-700 font-medium"
							>
								Clear filter
							</button>
						</>
					) : (
						<>
							<p className="text-gray-500 mb-4">
								No smoke sessions yet. Start your first smoke!
							</p>
							<button
								onClick={() => navigate('/sessions/new')}
								className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700"
							>
								Create First Session
							</button>
						</>
					)}
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{visibleSessions.map((session) => (
						<div
							key={session.id}
							onClick={() => navigate(`/sessions/${encodeURIComponent(session.id)}`, { state: { session } })}
							className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow cursor-pointer p-6 border-l-4 border-orange-500 relative"
						>
							<button
								onClick={(e) => handleDeleteClick(e, session.id)}
								className="absolute top-4 right-4 text-gray-400 hover:text-red-600 transition-colors"
								title="Delete session"
							>
								<svg
									className="w-5 h-5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>

							<div className="flex justify-between items-start mb-3 pr-8">
								<h3 className="text-xl font-semibold text-gray-800">
									{session.name}
								</h3>
								<span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded">
									{session.meatType || 'N/A'}
								</span>
							</div>

							<div className="space-y-2 text-sm text-gray-600">
								<div>{formatDate(session.startTime)}</div>
								<div>
									Duration:{' '}
									{calculateDuration(session.startTime, session.endTime)}
								</div>
								{session.notes && (
									<div className="mt-3 pt-3 border-t border-gray-200">
										<p className="text-xs italic text-gray-500 line-clamp-2">
											"{session.notes}"
										</p>
									</div>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			{/* Show Hidden Sessions Toggle */}
			<div className="mt-8">
				<button
					onClick={() => setShowHidden(!showHidden)}
					className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1"
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
					<div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{hiddenSessions.map((session) => (
							<div
								key={session.id}
								className="bg-gray-100 rounded-lg shadow p-6 border-l-4 border-gray-300 relative opacity-60"
							>
								<button
									onClick={(e) => handleRestore(e, session.id)}
									className="absolute top-4 right-4 text-gray-500 hover:text-green-600 transition-colors"
									title="Restore session"
								>
									<svg
										className="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
										/>
									</svg>
								</button>

								<div className="flex justify-between items-start mb-3 pr-8">
									<h3 className="text-xl font-semibold text-gray-500">
										{session.name}
									</h3>
									<span className="bg-gray-200 text-gray-500 text-xs font-medium px-2.5 py-0.5 rounded">
										{session.meatType || 'N/A'}
									</span>
								</div>

								<div className="space-y-2 text-sm text-gray-400">
									<div>{formatDate(session.startTime)}</div>
									<div>
										Duration:{' '}
										{calculateDuration(session.startTime, session.endTime)}
									</div>
								</div>
							</div>
						))}
					</div>
				)}

				{showHidden && hiddenSessions.length === 0 && (
					<p className="mt-4 text-sm text-gray-400 italic">No deleted sessions.</p>
				)}
			</div>
		</div>
	);
}

export default SessionList;
