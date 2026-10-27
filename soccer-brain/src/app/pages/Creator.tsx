import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {QuizVideo} from '../../remotion/QuizVideo';
import type {VideoProps} from '../../shared/types';
import {api, DEFAULT_SETTINGS, type BuildResult, type ClueQ, type Job, type PlayerRow, type Question, type Settings, type TTSProvider} from '../api';
import type {CreatorSeed} from '../App';
import {JobProgress} from './JobProgress';

const FORMATS = [
  {id: 'guess_player', label: 'Guess the Player', players: 1},
  {id: 'career_path', label: 'Guess the Career Path', players: 1},
  {id: 'who_won_more', label: 'Who Won More?', players: 2},
  {id: 'guess_club', label: 'Guess the Club', players: 3},
  {id: 'true_false', label: 'True or False', players: 1},
];

export const Creator: React.FC<{seed: CreatorSeed}> = ({seed}) => {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [tts, setTts] = useState<TTSProvider[]>([]);
  const [format, setFormat] = useState('guess_player');
  const [playerIds, setPlayerIds] = useState<string[]>(['ronaldinho']);
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration] = useState(20);
  const [extra, setExtra] = useState<{stat?: string; statement?: string; club?: string}>({});
  const [question, setQuestion] = useState<Question | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [build, setBuild] = useState<BuildResult | null>(null);
  const [building, setBuilding] = useState(false);
  const [err, setErr] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    api.get<PlayerRow[]>('/api/players').then(setPlayers);
    api.get<TTSProvider[]>('/api/tts').then(setTts);
  }, []);

  // Seeds from other pages (Players "Make video", History "Open in editor").
  useEffect(() => {
    if (!seed) return;
    if (seed.question) {
      setQuestion(seed.question);
      setFormat(seed.question.format);
      setPlayerIds(seed.question.playerIds.length ? seed.question.playerIds : [seed.question.playerId ?? '']);
      setDifficulty(seed.question.difficulty);
      setDuration(seed.question.durationSeconds);
      if (seed.settings) setSettings({...DEFAULT_SETTINGS, ...seed.settings});
    } else if (seed.playerId) {
      setPlayerIds([seed.playerId]);
      setFormat('guess_player');
      generate([seed.playerId], 'guess_player');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const fmt = FORMATS.find((f) => f.id === format)!;

  const generate = async (ids = playerIds, f = format) => {
    setErr('');
    try {
      const q = await api.post<Question>('/api/questions/generate', {
        format: f,
        playerIds: ids.filter(Boolean),
        difficulty,
        duration,
        seed: Math.floor(Math.random() * 1e6),
        extra,
      });
      setQuestion(q);
    } catch (e) {
      setErr(String(e));
    }
  };

  // Rebuild narration + timeline when content or narration settings change (debounced).
  const audioKey = JSON.stringify([question, settings.narration, settings.ttsProvider, settings.voice, settings.speechSpeed, settings.countdownSeconds]);
  const buildSeq = useRef(0);
  useEffect(() => {
    if (!question) return;
    const my = ++buildSeq.current;
    const t = setTimeout(async () => {
      setBuilding(true);
      try {
        const r = await api.post<BuildResult>('/api/projects/build', {question, settings});
        if (my === buildSeq.current) {
          setBuild(r);
          setErr('');
        }
      } catch (e) {
        if (my === buildSeq.current) setErr(String(e));
      } finally {
        if (my === buildSeq.current) setBuilding(false);
      }
    }, 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioKey]);

  // Visual-only settings are applied instantly, without a backend round-trip.
  const props: VideoProps | null = useMemo(() => {
    if (!build) return null;
    const p = build.props;
    return {
      ...p,
      theme: settings.theme,
      textScale: settings.textScale,
      showAnswerImage: settings.showAnswerImage,
      answer: {...p.answer, imageSrc: settings.showAnswerImage ? question?.answer.imageSrc ?? null : null},
      audio: {...p.audio, music: settings.music ? {src: 'audio/music/stadium-pulse.mp3', volume: settings.musicVolume} : null, sfxVolume: settings.sfxVolume},
    };
  }, [build, settings, question]);

  const seek = (frame: number) => {
    playerRef.current?.pause();
    playerRef.current?.seekTo(frame);
  };

  const updateClue = (i: number, patch: Partial<ClueQ>) => {
    if (!question) return;
    const clues = question.clues.map((c, j) => (j === i ? {...c, ...patch, ...(patch.text !== undefined ? {fact: null, source: 'edited by hand'} : {})} : c));
    setQuestion({...question, clues});
  };
  const moveClue = (i: number, d: number) => {
    if (!question) return;
    const clues = [...question.clues];
    const [c] = clues.splice(i, 1);
    clues.splice(i + d, 0, c);
    setQuestion({...question, clues});
  };

  const render = async () => {
    if (!question) return;
    setErr('');
    try {
      setJob(await api.post<Job>('/api/renders', {question, settings}));
    } catch (e) {
      setErr(String(e));
    }
  };

  const voices = tts.find((p) => p.name === (settings.ttsProvider ?? 'kokoro'))?.voices ?? [];
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name)), [players]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({...s, [k]: v}));

  return (
    <div className="creator">
      <section className="panel controls">
        <h2>1 · Question</h2>
        <div className="form-grid">
          <label>
            Format
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option>easy</option>
              <option>medium</option>
              <option>hard</option>
            </select>
          </label>
          {Array.from({length: fmt.players}).map((_, i) => (
            <label key={i}>
              {fmt.players > 1 ? `Player ${i + 1}${format === 'guess_club' && i > 0 ? ' (optional)' : ''}` : 'Player'}
              <select
                value={playerIds[i] ?? ''}
                onChange={(e) => {
                  const ids = [...playerIds];
                  ids[i] = e.target.value;
                  setPlayerIds(ids.slice(0, fmt.players));
                }}
              >
                <option value="">— choose —</option>
                {sortedPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {format === 'who_won_more' && (
            <label>
              Compare
              <select value={extra.stat ?? ''} onChange={(e) => setExtra({...extra, stat: e.target.value || undefined})}>
                <option value="">auto</option>
                <option value="ballon_dor">Ballon d'Or awards</option>
                <option value="champions_league">Champions Leagues</option>
                <option value="world_cup">World Cups</option>
              </select>
            </label>
          )}
          {format === 'true_false' && (
            <label>
              Club to ask about (optional)
              <input value={extra.statement ?? ''} placeholder="auto" onChange={(e) => setExtra({...extra, statement: e.target.value || undefined})} />
            </label>
          )}
          <label>
            Target length: {duration}s
            <input type="range" min={14} max={30} step={1} value={duration} onChange={(e) => setDuration(+e.target.value)} />
          </label>
        </div>
        <button className="primary" onClick={() => generate()} disabled={!playerIds.filter(Boolean).length}>
          {question ? '↻ New clues' : 'Generate clues'}
        </button>

        {question && (
          <>
            <h3>Clues {question.format === 'guess_player' && <span className="muted small">(vague → give-away)</span>}</h3>
            {question.question !== null && question.question !== undefined && (
              <label>
                Question line
                <input value={question.question ?? ''} onChange={(e) => setQuestion({...question, question: e.target.value})} />
              </label>
            )}
            {question.clues.map((c, i) => (
              <div key={i} className="clue-edit">
                <span className="num">{i + 1}</span>
                <div className="grow">
                  <input value={c.text} onChange={(e) => updateClue(i, {text: e.target.value})} />
                  <input
                    className="speech"
                    placeholder="narrator says (optional, if different)"
                    value={c.speech ?? ''}
                    onChange={(e) => setQuestion({...question, clues: question.clues.map((x, j) => (j === i ? {...x, speech: e.target.value || null} : x))})}
                  />
                  <div className="small muted">
                    {c.visual.kind === 'flag' ? `🏳 flag ${c.visual.code}` : c.visual.kind === 'club' ? `🛡 ${c.visual.club.name}` : c.visual.kind === 'icon' ? `★ ${c.visual.icon}` : 'no icon'} ·{' '}
                    {c.fact ? <span title={c.source ?? ''}>fact: {c.fact} ({c.source})</span> : <span className="warn">custom — check it's true</span>}
                  </div>
                </div>
                <div className="clue-btns">
                  <SpeakButton text={(i === 0 && question.introSpeech ? question.introSpeech + ' ' : '') + (c.speech || c.text)} settings={settings} />
                  <button disabled={i === 0} onClick={() => moveClue(i, -1)}>
                    ↑
                  </button>
                  <button disabled={i === question.clues.length - 1} onClick={() => moveClue(i, 1)}>
                    ↓
                  </button>
                  <button onClick={() => setQuestion({...question, clues: question.clues.filter((_, j) => j !== i)})}>✕</button>
                </div>
              </div>
            ))}
            {question.clues.length < 5 && (
              <button className="link" onClick={() => setQuestion({...question, clues: [...question.clues, {text: 'New clue', visual: {kind: 'none'}}]})}>
                ＋ add clue
              </button>
            )}
            <h3>Answer</h3>
            <div className="form-grid">
              <label>
                Shown as
                <input value={question.answer.title} onChange={(e) => setQuestion({...question, answer: {...question.answer, title: e.target.value}})} />
              </label>
              <label>
                Subtitle
                <input value={question.answer.subtitle} onChange={(e) => setQuestion({...question, answer: {...question.answer, subtitle: e.target.value}})} />
              </label>
              <label>
                Narrator says
                <input
                  value={question.revealSpeech ?? ''}
                  placeholder={`It's ${question.answer.spoken ?? question.answer.title}!`}
                  onChange={(e) => setQuestion({...question, revealSpeech: e.target.value || null})}
                />
              </label>
              <label>
                Opening line
                <input value={question.introSpeech ?? ''} onChange={(e) => setQuestion({...question, introSpeech: e.target.value || null})} />
              </label>
            </div>
          </>
        )}

        <h2>2 · Look &amp; sound</h2>
        <div className="form-grid">
          <label>
            Theme
            <select value={settings.theme} onChange={(e) => set('theme', e.target.value as Settings['theme'])}>
              <option value="stadium-gold">Stadium gold</option>
              <option value="electric-blue">Electric blue</option>
              <option value="night-match">Night match</option>
            </select>
          </label>
          <label>
            Text size: {Math.round(settings.textScale * 100)}%
            <input type="range" min={0.8} max={1.3} step={0.05} value={settings.textScale} onChange={(e) => set('textScale', +e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.narration} onChange={(e) => set('narration', e.target.checked)} /> Narration
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.showAnswerImage} onChange={(e) => set('showAnswerImage', e.target.checked)} /> Answer photo
          </label>
          <label>
            Voice engine
            <select value={settings.ttsProvider ?? 'kokoro'} onChange={(e) => setSettings((s) => ({...s, ttsProvider: e.target.value, voice: null}))}>
              {tts.map((p) => (
                <option key={p.name} value={p.name} disabled={!p.available}>
                  {p.name} {p.paid ? `(paid ~$${p.usdPerMillionChars}/1M chars)` : '(free, local)'} {p.available ? '' : '— not set up'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Voice
            <select value={settings.voice ?? ''} onChange={(e) => set('voice', e.target.value || null)}>
              <option value="">default</option>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Speaking speed: {settings.speechSpeed.toFixed(2)}×
            <input type="range" min={0.8} max={1.25} step={0.05} value={settings.speechSpeed} onChange={(e) => set('speechSpeed', +e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.music} onChange={(e) => set('music', e.target.checked)} /> Background music
          </label>
          <label>
            Music volume
            <input type="range" min={0} max={0.6} step={0.02} value={settings.musicVolume} onChange={(e) => set('musicVolume', +e.target.value)} />
          </label>
          <label>
            Sound effects
            <input type="range" min={0} max={1.5} step={0.05} value={settings.sfxVolume} onChange={(e) => set('sfxVolume', +e.target.value)} />
          </label>
        </div>
      </section>

      <section className="panel preview">
        <div className="preview-head">
          <h2>3 · Preview</h2>
          {building && <span className="muted">updating narration…</span>}
          {build && (
            <span className="muted small">
              {build.report.actual_seconds.toFixed(1)}s · {build.report.tts_provider}/{build.report.tts_voice}
              {build.cost.paid ? ` · est. $${build.cost.estimatedUsd.toFixed(3)}` : ' · $0'}
            </span>
          )}
        </div>
        {props ? (
          <>
            <div className="player-wrap">
              <Player
                ref={playerRef}
                component={QuizVideo}
                inputProps={props}
                durationInFrames={props.timeline.totalFrames}
                compositionWidth={1080}
                compositionHeight={1920}
                fps={props.fps}
                controls
                clickToPlay
                style={{width: '100%', height: '100%'}}
                acknowledgeRemotionLicense
              />
            </div>
            <div className="scenes">
              {props.timeline.scenes.map((s) => (
                <button key={s.id} onClick={() => seek(s.from + Math.min(s.durationInFrames - 1, Math.round(s.durationInFrames * 0.6)))}>
                  {s.id.replace('-', ' ')} <span className="muted">{(s.durationInFrames / props.fps).toFixed(1)}s</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="placeholder">Pick a player and generate clues to see the preview.</div>
        )}
        {[...(build?.warnings ?? [])].map((w, i) => (
          <div key={i} className="warn">
            ⚠ {w}
          </div>
        ))}
        {err && <div className="error">{err}</div>}
        <button className="primary big" disabled={!question || building || (!!job && ['queued', 'running'].includes(job.status))} onClick={render}>
          🎬 Render MP4
        </button>
        {job && <JobProgress jobId={job.id} onFinished={setJob} />}
      </section>
    </div>
  );
};

const SpeakButton: React.FC<{text: string; settings: Settings}> = ({text, settings}) => {
  const [busy, setBusy] = useState(false);
  const play = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api.post<{src: string}>('/api/tts/preview', {text, provider: settings.ttsProvider, voice: settings.voice, speed: settings.speechSpeed});
      await new Audio(r.src).play();
    } finally {
      setBusy(false);
    }
  }, [text, settings.ttsProvider, settings.voice, settings.speechSpeed]);
  return (
    <button title="Hear the narration" onClick={play} disabled={busy}>
      {busy ? '…' : '▶'}
    </button>
  );
};
