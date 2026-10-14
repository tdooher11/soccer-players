import type {ThemeId} from '../shared/types';

export type Theme = {
  id: ThemeId;
  bgDeep: string;
  bgMid: string;
  bgGlow: string;
  pitchLine: string;
  accent: string;
  accentSoft: string;
  accent2: string;
  text: string;
  textDim: string;
  card: string;
  cardBorder: string;
  cardActive: string;
  danger: string;
  confetti: string[];
};

const base = {
  text: '#ffffff',
  textDim: 'rgba(255,255,255,0.72)',
  danger: '#ff4d4d',
};

export const THEMES: Record<ThemeId, Theme> = {
  'stadium-gold': {
    ...base,
    id: 'stadium-gold',
    bgDeep: '#03140b',
    bgMid: '#0a3d22',
    bgGlow: '#1f9d55',
    pitchLine: 'rgba(255,255,255,0.10)',
    accent: '#ffc928',
    accentSoft: 'rgba(255,201,40,0.18)',
    accent2: '#36e27a',
    card: 'rgba(5, 32, 18, 0.78)',
    cardBorder: 'rgba(255,255,255,0.14)',
    cardActive: 'rgba(10, 62, 34, 0.94)',
    confetti: ['#ffc928', '#ffffff', '#36e27a', '#2bb3ff', '#ff5a7a'],
  },
  'electric-blue': {
    ...base,
    id: 'electric-blue',
    bgDeep: '#02130d',
    bgMid: '#073a28',
    bgGlow: '#13b37a',
    pitchLine: 'rgba(255,255,255,0.10)',
    accent: '#2bd4ff',
    accentSoft: 'rgba(43,212,255,0.18)',
    accent2: '#7dff6b',
    card: 'rgba(3, 28, 22, 0.8)',
    cardBorder: 'rgba(255,255,255,0.14)',
    cardActive: 'rgba(6, 56, 44, 0.94)',
    confetti: ['#2bd4ff', '#ffffff', '#7dff6b', '#ffc928', '#b388ff'],
  },
  'night-match': {
    ...base,
    id: 'night-match',
    bgDeep: '#050a14',
    bgMid: '#0b2a26',
    bgGlow: '#1a7f5a',
    pitchLine: 'rgba(255,255,255,0.08)',
    accent: '#ffd84a',
    accentSoft: 'rgba(255,216,74,0.16)',
    accent2: '#4ce0ff',
    card: 'rgba(8, 18, 30, 0.82)',
    cardBorder: 'rgba(255,255,255,0.13)',
    cardActive: 'rgba(14, 40, 52, 0.95)',
    confetti: ['#ffd84a', '#ffffff', '#4ce0ff', '#36e27a', '#ff7ab6'],
  },
};

export const getTheme = (id: ThemeId): Theme => THEMES[id] ?? THEMES['stadium-gold'];

/** Typography system. Sizes are in px at 1080x1920 and multiplied by textScale. */
export const FONT_DISPLAY = 'Montserrat, sans-serif';
export const FONT_BODY = 'Nunito, sans-serif';

export const TYPE = {
  brand: {family: FONT_DISPLAY, weight: 800, size: 30, tracking: '0.18em'},
  title: {family: FONT_DISPLAY, weight: 900, size: 104},
  clueLabel: {family: FONT_DISPLAY, weight: 800, size: 26, tracking: '0.14em'},
  clue: {family: FONT_BODY, weight: 900, size: 60},
  countdown: {family: FONT_DISPLAY, weight: 900, size: 300},
  answer: {family: FONT_DISPLAY, weight: 900, size: 132},
  answerSub: {family: FONT_BODY, weight: 800, size: 46},
  outro: {family: FONT_DISPLAY, weight: 900, size: 92},
};
