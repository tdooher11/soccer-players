import React, {useEffect, useState} from 'react';
import {api, type Job} from '../api';

/** Polls a render/batch job and shows progress, errors and links. */
export const JobProgress: React.FC<{jobId: string; onFinished?: (j: Job) => void}> = ({jobId, onFinished}) => {
  const [job, setJob] = useState<Job | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: number;
    const tick = async () => {
      try {
        const j = await api.get<Job>(`/api/jobs/${jobId}`);
        if (!alive) return;
        setJob(j);
        if (['queued', 'running'].includes(j.status)) timer = window.setTimeout(tick, 1000);
        else onFinished?.(j);
      } catch {
        timer = window.setTimeout(tick, 2000);
      }
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);
  if (!job) return null;
  const vals = Object.values(job.progress);
  const pct = vals.length ? (vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, job.meta?.count ?? 1)) * 100 : 0;
  return (
    <div className="job">
      <div className="job-head">
        <span className={`pill ${job.status}`}>{job.status}</span> <span className="muted">{job.stage}</span>
      </div>
      {['queued', 'running'].includes(job.status) && (
        <div className="bar">
          <div style={{width: `${pct}%`}} />
        </div>
      )}
      {job.error && <div className="error">{job.error}</div>}
      {job.result && (
        <ul className="job-results">
          {job.result.rendered.map((r: any, i: number) => (
            <li key={i}>
              ✓ {r.video ? <a href={`/output/${r.video}`} target="_blank" rel="noreferrer">{r.outputDir}</a> : r.questionId} {r.title ? <span className="muted">— {r.title}</span> : null}
            </li>
          ))}
          {job.result.failed.map((r: any, i: number) => (
            <li key={`f${i}`} className="error">
              ✗ {r.outputDir}: {(r.error || '').slice(0, 300)}
            </li>
          ))}
          {job.result.skipped.map((s, i) => (
            <li key={`s${i}`} className="muted">
              – {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
