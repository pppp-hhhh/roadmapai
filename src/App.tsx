import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { HomePage, CreateRoadmapPage, RoadmapDetailPage, FlashcardsPage, AiTutorPage, SettingsPage, FavoritesPage, StatsPage, OnboardingPage } from './pages';
import { useOnboardingStore } from './stores/useOnboardingStore';
import type { ReactNode } from 'react';

function OnboardingGate({ children }: { children: ReactNode }) {
  const completed = useOnboardingStore((s) => s.completed);
  if (!completed) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        path="/"
        element={
          <OnboardingGate>
            <Layout />
          </OnboardingGate>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="create" element={<CreateRoadmapPage />} />
        <Route path="roadmap/:id" element={<RoadmapDetailPage />} />
        <Route path="flashcards" element={<FlashcardsPage />} />
        <Route path="tutor" element={<AiTutorPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
