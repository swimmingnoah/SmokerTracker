import { useState, useEffect } from "react";
import { CONFIG } from "./config";

function CreateSession({ onCancel, onSuccess }) {
	const [name, setName] = useState("");
	const [meatType, setMeatType] = useState("");
	const [notes, setNotes] = useState("");
	const [creating, setCreating] = useState(false);
	const [meatTypeOptions, setMeatTypeOptions] = useState(["Custom"]);
	const [showCustomMeatType, setShowCustomMeatType] = useState(false);

	useEffect(() => {
		fetchMeatTypes();
	}, []);

const fetchMeatTypes = async () => {
	try {
		const response = await fetch(`${CONFIG.apiUrl}/meat-types`);
		if (response.ok) {
			const data = await response.json();
			setMeatTypeOptions([...data.meatTypes, "Custom"]);

			// If no meat types exist yet, show custom input by default
			if (data.meatTypes.length === 0) {
				setShowCustomMeatType(true);
			}
		}
	} catch (err) {
		console.error("Error fetching meat types:", err);
		setMeatTypeOptions(["Custom"]);
		setShowCustomMeatType(true); // Show custom input if fetch fails
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

			const response = await fetch(`${CONFIG.apiUrl}/sessions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: name.trim(),
					meatType: meatType.trim(),
					notes: notes.trim(),
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			console.log("Session created:", data.session);
			alert("Session created successfully!");
			onSuccess();
		} catch (err) {
			console.error("Error creating session:", err);
			alert("Failed to create session: " + err.message);
			setCreating(false);
		}
	};

	return (
		<div className="max-w-2xl mx-auto">
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
						<div className="flex gap-2">
							<select
								value={
									meatTypeOptions.includes(meatType) && meatType !== ""
										? meatType
										: "Custom"
								}
								onChange={(e) => {
									if (e.target.value === "Custom") {
										setShowCustomMeatType(true);
										setMeatType("");
									} else {
										setShowCustomMeatType(false);
										setMeatType(e.target.value);
									}
								}}
								className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							>
								{meatTypeOptions.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>

							{showCustomMeatType && (
								<input
									type="text"
									value={meatType}
									onChange={(e) => setMeatType(e.target.value)}
									className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
									placeholder="Enter custom meat type"
								/>
							)}
						</div>
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
							onClick={onCancel}
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
