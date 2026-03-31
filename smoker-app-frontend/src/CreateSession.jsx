import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CONFIG, apiFetch } from "./config";

function CreateSession() {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [meatType, setMeatType] = useState("");
	const [notes, setNotes] = useState("");
	const [recipeUrl, setRecipeUrl] = useState("");
	const [creating, setCreating] = useState(false);
	const [meatTypeOptions, setMeatTypeOptions] = useState([]);

	useEffect(() => {
		fetchMeatTypes();
	}, []);

	const fetchMeatTypes = async () => {
		try {
			const response = await apiFetch(`${CONFIG.apiUrl}/meat-types`);
			if (response.ok) {
				const data = await response.json();
				setMeatTypeOptions(data.meatTypes);
				if (data.meatTypes.length > 0) {
					setMeatType(data.meatTypes[0]);
				}
			}
		} catch (err) {
			console.error("Error fetching meat types:", err);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!name.trim()) {
			alert("Please enter a session name");
			return;
		}

		try {
			setCreating(true);

			const response = await apiFetch(`${CONFIG.apiUrl}/sessions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: name.trim(),
					meatType: meatType.trim(),
					notes: notes.trim(),
					recipeUrl: recipeUrl.trim(),
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			navigate(`/sessions/${encodeURIComponent(data.session.id)}`, { state: { session: data.session } });
		} catch (err) {
			console.error("Error creating session:", err);
			alert("Failed to create session: " + err.message);
			setCreating(false);
		}
	};

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
					Start New Smoke Session
				</h2>

				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">
							Session Name *
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							placeholder="e.g., Saturday Brisket"
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
						<button
							type="button"
							onClick={() => navigate("/meat-types")}
							className="mt-2 text-sm text-orange-600 hover:text-orange-700 font-medium"
						>
							Manage Meat Types
						</button>
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
							Notes (Optional)
						</label>
						<textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							rows="4"
							placeholder="Add any notes about this smoke..."
						/>
					</div>

					<div className="flex gap-4">
						<button
							type="submit"
							disabled={creating}
							className="flex-1 bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{creating ? "Creating..." : "Start Session"}
						</button>
						<button
							type="button"
							onClick={() => navigate("/")}
							disabled={creating}
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

export default CreateSession;
