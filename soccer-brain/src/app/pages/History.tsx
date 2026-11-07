import React, {useEffect, useState} from 'react';
import {api, type History, type Job, type Question, type Settings} from '../api';
import {JobProgress} from './JobProgress';
import {PublishDialog} from './Publish';

export const HistoryPage: React.FC<{onEdit: (q: Question, s: Settings) => void}> = ({onEdit}) => {
  const [items, setItems] = useState<History[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<History | null>(null);
  const load = () => api.get<History[]>('/api/history').then(setItems);
  useEffect(() => {
    load();
  }, []);
  const failed = items.filter((h) => h.status === 'failed');
  const [importMsg, setImportMsg] = useState('');
  const importZip = async (f: File) => {
    setImportMsg('Importing…');
    try {
      const r = await fetch('/api/history/import', {method: 'POST', headers: {'Content-Type': 'application/zip'}, body: f});
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail ?? r.statusText);
      setImportMsg(j.alreadyImported ? `${j.answer} is already in your studio.` : `✓ Imported ${j.answer}.`);
      load();
    } catch (e) {
      setImportMsg(`Couldn't import: ${e instanceof Error ? e.message : e}`);
    }
  };
  const edit = async (h: History) => {
    const p = await api.get<{question: Question; settings: Settings}>(`/api/history/${h.id}/project`);
    onEdit(p.question, p.settings);
  };
  return (
    <div className="page">
      <div className="toolbar">
        <h2>Videos ({items.length})</h2>
        <label className="button-like" title="Add a video someone (e.g. Claude) rendered elsewhere, from its .zip">
          ⬆ Import video (.zip)
          <input
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importZip(f);
              e.target.value = '';
            }}
          />
        </label>
        {importMsg && <span className="small">{importMsg}</span>}
        {failed.length > 0 && (
          <button onClick={async () => setJob(await api.post<Job>('/api/retry', {}))}>Retry {failed.length} failed</button>
        )}
      </div>
      {job && <JobProgress jobId={job.id} onFinished={load} />}
      {publishing && <PublishDialog h={publishing} onClose={() => setPublishing(null)} onPublished={load} />}
      <div className="grid">
        {items.map((h) => (
          <div key={h.id} className="vcard">
            {playing === h.id && h.videoUrl ? (
              <video src={h.videoUrl} controls autoPlay className="thumb" />
            ) : h.thumbnail ? (
              <img src={h.thumbnail} className="thumb" onClick={() => setPlaying(h.id)} alt="" />
            ) : (
              <div className="thumb empty">{h.status}</div>
            )}
            <div className="vbody">
              <div>
                <span className={`pill ${h.status}`}>{h.status}</span> <b>{h.answer}</b>
              </div>
              <div className="muted small">
                {h.format.replace('_', ' ')} · {h.difficulty} · {h.durationSeconds?.toFixed(1)}s · {h.createdAt.replace('T', ' ')}
              </div>
              {h.title && <div className="small">“{h.title}”</div>}
              {h.error && <div className="error small">{h.error.slice(0, 240)}</div>}
              {h.warnings?.length > 0 && <div className="warn small">⚠ {h.warnings.join(' · ')}</div>}
              <div className="actions">
                {h.downloadUrl && (
                  <a href={h.downloadUrl} download={h.downloadName ?? true}>
                    Download MP4
                  </a>
                )}
                {h.metadataUrl && (
                  <a href={h.metadataUrl} target="_blank" rel="noreferrer">
                    Metadata
                  </a>
                )}
                <button className="link" onClick={() => edit(h)}>
                  Open in editor
                </button>
                {h.status === 'rendered' && h.videoUrl && (
                  h.youtubeId ? (
                    <>
                      <a href={`https://youtube.com/shorts/${h.youtubeId}`} target="_blank" rel="noreferrer">
                        On YouTube ↗
                      </a>
                      <button className="link" onClick={() => setPublishing(h)}>
                        Title &amp; description
                      </button>
                    </>
                  ) : (
                    <button className="primary small-btn" onClick={() => setPublishing(h)}>
                      ▶ Publish to YouTube
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
