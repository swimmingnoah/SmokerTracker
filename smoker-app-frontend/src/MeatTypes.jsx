import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CONFIG } from './config';

function MeatTypes() {
	const navigate = useNavigate();
	const [meatTypes, setMeatTypes] = useState([]);
	const [loading, setLoading] = useState(true);
	const [newType, setNewType] = useState('');
	const [adding, setAdding] = useState(false);
	const [editingType, setEditingType] = useState(null);
	const [editedName, setEditedName] = useState('');

	useEffect(() => {
		fetchMeatTypes();
	}, []);

	const fetchMeatTypes = async () => {
		try {
			setLoading(true);
			const response = await fetch(`${CONFIG.apiUrl}/meat-types`);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const data = await response.json();
			setMeatTypes(data.meatTypes);
			setLoading(false);
		} catch (err) {
			console.error('Error fetching meat types:', err);
			setLoading(false);
		}
	};

	const handleAdd = async (e) => {
		e.preventDefault();
		const name = newType.trim();
		if (!name) return;

		try {
			setAdding(true);
			const response = await fetch(`${CONFIG.apiUrl}/meat-types`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name }),
			});
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			setNewType('');
			await fetchMeatTypes();
		} catch (err) {
			alert('Failed to add meat type: ' + err.message);
		} finally {
			setAdding(false);
		}
	};

	const handleRename = async (oldName) => {
		const name = editedName.trim();
		if (!name || name === oldName) {
			setEditingType(null);
			return;
		}

		try {
			const response = await fetch(
				`${CONFIG.apiUrl}/meat-types/${encodeURIComponent(oldName)}`,
				{
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name }),
				}
			);
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || `HTTP error! status: ${response.status}`);
			}
			setEditingType(null);
			await fetchMeatTypes();
		} catch (err) {
			alert('Failed to rename meat type: ' + err.message);
		}
	};

	const handleDelete = async (meatType) => {
		const confirmed = window.confirm(`Remove "${meatType}" from the list?`);
		if (!confirmed) return;

		try {
			const response = await fetch(
				`${CONFIG.apiUrl}/meat-types/${encodeURIComponent(meatType)}`,
				{ method: 'DELETE' }
			);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			await fetchMeatTypes();
		} catch (err) {
			alert('Failed to remove meat type: ' + err.message);
		}
	};

	return (
		<div className="max-w-2xl mx-auto">
			<div className="mb-6">
				<button
					onClick={() => navigate('/')}
					className="flex items-center text-orange-600 hover:text-orange-700 font-medium"
				>
					← Back to Sessions
				</button>
			</div>

			<div className="bg-white rounded-lg shadow-lg p-8">
				<h2 className="text-2xl font-bold text-gray-800 mb-6">Meat Types</h2>

				{/* Add new meat type */}
				<form onSubmit={handleAdd} className="flex gap-2 mb-8">
					<input
						type="text"
						value={newType}
						onChange={(e) => setNewType(e.target.value)}
						className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
						placeholder="Add a new meat type..."
					/>
					<button
						type="submit"
						disabled={adding || !newType.trim()}
						className="bg-orange-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{adding ? 'Adding...' : 'Add'}
					</button>
				</form>

				{/* List of meat types */}
				{loading ? (
					<div className="text-center py-8">
						<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
						<p className="mt-2 text-gray-500">Loading...</p>
					</div>
				) : meatTypes.length === 0 ? (
					<p className="text-gray-500 text-center py-8 italic">
						No meat types yet. Add your first one above.
					</p>
				) : (
					<div className="space-y-2">
						{meatTypes.map((type) => (
							<div
								key={type}
								className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
							>
								{editingType === type ? (
									<form
										onSubmit={(e) => { e.preventDefault(); handleRename(type); }}
										className="flex items-center gap-2 flex-1 mr-2"
									>
										<input
											type="text"
											value={editedName}
											onChange={(e) => setEditedName(e.target.value)}
											className="flex-1 px-3 py-1 border-2 border-orange-500 rounded-lg focus:outline-none text-sm"
											autoFocus
											onKeyDown={(e) => { if (e.key === 'Escape') setEditingType(null); }}
										/>
										<button
											type="submit"
											className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
										>
											Save
										</button>
										<button
											type="button"
											onClick={() => setEditingType(null)}
											className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
										>
											Cancel
										</button>
									</form>
								) : (
									<>
										<div className="flex items-center gap-3">
											<span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
												{type}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<button
												onClick={() => { setEditingType(type); setEditedName(type); }}
												className="text-gray-400 hover:text-orange-600 transition-colors"
												title="Edit meat type"
											>
												<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
												</svg>
											</button>
											<button
												onClick={() => handleDelete(type)}
												className="text-gray-400 hover:text-red-600 transition-colors"
												title="Remove meat type"
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
										</div>
									</>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export default MeatTypes;
