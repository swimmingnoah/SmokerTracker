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
		<div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
			<div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-sm w-full">
				<div className="flex items-center justify-center gap-3 mb-2">
					<div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
						<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.24 17 6.5c1.5 2 2.5 3 2.5 5.5a8.014 8.014 0 01-1.843 6.657z" />
						</svg>
					</div>
					<h1 className="text-2xl font-bold text-white">Smoker Tracker</h1>
				</div>
				<p className="text-neutral-500 text-sm text-center mb-6">
					Enter your password to continue
				</p>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-600 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							placeholder="Password"
							autoFocus
						/>
					</div>

					{error && (
						<p className="text-red-400 text-sm text-center">{error}</p>
					)}

					<button
						type="submit"
						disabled={loading || !password}
						className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loading ? "Verifying..." : "Log In"}
					</button>
				</form>
			</div>
		</div>
	);
}

export default Login;
