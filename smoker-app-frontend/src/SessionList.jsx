function SessionList({ sessions, onSelectSession, onDelete, onCreateNew }) {
	const formatDate = (dateString) => {
		if (!dateString) return "N/A";
		const date = new Date(dateString);
		return date.toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const calculateDuration = (start, end) => {
		if (!start ) return "N/A";
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

	const handleDelete = (e, sessionId) => {
		e.stopPropagation();
		onDelete(sessionId);
	};

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<h2 className="text-2xl font-bold text-gray-800">Smoke Sessions</h2>
				<button
					onClick={onCreateNew}
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
						onClick={onCreateNew}
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
							onClick={() => onSelectSession(session)}
							className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow cursor-pointer p-6 border-l-4 border-orange-500 relative"
						>
							<button
								onClick={(e) => handleDelete(e, session.id)}
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
									{session.meatType || "N/A"}
								</span>
							</div>

							<div className="space-y-2 text-sm text-gray-600">
								<div>📅 {formatDate(session.startTime)}</div>
								<div>
									⏱️ Duration:{" "}
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
