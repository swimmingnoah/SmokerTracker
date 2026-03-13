import { useState, useEffect } from 'react';
import { CONFIG } from './config';
import SessionList from './SessionList';
import SessionDetail from './SessionDetail';
import CreateSession from './CreateSession';
import './App.css';

function App() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
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
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Loaded sessions:', data.sessions);
      setSessions(data.sessions);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Failed to load sessions: ' + err.message);
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this session? This will hide it from view (temperature data remains in InfluxDB).'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${CONFIG.apiUrl}/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      alert('Session deleted successfully!');
      
      if (selectedSession && selectedSession.id === sessionId) {
        setSelectedSession(null);
      }

      fetchSessions();
    } catch (err) {
      console.error('Error deleting session:', err);
      alert('Failed to delete session: ' + err.message);
    }
  };

    const handleEndSmoke = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    try {
      const response = await fetch(`${CONFIG.apiUrl}/sessions/${sessionId}/end`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      if (selectedSession && selectedSession.id === sessionId) {
        setSelectedSession(null);
      }

      fetchSessions();
    } catch (err) {
      console.error('Error deleting session:', err);
      alert('Failed to delete session: ' + err.message);
    }
  };



  const handleCreateSession = () => {
    setShowCreateForm(false);
    fetchSessions();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
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
      </div>
    );
  }

  return (
		<div className="min-h-screen bg-gray-100">
			<header className="bg-orange-600 text-white p-6 shadow-lg">
				<h1 className="text-3xl font-bold">🔥 Smoker Tracker</h1>
				<p className="text-orange-100">
					Track and analyze your smoking sessions
				</p>
			</header>

			<div className="container mx-auto p-6">
				{showCreateForm ? (
					<CreateSession
						onCancel={() => setShowCreateForm(false)}
						onSuccess={handleCreateSession}
					/>
				) : selectedSession ? (
					<SessionDetail
						session={selectedSession}
						onBack={() => setSelectedSession(null)}
						onDelete={handleDeleteSession}
						onEndSmoke={handleEndSmoke}
					/>
				) : (
					<SessionList
						sessions={sessions}
						onSelectSession={setSelectedSession}
						onDelete={handleDeleteSession}
						onCreateNew={() => setShowCreateForm(true)}
					/>
				)}
			</div>
		</div>
	);
}

export default App;
