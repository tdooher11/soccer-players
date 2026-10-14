import React, {useEffect, useMemo, useState} from 'react';
import {api, type Achievement, type PlayerRow} from '../api';

const POS: Record<string, string> = {GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Striker'};
const ACH: {type: string; label: string}[] = [
  {type: 'world_cup', label: 'World Cup'},
  {type: 'champions_league', label: 'Champions League'},
  {type: 'ballon_dor', label: "Ballon d'Or"},
  {type: 'continental', label: 'Continental (Euros/Copa…)'},
];

export const Players: React.FC<{onCreate: (playerId: string) => void}> = ({onCreate}) => {
  const [rows, setRows] = useState<PlayerRow[]>([]);
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [club, setClub] = useState('');
  const [status, setStatus] = useState('');
  const [position, setPosition] = useState('');
  const [editing, setEditing] = useState<PlayerRow | 'new' | null>(null);

  const load = () => api.get<PlayerRow[]>('/api/players').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const countries = useMemo(() => [...new Set(rows.map((r) => r.country))].sort(), [rows]);
  const clubs = useMemo(() => [...new Set(rows.flatMap((r) => r.careerClubs))].sort(), [rows]);
  const shown = rows.filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q.toLowerCase())) &&
      (!country || r.country === country) &&
      (!club || r.careerClubs.includes(club)) &&
      (!status || (status === 'retired' ? r.retired : !r.retired)) &&
      (!position || r.position === position),
  );

  return (
    <div className="page">
      <div className="toolbar">
        <input placeholder="Search players…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={club} onChange={(e) => setClub(e.target.value)}>
          <option value="">All clubs</option>
          {clubs.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Active + retired</option>
          <option value="active">Active</option>
          <option value="retired">Retired</option>
        </select>
        <select value={position} onChange={(e) => setPosition(e.target.value)}>
          <option value="">All positions</option>
          {Object.entries(POS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="muted">{shown.length} players</span>
        <button className="primary" onClick={() => setEditing('new')}>
          ＋ Add player
        </button>
      </div>
      <table className="ptable">
        <thead>
          <tr>
            <th />
            <th>Player</th>
            <th>Country</th>
            <th>Position</th>
            <th>Club / status</th>
            <th>Career</th>
            <th>Last used</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id} onClick={() => setEditing(r)}>
              <td>{r.imagePath ? <img className="face" src={`/${r.imagePath}`} alt="" /> : <div className="face none">{r.name[0]}</div>}</td>
              <td>
                <b>{r.name}</b>
              </td>
              <td>
                <img className="flag" src={`/flags/${r.countryCode.toLowerCase()}.png`} alt="" /> {r.country}
              </td>
              <td>{r.position ? POS[r.position] : '—'}</td>
              <td>
                {r.retired ? (
                  <span className="pill retired">retired</span>
                ) : (
                  <>
                    {r.currentClub} {r.currentClubFresh ? <span className="pill ok" title="confirmed recently">✓</span> : <span className="pill unverified" title="not confirmed — won't be used as a 'plays for now' clue">?</span>}
                  </>
                )}
              </td>
              <td className="small muted">{r.careerClubs.join(' → ')}</td>
              <td className="small">{r.lastUsed ? r.lastUsed.slice(0, 10) : <span className="muted">never</span>}</td>
              <td>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreate(r.id);
                  }}
                >
                  Make video
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <PlayerEditor
          player={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
};

const blank: PlayerRow = {
  id: '',
  name: '',
  country: '',
  countryCode: '',
  currentClub: '',
  currentClubFresh: false,
  careerClubs: [],
  retired: false,
  category: 'men',
  position: 'FWD',
  achievements: [],
};

const PlayerEditor: React.FC<{player: PlayerRow | null; onClose: () => void; onSaved: () => void}> = ({player, onClose, onSaved}) => {
  const [p, setP] = useState<PlayerRow>(player ?? blank);
  const [clubsText, setClubsText] = useState((player?.careerClubs ?? []).join('\n'));
  const [full, setFull] = useState<PlayerRow | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (player) api.get<PlayerRow>(`/api/players/${player.id}`).then((d) => {
      setFull(d);
      setP(d);
    });
  }, [player]);

  const ach = (type: string): Achievement => p.achievements.find((a) => a.type === type) ?? {type, count: 0, years: []};
  const setAch = (type: string, patch: Partial<Achievement>) => {
    const next = {...ach(type), ...patch};
    setP({...p, achievements: [...p.achievements.filter((a) => a.type !== type), next]});
  };
  const save = async () => {
    setErr('');
    const body = {...p, careerClubs: clubsText.split('\n').map((s) => s.trim()).filter(Boolean)};
    try {
      if (player) await api.put(`/api/players/${player.id}`, body);
      else await api.post('/api/players', body);
      onSaved();
    } catch (e) {
      setErr(String(e));
    }
  };
  const confirmClub = async () => {
    try {
      await api.post(`/api/players/${p.id}/confirm-club`, {club: p.currentClub});
      onSaved();
    } catch (e) {
      setErr(String(e));
    }
  };
  const prov = (k: string) => {
    const s = full?.provenance?.[k];
    return s ? <span className={`prov ${s.source}`} title={s.detail || s.sourceUrl || ''}>{s.source}</span> : null;
  };

  return (
    <div className="drawer-bg" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <h2>{player ? `Edit ${player.name}` : 'Add a player'}</h2>
        <p className="muted small">
          Your edits are marked <span className="prov manual">manual</span> and are never overwritten when the master list is re-imported.
        </p>
        <div className="form-grid">
          <label>
            Name {prov('name')}
            <input value={p.name} onChange={(e) => setP({...p, name: e.target.value})} />
          </label>
          <label>
            Spoken name (pronunciation)
            <input value={p.spokenName ?? ''} placeholder="e.g. Em-bah-pay" onChange={(e) => setP({...p, spokenName: e.target.value || null})} />
          </label>
          <label>
            Country {prov('country')}
            <input value={p.country} onChange={(e) => setP({...p, country: e.target.value})} />
          </label>
          <label>
            Country code (flag)
            <input value={p.countryCode} placeholder="BR, GB-ENG…" onChange={(e) => setP({...p, countryCode: e.target.value.toUpperCase()})} />
          </label>
          <label>
            Position {prov('position')}
            <select value={p.position ?? ''} onChange={(e) => setP({...p, position: e.target.value || null})}>
              <option value="">unknown</option>
              {Object.entries(POS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Born
            <input type="date" value={p.dob ?? ''} onChange={(e) => setP({...p, dob: e.target.value || null})} />
          </label>
          <label className="check">
            <input type="checkbox" checked={p.retired} onChange={(e) => setP({...p, retired: e.target.checked})} /> Retired
          </label>
          <label>
            Category
            <select value={p.category} onChange={(e) => setP({...p, category: e.target.value})}>
              <option value="men">Men's football</option>
              <option value="women">Women's football</option>
            </select>
          </label>
          {!p.retired && (
            <label>
              Current club {prov('current_club')}
              <input value={p.currentClub ?? ''} onChange={(e) => setP({...p, currentClub: e.target.value})} />
              {player && (
                <span className="small">
                  {p.currentClubVerifiedAt ? `confirmed ${p.currentClubVerifiedAt}` : 'not confirmed'}{' '}
                  <button className="link" onClick={confirmClub}>
                    ✓ confirm it's correct today
                  </button>
                </span>
              )}
            </label>
          )}
          <label>
            Best-known club {prov('primary_club')}
            <input value={p.primaryClub ?? ''} onChange={(e) => setP({...p, primaryClub: e.target.value || null})} />
          </label>
        </div>
        <label>
          Career clubs, in order (one per line) {prov('career_clubs')}
          <textarea rows={6} value={clubsText} onChange={(e) => setClubsText(e.target.value)} />
        </label>
        <h3>Trophies</h3>
        <div className="form-grid">
          {ACH.map((a) => (
            <label key={a.type}>
              {a.label} {ach(a.type).provenance ? <span className={`prov ${ach(a.type).provenance!.source}`}>{ach(a.type).provenance!.source}</span> : null}
              <span className="inline">
                <input type="number" min={0} style={{width: 70}} value={ach(a.type).count} onChange={(e) => setAch(a.type, {count: +e.target.value})} />
                <input
                  placeholder="years, e.g. 2005"
                  value={ach(a.type).years.join(', ')}
                  onChange={(e) => setAch(a.type, {years: e.target.value.split(/[ ,]+/).filter(Boolean).map(Number).filter((n) => !isNaN(n))})}
                />
              </span>
            </label>
          ))}
        </div>
        <label>
          Notes
          <textarea rows={2} value={p.notes ?? ''} onChange={(e) => setP({...p, notes: e.target.value || null})} />
        </label>
        {p.imageCredit && (
          <p className="small muted">
            Photo: {p.imageCredit.author} · {p.imageCredit.license}
          </p>
        )}
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button className="primary" onClick={save}>
            Save
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};
