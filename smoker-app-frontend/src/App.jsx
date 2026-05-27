import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import SessionList from './SessionList';
import SessionDetail from './SessionDetail';
import CreateSession from './CreateSession';
import PlanSession from './PlanSession';
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
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (needsLogin) {
    return <Login onLogin={() => setNeedsLogin(false)} />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.24 17 6.5c1.5 2 2.5 3 2.5 5.5a8.014 8.014 0 01-1.843 6.657z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Smoker Tracker</h1>
            <p className="text-xs text-neutral-500 leading-tight">Track and analyze your smoking sessions</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-3 sm:p-6 max-w-6xl">
        <Routes>
          <Route path="/" element={<SessionList />} />
          <Route path="/sessions/new" element={<CreateSession />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/plan/new" element={<PlanSession />} />
          <Route path="/plan/:id" element={<PlanSession />} />
          <Route path="/meat-types" element={<MeatTypes />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
