import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CreateRoadmapPage from './pages/CreateRoadmapPage';
import RoadmapDetailPage from './pages/RoadmapDetailPage';
import FlashcardsPage from './pages/FlashcardsPage';
import AiTutorPage from './pages/AiTutorPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="create" element={<CreateRoadmapPage />} />
        <Route path="roadmap/:id" element={<RoadmapDetailPage />} />
        <Route path="flashcards" element={<FlashcardsPage />} />
        <Route path="tutor" element={<AiTutorPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;