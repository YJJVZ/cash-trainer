import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useStore } from './state/store';
import { GuessPage } from './pages/GuessPage';
import { MainMenuPage } from './pages/MainMenuPage';
import { MistakesPage } from './pages/MistakesPage';
import { RangeEditorPage } from './pages/RangeEditorPage';
import { RangesPage } from './pages/RangesPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { TrainPage } from './pages/TrainPage';

export function App() {
  const { ready } = useStore();
  if (!ready) return <div className="p-6 text-muted text-sm">Loading…</div>;
  return (
    <Routes>
      <Route index element={<MainMenuPage />} />
      <Route element={<Layout />}>
        <Route path="train" element={<TrainPage />} />
        <Route path="guess" element={<GuessPage />} />
        <Route path="ranges" element={<RangesPage />} />
        <Route path="ranges/edit/:id" element={<RangeEditorPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="mistakes" element={<MistakesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Former routes kept as redirects */}
        <Route path="library" element={<Navigate to="/settings?tab=library" replace />} />
        <Route path="dashboard" element={<Navigate to="/stats" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
