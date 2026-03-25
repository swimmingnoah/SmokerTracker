import { Routes, Route } from 'react-router-dom';
import SessionList from './SessionList';
import SessionDetail from './SessionDetail';
import CreateSession from './CreateSession';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-orange-600 text-white p-6 shadow-lg">
        <h1 className="text-3xl font-bold">🔥 Smoker Tracker</h1>
        <p className="text-orange-100">
          Track and analyze your smoking sessions
        </p>
      </header>

      <div className="container mx-auto p-6">
        <Routes>
          <Route path="/" element={<SessionList />} />
          <Route path="/sessions/new" element={<CreateSession />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
