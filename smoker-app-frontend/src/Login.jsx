import { useState } from "react";
import { CONFIG } from "./config";

function Login({ onLogin }) {
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const response = await fetch(`${CONFIG.apiUrl}/auth/verify`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: password }),
			});

			const data = await response.json();

			if (data.valid) {
				localStorage.setItem("smoker_api_key", password);
				onLogin();
			} else {
				setError("Invalid password");
			}
		} catch (err) {
			setError("Failed to connect to server");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-100 flex items-center justify-center">
			<div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full">
				<h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
					Smoker Tracker
				</h1>
				<p className="text-gray-500 text-sm text-center mb-6">
					Enter your password to continue
				</p>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							placeholder="Password"
							autoFocus
						/>
					</div>

					{error && (
						<p className="text-red-600 text-sm text-center">{error}</p>
					)}

					<button
						type="submit"
						disabled={loading || !password}
						className="w-full bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loading ? "Verifying..." : "Log In"}
					</button>
				</form>
			</div>
		</div>
	);
}

export default Login;
