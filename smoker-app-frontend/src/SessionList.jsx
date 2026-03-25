import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CONFIG } from './config';

function SessionList() {
	const navigate = useNavigate();
	const [sessions, setSessions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		fetchSessions();
	}, []);

	const fetchSessions = async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await fetch(`${CONFIG.apiUrl}/sessions`);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const data = await response.json();
			setSessions(data.sessions);
			setLoading(false);
		} catch (err) {
			setError('Failed to load sessions: ' + err.message);
			setLoading(false);
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
			alert('Session deleted successfully!');
			fetchSessions();
		} catch (err) {
			alert('Failed to delete session: ' + err.message);
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
		var endTime = new Date();
		if (end !== null) {
			endTime = new Date(end);
		}
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

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<h2 className="text-2xl font-bold text-gray-800">Smoke Sessions</h2>
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

			{sessions.length === 0 ? (
				<div className="bg-white rounded-lg shadow p-8 text-center">
					<p className="text-gray-500 mb-4">
						No smoke sessions yet. Start your first smoke!
					</p>
					<button
						onClick={() => navigate('/sessions/new')}
						className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700"
					>
						Create First Session
					</button>
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{sessions.map((session) => (
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
								<div>📅 {formatDate(session.startTime)}</div>
								<div>
									⏱️ Duration:{' '}
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
		</div>
	);
}

export default SessionList;
