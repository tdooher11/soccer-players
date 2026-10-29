import type {VideoProps} from '../shared/types';

export type Visual = {kind: 'flag'; code: string} | {kind: 'club'; club: Club} | {kind: 'icon'; icon: string} | {kind: 'none'};
export type Club = {name: string; short: string; c1: string; c2: string; ink: string};
export type ClueQ = {text: string; speech?: string | null; visual: Visual; fact?: string | null; source?: string | null};
export type Question = {
  id: string;
  format: string;
  difficulty: string;
  playerId?: string | null;
  playerIds: string[];
  title: string;
  question?: string | null;
  introSpeech?: string | null;
  clues: ClueQ[];
  chips: unknown[];
  answer: {title: string; spoken?: string | null; subtitle: string; flagCode?: string | null; imageSrc?: string | null; club?: Club | null; jerseyNumber?: number | null; details: string[]; verdict?: string | null; versus?: unknown};
  revealSpeech?: string | null;
  outroSpeech?: string | null;
  durationSeconds: number;
  fingerprint?: string | null;
  warnings: string[];
  createdAt?: string;
};
export type Settings = {
  theme: 'stadium-gold' | 'electric-blue' | 'night-match';
  textScale: number;
  narration: boolean;
  ttsProvider: string | null;
  voice: string | null;
  speechSpeed: number;
  music: boolean;
  musicVolume: number;
  sfxVolume: number;
  showAnswerImage: boolean;
  countdownSeconds: number;
  fps: number;
};
export const DEFAULT_SETTINGS: Settings = {
  theme: 'stadium-gold',
  textScale: 1,
  narration: true,
  ttsProvider: null,
  voice: null,
  speechSpeed: 1,
  music: true,
  musicVolume: 0.22,
  sfxVolume: 1,
  showAnswerImage: true,
  countdownSeconds: 3,
  fps: 30,
};
export type Achievement = {type: string; count: number; years: number[]; label?: string | null; provenance?: {source: string; sourceUrl?: string | null}};
export type PlayerRow = {
  id: string;
  name: string;
  spokenName?: string | null;
  country: string;
  countryCode: string;
  currentClub?: string | null;
  currentClubVerifiedAt?: string | null;
  currentClubFresh: boolean;
  primaryClub?: string | null;
  careerClubs: string[];
  retired: boolean;
  category: string;
  position?: string | null;
  dob?: string | null;
  died?: string | null;
  jerseyNumber?: number | null;
  achievements: Achievement[];
  funFact?: string | null;
  imagePath?: string | null;
  imageCredit?: {author?: string; license?: string; sourceUrl?: string} | null;
  notes?: string | null;
  lastUsed?: string | null;
  provenance?: Record<string, {source: string; detail?: string; sourceUrl?: string}>;
};
export type BuildResult = {
  props: VideoProps;
  report: {actual_seconds: number; target_seconds: number; speech_speed: number; tts_provider: string; tts_voice: string; scenes: {id: string; seconds: number; speech: string | null}[]};
  warnings: string[];
  cost: {provider: string; paid: boolean; chars: number; estimatedUsd: number};
  buildSeconds: number;
};
export type Job = {id: string; kind: string; status: string; stage: string; progress: Record<string, number>; error?: string; result?: {batchId: string; rendered: any[]; failed: any[]; skipped: string[]}; meta: any};
export type History = {
  id: string;
  createdAt: string;
  status: string;
  format: string;
  difficulty: string;
  playerIds: string[];
  clues: string[];
  answer: string;
  outputDir: string;
  title?: string;
  error?: string | null;
  durationSeconds: number;
  warnings: string[];
  thumbnail: string | null;
  videoUrl: string | null;
  downloadUrl: string | null;
  downloadName: string | null;
  metadataUrl: string | null;
  batchId?: string | null;
};
export type TTSProvider = {name: string; paid: boolean; available: boolean; reason: string; voices: {id: string; label: string}[]; defaultVoice: string | null; usdPerMillionChars: number};

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {method, headers: body ? {'Content-Type': 'application/json'} : undefined, body: body ? JSON.stringify(body) : undefined});
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`;
    try {
      const j = await r.json();
      msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* not json */
    }
    throw new Error(msg);
  }
  return r.json();
}

export const api = {
  get: <T,>(url: string) => req<T>('GET', url),
  post: <T,>(url: string, body?: unknown) => req<T>('POST', url, body ?? {}),
  put: <T,>(url: string, body: unknown) => req<T>('PUT', url, body),
};
