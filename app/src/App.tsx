import { Routes, Route } from 'react-router';
import Layout from './components/Layout';
import Home from './pages/Home';
import Game from './pages/Game';
import Codex from './pages/Codex';
import Stats from './pages/Stats';
import Help from './pages/Help';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="/codex" element={<Codex />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/help" element={<Help />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  );
}
