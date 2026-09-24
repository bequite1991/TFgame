import { Routes, Route } from 'react-router';
import Layout from './components/Layout';
import Home from './pages/Home';
import Game from './pages/Game';
import Codex from './pages/Codex';
import Stats from './pages/Stats';
import Help from './pages/Help';
import DebugTowers from './pages/DebugTowers';
import DebugScene from './pages/DebugScene';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="/codex" element={<Codex />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/help" element={<Help />} />
        <Route path="/debug-towers" element={<DebugTowers />} />
        <Route path="/debug-scene" element={<DebugScene />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  );
}
