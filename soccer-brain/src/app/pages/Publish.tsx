import React, {useEffect, useState} from 'react';
import {api, type History} from '../api';

type Defaults = {
  title: string;
  titleOptions: string[];
  description: string;
  tags: string[];
  published: Result | null;
};
type Result = {videoId: string; url: string; studioUrl: string; title: string; privacy: string; publishAt: string | null; locked: boolean};
type Status = {connected: boolean; canUpload: boolean; uploadsLocked: boolean; auditForm: string; channel: {title: string} | null};

/** Next 11:00 local time, formatted for <input type="datetime-local">. */
const next11 = () => {
  const d = new Date();
  if (d.getHours() >= 10) d.setDate(d.getDate() + 1);
  d.setHours(11, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
};

const CopyButton: React.FC<{text: string; label: string}> = ({text, label}) => {
  const [done, setDone] = useState(false);
  return (
    <button
      className="link small"
      onClick={async () => {
        await copy(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? '✓ Copied' : label}
    </button>
  );
};

export const PublishDialog: React.FC<{h: History; onClose: () => void; onPublished: () => void}> = ({h, onClose, onPublished}) => {
  const [d, setD] = useState<Defaults | null>(null);
  const [st, setSt] = useState<Status | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [when, setWhen] = useState<'schedule' | 'now' | 'private'>('schedule');
  const [at, setAt] = useState(next11());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<Result | null>(null);

  useEffect(() => {
    api.get<Defaults>(`/api/youtube/publish/${h.id}`).then((x) => {
      setD(x);
      setTitle(x.title);
      setDesc(x.description);
      setRes(x.published);
    }, (e) => setErr(String(e)));
    api.get<Status>('/api/youtube/status').then(setSt, () => undefined);
  }, [h.id]);

  const publish = async () => {
    setErr('');
    setBusy(true);
    try {
      const r = await api.post<Result>(`/api/youtube/publish/${h.id}`, {
        title,
        description: desc,
        privacy: when === 'now' ? 'public' : 'private',
        publishAt: when === 'schedule' ? new Date(at).toISOString() : null,
      });
      setRes(r);
      onPublished();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const ready = st?.connected && st.canUpload;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <div className="toolbar">
          <h2>Publish to YouTube</h2>
          <button className="link" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="muted small">
          {h.answer} · {h.format.replace('_', ' ')} · {h.durationSeconds?.toFixed(1)}s{st?.channel ? ` → ${st.channel.title}` : ''}
        </p>
        {!d && !err && <p>Loading…</p>}
        {d && (
          <>
            <label>
              <span className="lab-row">
                Title <CopyButton text={title} label="Copy title" />
              </span>
              <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
            </label>
            {d.titleOptions.length > 1 && (
              <div className="title-opts small">
                Other ideas:{' '}
                {d.titleOptions
                  .filter((t) => t !== title)
                  .slice(0, 4)
                  .map((t) => (
                    <button key={t} className="link small" onClick={() => setTitle(t)}>
                      {t}
                    </button>
                  ))}
              </div>
            )}
            <label>
              <span className="lab-row">
                Description <CopyButton text={desc} label="Copy description" />
              </span>
              <textarea rows={9} value={desc} onChange={(e) => setDesc(e.target.value)} />
            </label>
            <p className="muted small">Keep the “Photo:” line — the photo's licence requires the credit.</p>

            {res ? (
              <div className={res.locked ? 'notice warn' : 'notice ok'}>
                <b>{res.locked ? 'Uploaded, but YouTube kept it private.' : res.publishAt ? 'Scheduled! ✓' : 'Published! ✓'}</b>{' '}
                {res.publishAt && !res.locked && `Goes public ${new Date(res.publishAt).toLocaleString()}.`}
                <div>
                  <a href={res.studioUrl} target="_blank" rel="noreferrer">
                    Open in YouTube Studio ↗
                  </a>
                  {' · '}
                  <a href={res.url} target="_blank" rel="noreferrer">
                    View ↗
                  </a>
                </div>
                {res.locked && <Locked form={st?.auditForm} />}
              </div>
            ) : !st ? null : !st.connected ? (
              <p className="notice warn">Connect YouTube in the Analytics tab first — or copy the title and description and upload by hand.</p>
            ) : !st.canUpload ? (
              <p className="notice warn">
                The studio needs permission to upload. <a href="/api/youtube/connect">Reconnect YouTube</a> and allow it (one time).
              </p>
            ) : (
              <>
                <div className="when">
                  <label className="radio">
                    <input type="radio" checked={when === 'schedule'} onChange={() => setWhen('schedule')} /> Schedule for{' '}
                    <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} disabled={when !== 'schedule'} />
                  </label>
                  <label className="radio">
                    <input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} /> Publish now (public)
                  </label>
                  <label className="radio">
                    <input type="radio" checked={when === 'private'} onChange={() => setWhen('private')} /> Upload as private (decide later in YouTube Studio)
                  </label>
                </div>
                {st.uploadsLocked && <Locked form={st.auditForm} />}
                <button className="primary big" onClick={publish} disabled={busy || !ready || !title.trim()}>
                  {busy ? 'Uploading…' : when === 'schedule' ? 'Upload & schedule' : when === 'now' ? 'Upload & publish' : 'Upload as private'}
                </button>
                <p className="muted small">Not made for kids (so comments stay on) · category Sports · uses ~1,600 of your 10,000 daily YouTube API units.</p>
              </>
            )}
          </>
        )}
        {err && <div className="error">{err}</div>}
      </div>
    </div>
  );
};

const Locked: React.FC<{form?: string}> = ({form}) => (
  <p className="small">
    Google keeps videos uploaded through the API <b>private</b> until your Google Cloud project passes the YouTube API audit. Until then, open
    the video in YouTube Studio to check it — or upload by hand with the copy buttons above.{' '}
    {form && (
      <a href={form} target="_blank" rel="noreferrer">
        Apply for the audit ↗
      </a>
    )}
  </p>
);
