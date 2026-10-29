import React, {useEffect, useState} from 'react';
import {api, type History, type Job, type Question, type Settings} from '../api';
import {JobProgress} from './JobProgress';

export const HistoryPage: React.FC<{onEdit: (q: Question, s: Settings) => void}> = ({onEdit}) => {
  const [items, setItems] = useState<History[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const load = () => api.get<History[]>('/api/history').then(setItems);
  useEffect(() => {
    load();
  }, []);
  const failed = items.filter((h) => h.status === 'failed');
  const edit = async (h: History) => {
    const p = await api.get<{question: Question; settings: Settings}>(`/api/history/${h.id}/project`);
    onEdit(p.question, p.settings);
  };
  return (
    <div className="page">
      <div className="toolbar">
        <h2>Videos ({items.length})</h2>
        {failed.length > 0 && (
          <button onClick={async () => setJob(await api.post<Job>('/api/retry', {}))}>Retry {failed.length} failed</button>
        )}
      </div>
      {job && <JobProgress jobId={job.id} onFinished={load} />}
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
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
