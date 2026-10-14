import React, {useEffect, useState} from 'react';
import {api, type History, type Job} from '../api';
import type {Tab} from '../App';
import {JobProgress} from './JobProgress';

type Stats = {players: number; questions: number; rendered: number; failed: number; recent: History[]; channel: string};

export const Dashboard: React.FC<{onCreate: () => void; goto: (t: Tab) => void}> = ({onCreate, goto}) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [batch, setBatch] = useState({count: 5, difficulty: 'medium', days: 30, country: '', status: 'any', format: 'guess_player', dryRun: false});
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState('');

  const load = () => api.get<Stats>('/api/stats').then(setStats).catch((e) => setErr(String(e)));
  useEffect(() => {
    load();
  }, []);

  const startBatch = async () => {
    setErr('');
    try {
      setJob(await api.post<Job>('/api/batch', batch));
    } catch (e) {
      setErr(String(e));
    }
  };

  return (
    <div className="page">
      <div className="cards">
        <Stat label="Players" value={stats?.players} />
        <Stat label="Questions generated" value={stats?.questions} />
        <Stat label="Videos rendered" value={stats?.rendered} />
        <Stat label="Failed renders" value={stats?.failed} warn={!!stats?.failed} />
      </div>
      <div className="row2">
        <section className="panel">
          <h2>Make something</h2>
          <button className="primary big" onClick={onCreate}>
            ＋ Create a video
          </button>
          <h3>Batch</h3>
          <div className="form-grid">
            <label>
              How many
              <input type="number" min={1} max={50} value={batch.count} onChange={(e) => setBatch({...batch, count: +e.target.value})} />
            </label>
            <label>
              Format
              <select value={batch.format} onChange={(e) => setBatch({...batch, format: e.target.value})}>
                <option value="guess_player">Guess the Player</option>
                <option value="career_path">Career Path</option>
                <option value="true_false">True or False</option>
              </select>
            </label>
            <label>
              Difficulty
              <select value={batch.difficulty} onChange={(e) => setBatch({...batch, difficulty: e.target.value})}>
                <option>easy</option>
                <option>medium</option>
                <option>hard</option>
              </select>
            </label>
            <label>
              Skip players used in last (days)
              <input type="number" min={0} value={batch.days} onChange={(e) => setBatch({...batch, days: +e.target.value})} />
            </label>
            <label>
              Country (optional)
              <input value={batch.country} placeholder="e.g. Brazil" onChange={(e) => setBatch({...batch, country: e.target.value})} />
            </label>
            <label>
              Players
              <select value={batch.status} onChange={(e) => setBatch({...batch, status: e.target.value})}>
                <option value="any">Active + retired</option>
                <option value="active">Active only</option>
                <option value="retired">Legends only</option>
              </select>
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={batch.dryRun} onChange={(e) => setBatch({...batch, dryRun: e.target.checked})} /> Dry run (questions + narration only)
          </label>
          <button className="primary" onClick={startBatch} disabled={!!job && ['queued', 'running'].includes(job.status)}>
            Generate {batch.count} videos
          </button>
          {err && <div className="error">{err}</div>}
          {job && <JobProgress jobId={job.id} onFinished={load} />}
        </section>
        <section className="panel">
          <h2>
            Recent videos <button className="link" onClick={() => goto('history')}>see all →</button>
          </h2>
          {!stats?.recent.length && <p className="muted">Nothing rendered yet.</p>}
          <ul className="recent">
            {stats?.recent.map((h) => (
              <li key={h.id}>
                <span className={`pill ${h.status}`}>{h.status}</span> <b>{h.answer}</b> <span className="muted">{h.format.replace('_', ' ')} · {h.createdAt.replace('T', ' ')}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

const Stat: React.FC<{label: string; value?: number; warn?: boolean}> = ({label, value, warn}) => (
  <div className={`stat ${warn ? 'warn' : ''}`}>
    <div className="v">{value ?? '–'}</div>
    <div className="l">{label}</div>
  </div>
);
