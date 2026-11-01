import React, {useEffect, useMemo, useState} from 'react';
import {api, type History} from '../api';

type Scene = {id: string; label: string; start: number; end: number; watchingAtStart: number | null; watchingAtEnd: number | null};
type VideoRow = {
  id: string;
  url: string;
  title: string;
  thumbnail: string | null;
  publishedAt: string;
  durationSeconds: number | null;
  privacy: string | null;
  historyId: string | null;
  linkState: 'linked' | 'not-ours' | 'unlinked';
  views: number;
  engagedViews: number | null;
  avgViewPercentage: number | null;
  avgViewDuration: number | null;
  likes: number;
  comments: number;
  subscribersGained: number | null;
  earlyViews: number | null;
  likeRate: number | null;
  commentRate: number | null;
  cluesNeeded: Record<string, number>;
  retention: [number, number][];
  made?: Record<string, string | number | null>;
  answer?: string;
  clueTexts?: string[];
  scenes?: Scene[];
  reachedReveal?: number | null;
};
type Group = {value: string; n: number} & Record<string, number | string | null>;
type Report = {
  status: Status;
  videos: VideoRow[];
  ours: number;
  comparisons: {key: string; label: string; groups: Group[]}[];
  metrics: {key: string; label: string}[];
  sceneDrops: {id: string; label: string; n: number; avgDrop: number}[];
  cluesNeeded: Record<string, number>;
  insights: string[];
};
type Status = {configured: boolean; connected: boolean; channel: {title: string; subscribers: number} | null; syncedAt: string | null; videos: number};

const MIN_GROUP = 3;
const pct = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? '–' : `${(v * 100).toFixed(digits)}%`);
const num = (v: number | null | undefined) =>
  v === null || v === undefined ? '–' : v >= 10 || Number.isInteger(v) ? Math.round(v).toLocaleString() : v.toFixed(1);
const MADE_LABEL: Record<string, string> = {
  format: 'Format',
  difficulty: 'Difficulty',
  clues: 'Clues',
  length: 'Length',
  theme: 'Look',
  voice: 'Voice',
  speechSpeed: 'Narration speed',
  player: 'Player',
  playerType: 'Type of player',
  weekday: 'Day posted',
  postedHour: 'Time posted',
};
const fmtMetric = (key: string, v: number | string | null) =>
  typeof v !== 'number' ? '–' : key === 'reachedReveal' ? pct(v) : key === 'avgViewPercentage' ? `${v.toFixed(0)}%` : num(v);

export const Analytics: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    try {
      const s = await api.get<Status>('/api/youtube/status');
      setStatus(s);
      if (s.syncedAt) setReport(await api.get<Report>('/api/youtube/report'));
    } catch (e) {
      setErr(String(e));
    }
  };
  useEffect(() => {
    load();
    api.get<History[]>('/api/history').then(setHistory, () => undefined);
  }, []);

  const sync = async () => {
    setErr('');
    setBusy('Syncing with YouTube… (a few seconds per video)');
    try {
      await api.post('/api/youtube/sync');
      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy('');
    }
  };
  const [copied, setCopied] = useState('');
  const copyReport = async () => {
    setErr('');
    try {
      const text = await fetch('/api/youtube/report.txt').then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.text();
      });
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Older browsers / non-secure origins: fall back to a hidden textarea.
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setCopied(`✓ Copied (${Math.round(text.length / 1000)}k characters)`);
      setTimeout(() => setCopied(''), 4000);
    } catch (e) {
      setErr(`Couldn't copy: ${e}`);
    }
  };
  // historyId: a render id, null = "not a studio video", '' = forget the choice (re-match automatically).
  const link = async (videoId: string, historyId: string | null) => {
    try {
      setReport(await api.post<Report>('/api/youtube/link', {videoId, historyId}));
    } catch (e) {
      setErr(String(e));
    }
  };

  if (!status) return <div className="page">{err ? <div className="error">{err}</div> : 'Loading…'}</div>;
  if (!status.configured || !status.connected) return <Setup status={status} onSaved={load} />;

  const rendered = history.filter((h) => h.status === 'rendered' && h.videoUrl);
  return (
    <div className="page analytics">
      <section className="panel">
        <div className="yt-head">
          <div>
            <h2>📈 {status.channel?.title ?? 'Your channel'}</h2>
            <div className="muted small">
              {status.channel ? `${status.channel.subscribers.toLocaleString()} subscribers · ` : ''}
              {status.syncedAt ? `last synced ${status.syncedAt.replace('T', ' ')}` : 'not synced yet'} · views, likes &amp; comments are live; watch time and retention lag ~2 days
            </div>
          </div>
          <div className="yt-actions">
            <button className="primary" onClick={sync} disabled={!!busy}>
              ↻ Sync now
            </button>
            <button onClick={copyReport} disabled={!status.syncedAt} title="Copies the whole report as text — paste it into your chat with Claude">
              {copied || '📋 Copy report for Claude'}
            </button>
            <a href="/api/youtube/connect" className="small" title="Sign in again (needed if Google says the sign-in expired)">
              Reconnect
            </a>
            <button
              className="link"
              onClick={async () => {
                await api.post('/api/youtube/disconnect');
                load();
              }}
            >
              Disconnect
            </button>
          </div>
        </div>
        {busy && <p className="muted">{busy}</p>}
        {err && <div className="error">{err}</div>}
      </section>

      {report && (
        <>
          <section className="panel">
            <h2>What the numbers say</h2>
            {report.insights.length ? (
              <ul className="insights">
                {report.insights.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Sync after a few videos have been up for a couple of days.</p>
            )}
          </section>

          <div className="row2">
            <section className="panel">
              <h2>Where viewers leave</h2>
              <p className="muted small">Average share of the audience lost during each part of the video ({report.ours} studio videos).</p>
              <SceneDrops drops={report.sceneDrops} />
            </section>
            <section className="panel">
              <h2>How many clues people needed</h2>
              <p className="muted small">Read from comments like “3!” or “got it on the second clue”.</p>
              <ClueVotes votes={report.cluesNeeded} />
            </section>
          </div>

          <section className="panel">
            <h2>Compare what you've tried</h2>
            <p className="muted small">
              Middle value (median) per option. Rows with fewer than {MIN_GROUP} videos are greyed out — too few to trust.
            </p>
            {report.comparisons.length === 0 && <p className="muted">Nothing to compare yet — try a few variations (clue count, difficulty, look…).</p>}
            {report.comparisons.map((c) => (
              <div key={c.key} className="compare">
                <h3>{c.label}</h3>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Option</th>
                      <th className="r">Videos</th>
                      {report.metrics.map((m) => (
                        <th key={m.key} className="r">
                          {m.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {c.groups.map((g) => (
                      <tr key={g.value} className={g.n < MIN_GROUP ? 'few' : ''}>
                        <td>{g.value}</td>
                        <td className="r">{g.n}</td>
                        {report.metrics.map((m) => (
                          <td key={m.key} className="r">
                            {fmtMetric(m.key, g[m.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>

          <section className="panel">
            <h2>Videos ({report.videos.length})</h2>
            <p className="muted small">
              Uploads are matched to studio renders by file name or title. Pick the right one if a video says “not matched”.
            </p>
            <table className="tbl videos">
              <thead>
                <tr>
                  <th>Video</th>
                  <th>Studio render</th>
                  <th className="r">Views</th>
                  <th className="r">First 2 days</th>
                  <th className="r">Avg % watched</th>
                  <th className="r">At reveal</th>
                  <th className="r">Likes</th>
                  <th className="r">Comments</th>
                </tr>
              </thead>
              <tbody>
                {report.videos.map((v) => (
                  <React.Fragment key={v.id}>
                    <tr className={open === v.id ? 'open' : ''}>
                      <td>
                        <button className="link vid" onClick={() => setOpen(open === v.id ? null : v.id)} title="Show retention">
                          {v.thumbnail && <img src={v.thumbnail} alt="" />}
                          <span>
                            {v.title}
                            <span className="muted small"> · {v.publishedAt.slice(0, 10)}</span>
                          </span>
                        </button>
                      </td>
                      <td>
                        <select
                          className={v.linkState === 'unlinked' ? 'unlinked' : ''}
                          value={v.historyId ?? (v.linkState === 'not-ours' ? '__none' : '')}
                          onChange={(e) => link(v.id, e.target.value === '__none' ? null : e.target.value)}
                        >
                          <option value="">— not matched —</option>
                          <option value="__none">Not a studio video</option>
                          {rendered.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.createdAt.slice(0, 10)} · {h.answer} · {h.format.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="r">{num(v.views)}</td>
                      <td className="r">{num(v.earlyViews)}</td>
                      <td className="r">{v.avgViewPercentage === null ? '–' : `${v.avgViewPercentage.toFixed(0)}%`}</td>
                      <td className="r">{pct(v.reachedReveal)}</td>
                      <td className="r">{num(v.likes)}</td>
                      <td className="r">{num(v.comments)}</td>
                    </tr>
                    {open === v.id && (
                      <tr className="detail">
                        <td colSpan={8}>
                          <VideoDetail v={v} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
      {!report && <p className="muted">Press Sync now to pull your channel's numbers.</p>}
    </div>
  );
};

const VideoDetail: React.FC<{v: VideoRow}> = ({v}) => (
  <div className="yt-detail">
    <div>
      <h3>Audience retention</h3>
      {v.retention.length ? (
        <RetentionChart curve={v.retention} scenes={v.scenes ?? []} seconds={v.durationSeconds ?? 0} />
      ) : (
        <p className="muted">YouTube hasn't published retention for this video yet (needs some views and ~2 days).</p>
      )}
    </div>
    <div className="facts">
      {v.made ? (
        <>
          <h3>How it was made</h3>
          <dl>
            {Object.entries(v.made)
              .filter(([, val]) => val !== null)
              .map(([k, val]) => (
                <React.Fragment key={k}>
                  <dt>{MADE_LABEL[k] ?? k}</dt>
                  <dd>{String(val)}</dd>
                </React.Fragment>
              ))}
          </dl>
          {v.clueTexts && (
            <ol className="small">
              {v.clueTexts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <p className="muted">Not matched to a studio render, so there's nothing to compare it on.</p>
      )}
      <p className="small">
        <a href={v.url} target="_blank" rel="noreferrer">
          Open on YouTube ↗
        </a>
        {v.subscribersGained !== null && ` · +${v.subscribersGained} subscribers`}
        {v.engagedViews !== null && v.engagedViews !== undefined && ` · ${num(v.engagedViews)} engaged views`}
      </p>
    </div>
  </div>
);

/** One line (share of viewers still watching) over the video, with the scenes as bands. */
const RetentionChart: React.FC<{curve: [number, number][]; scenes: Scene[]; seconds: number}> = ({curve, scenes, seconds}) => {
  const W = 640,
    H = 240,
    L = 44,
    R = 12,
    T = 26,
    B = 28;
  // Shown as a share of the starting audience (YouTube's ratio starts above 100% because Shorts loop).
  const pts = useMemo(() => {
    const s = [...curve].sort((a, b) => a[0] - b[0]);
    const start = s.length && s[0][1] > 0 ? s[0][1] : 1;
    return s.map(([x, v]) => [x, v / start] as [number, number]);
  }, [curve]);
  const yMax = Math.max(1, ...pts.map((p) => p[1])) * 1.05;
  const x = (r: number) => L + r * (W - L - R);
  const y = (v: number) => T + (1 - v / yMax) * (H - T - B);
  const [hover, setHover] = useState<number | null>(null);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
  const ticks = [0, 0.25, 0.5, 0.75, 1].filter((t) => t <= yMax);
  const hp = hover === null ? null : pts.reduce((best, p) => (Math.abs(p[0] - hover) < Math.abs(best[0] - hover) ? p : best), pts[0]);
  const hs = hp ? scenes.find((s) => hp[0] >= s.start && hp[0] <= s.end) : null;
  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Share of viewers still watching over the length of the video"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          setHover(Math.min(1, Math.max(0, (px - L) / (W - L - R))));
        }}
      >
        {scenes.map((s, i) => (
          <g key={s.id}>
            <rect x={x(s.start)} y={T} width={Math.max(0, x(s.end) - x(s.start))} height={H - T - B} className={i % 2 ? 'band b' : 'band a'} />
            <text x={(x(s.start) + x(s.end)) / 2} y={T - 8} className="band-label" textAnchor="middle">
              {s.label.replace('Clue ', 'C').replace('Countdown', '⏱').replace('Reveal', '★').replace('Comment ask', '💬')}
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 6} y={y(t) + 4} className="axis" textAnchor="end">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {[0, 0.5, 1].map((r) => (
          <text key={r} x={x(r)} y={H - 8} className="axis" textAnchor={r === 0 ? 'start' : r === 1 ? 'end' : 'middle'}>
            {seconds ? `${Math.round(r * seconds)}s` : `${r * 100}%`}
          </text>
        ))}
        <path d={path} className="line" />
        {hp && (
          <g>
            <line x1={x(hp[0])} x2={x(hp[0])} y1={T} y2={H - B} className="cross" />
            <circle cx={x(hp[0])} cy={y(hp[1])} r={5} className="dot" />
          </g>
        )}
      </svg>
      {hp && (
        <div className="tip" style={{left: `${(x(hp[0]) / W) * 100}%`}}>
          <b>{pct(hp[1])}</b> still watching
          <br />
          <span className="muted">
            {seconds ? `${(hp[0] * seconds).toFixed(1)}s` : pct(hp[0])}
            {hs ? ` · ${hs.label}` : ''}
          </span>
        </div>
      )}
      <p className="muted small">Share of the people who started the video that are still watching. A rise at the end means people loop it. Bands: C1–C5 clues, ⏱ countdown, ★ reveal, 💬 comment ask.</p>
    </div>
  );
};

const SceneDrops: React.FC<{drops: Report['sceneDrops']}> = ({drops}) => {
  if (!drops.length) return <p className="muted">Needs retention data from at least one matched video.</p>;
  const max = Math.max(0.01, ...drops.map((d) => Math.abs(d.avgDrop)));
  return (
    <div className="hbars">
      {drops.map((d) => (
        <div key={d.id} className="hbar" title={`${d.label}: ${pct(d.avgDrop, 1)} of viewers left on average (${d.n} videos)`}>
          <span className="lab">{d.label}</span>
          <span className="track">
            <span className="fill" style={{width: `${(Math.max(0, d.avgDrop) / max) * 100}%`}} />
          </span>
          <span className="val">{d.avgDrop >= 0 ? `−${pct(d.avgDrop)}` : `+${pct(-d.avgDrop)}`}</span>
        </div>
      ))}
    </div>
  );
};

const ClueVotes: React.FC<{votes: Record<string, number>}> = ({votes}) => {
  const keys = ['1', '2', '3', '4', '5', 'missed'];
  const total = keys.reduce((s, k) => s + (votes[k] ?? 0), 0);
  if (!total) return <p className="muted">No “how many clues” comments yet.</p>;
  const max = Math.max(...keys.map((k) => votes[k] ?? 0));
  return (
    <div className="hbars">
      {keys.map((k) => (
        <div key={k} className="hbar" title={`${votes[k] ?? 0} comments`}>
          <span className="lab">{k === 'missed' ? "Didn't get it" : `${k} clue${k === '1' ? '' : 's'}`}</span>
          <span className="track">
            <span className="fill" style={{width: `${((votes[k] ?? 0) / max) * 100}%`}} />
          </span>
          <span className="val">{votes[k] ?? 0}</span>
        </div>
      ))}
      <p className="muted small">{total} comments counted.</p>
    </div>
  );
};

const Setup: React.FC<{status: Status; onSaved: () => void}> = ({status, onSaved}) => {
  const [json, setJson] = useState('');
  const [err, setErr] = useState('');
  const save = async () => {
    setErr('');
    try {
      await api.post('/api/youtube/client', {json});
      onSaved();
    } catch (e) {
      setErr(String(e));
    }
  };
  return (
    <div className="page analytics">
      <section className="panel setup">
        <h2>📈 Connect your YouTube channel</h2>
        <p>
          The studio reads your channel's numbers (views, how long people watch, where they swipe away, comments) and compares the
          different kinds of videos you've made. It only <b>reads</b> — it can't upload, edit or delete anything. Everything stays on this
          computer.
        </p>
        {!status.configured ? (
          <>
            <h3>One-time setup (about 10 minutes)</h3>
            <ol>
              <li>
                Open <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">Google Cloud Console</a>{' '}
                signed in with the Google account that owns the channel, and create a project called <b>Soccer Brain</b>.
              </li>
              <li>
                In <b>APIs &amp; Services → Library</b>, turn on <b>YouTube Data API v3</b> and <b>YouTube Analytics API</b>.
              </li>
              <li>
                In <b>Google Auth Platform</b> (the “OAuth consent screen”): app name <i>Soccer Brain Studio</i>, audience <b>External</b>,
                your email as support + contact. Under <b>Audience</b>, add your own Gmail as a <b>test user</b>.
              </li>
              <li>
                Under <b>Clients → Create client</b>, choose application type <b>Desktop app</b>, then <b>Download JSON</b>.
              </li>
              <li>Open that file in Notepad, copy everything, and paste it below.</li>
            </ol>
            <textarea rows={6} placeholder='{"installed":{"client_id":"…","client_secret":"…", …}}' value={json} onChange={(e) => setJson(e.target.value)} />
            <button className="primary" onClick={save} disabled={!json.trim()}>
              Save
            </button>
            {err && <div className="error">{err}</div>}
          </>
        ) : (
          <>
            <p>
              Setup saved. Press Connect and sign in with the channel's Google account. Google will say the app isn't verified — that's
              expected for your own private tool: choose <b>Continue</b>.
            </p>
            <a className="button primary big" href="/api/youtube/connect">
              Connect YouTube
            </a>
          </>
        )}
      </section>
    </div>
  );
};
