import React, {useState} from 'react';
import {Dashboard} from './pages/Dashboard';
import {Players} from './pages/Players';
import {Creator} from './pages/Creator';
import {HistoryPage} from './pages/History';
import type {Question, Settings} from './api';

export type Tab = 'dashboard' | 'players' | 'create' | 'history';
export type CreatorSeed = {playerId?: string; question?: Question; settings?: Settings; nonce: number} | null;

const TABS: {id: Tab; label: string}[] = [
  {id: 'dashboard', label: 'Dashboard'},
  {id: 'create', label: 'Create video'},
  {id: 'players', label: 'Players'},
  {id: 'history', label: 'Videos'},
];

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [seed, setSeed] = useState<CreatorSeed>(null);
  const openCreator = (s: Omit<NonNullable<CreatorSeed>, 'nonce'> = {}) => {
    setSeed({...s, nonce: Date.now()});
    setTab('create');
  };
  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="ball">⚽</span> SOCCER <b>BRAIN</b> <span className="sub">Studio</span>
        </div>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'dashboard' && <Dashboard onCreate={openCreator} goto={setTab} />}
        {tab === 'players' && <Players onCreate={(playerId) => openCreator({playerId})} />}
        {/* Creator stays mounted so work isn't lost when switching tabs. */}
        <div style={{display: tab === 'create' ? 'block' : 'none'}}>
          <Creator seed={seed} />
        </div>
        {tab === 'history' && <HistoryPage onEdit={(question, settings) => openCreator({question, settings})} />}
      </main>
    </div>
  );
};
