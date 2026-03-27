import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import SessionList from './SessionList';
import SessionDetail from './SessionDetail';
import CreateSession from './CreateSession';
import MeatTypes from './MeatTypes';
import Login from './Login';
import { CONFIG } from './config';
import './App.css';

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check if server requires auth
      const statusRes = await fetch(`${CONFIG.apiUrl}/auth/status`);
      const statusData = await statusRes.json();

      if (!statusData.authRequired) {
        // No auth needed — skip login
        setAuthChecked(true);
        return;
      }

      // Auth required — check if we have a valid stored key
      const storedKey = localStorage.getItem('smoker_api_key');
      if (storedKey) {
        const verifyRes = await fetch(`${CONFIG.apiUrl}/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: storedKey }),
        });
        const verifyData = await verifyRes.json();
        if (verifyData.valid) {
          setAuthChecked(true);
          return;
        }
      }

      // Need login
      setNeedsLogin(true);
      setAuthChecked(true);
    } catch {
      // Can't reach server — show app anyway (will fail on API calls)
      setAuthChecked(true);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (needsLogin) {
    return <Login onLogin={() => setNeedsLogin(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-orange-600 text-white p-6 shadow-lg">
        <h1 className="text-3xl font-bold">Smoker Tracker</h1>
        <p className="text-orange-100">
          Track and analyze your smoking sessions
        </p>
      </header>

      <div className="container mx-auto p-6">
        <Routes>
          <Route path="/" element={<SessionList />} />
          <Route path="/sessions/new" element={<CreateSession />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/meat-types" element={<MeatTypes />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
