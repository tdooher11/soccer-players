import React from 'react';
import {Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import type {Answer, ClubBadge} from '../../shared/types';
import {FONT_DISPLAY, type Theme} from '../theme';
import {ClubShield, Flag} from './Badges';

export const MC_W = 330;
export const MC_H = 440;

const SHAPE = 'polygon(0% 7%, 12% 0%, 88% 0%, 100% 7%, 100% 93%, 88% 100%, 12% 100%, 0% 93%)';

/** Generic, featureless head-and-shoulders silhouette. Reveals nothing. */
const Silhouette: React.FC<{color: string}> = ({color}) => (
  <svg width={MC_W} height={MC_H * 0.78} viewBox="0 0 330 343" style={{position: 'absolute', bottom: 0, left: 0}}>
    <defs>
      <linearGradient id="silh" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.95" />
        <stop offset="100%" stopColor={color} stopOpacity="0.55" />
      </linearGradient>
    </defs>
    <ellipse cx="165" cy="120" rx="64" ry="76" fill="url(#silh)" />
    <path d="M40 343 C44 262 92 220 138 206 L165 232 L192 206 C238 220 286 262 290 343 Z" fill="url(#silh)" />
    <rect x="140" y="180" width="50" height="40" fill="url(#silh)" />
  </svg>
);

export const CardFrame: React.FC<{theme: Theme; children: React.ReactNode; glow?: number}> = ({theme, children, glow = 0.5}) => (
  <div
    style={{
      width: MC_W,
      height: MC_H,
      position: 'relative',
      filter: `drop-shadow(0 22px 40px rgba(0,0,0,0.55)) drop-shadow(0 0 ${30 * glow}px ${theme.accentSoft})`,
    }}
  >
    <div style={{position: 'absolute', inset: 0, clipPath: SHAPE, background: `linear-gradient(150deg, #fff4c4 0%, ${theme.accent} 30%, #9c6b00 60%, ${theme.accent} 85%, #fff4c4 100%)`}} />
    <div style={{position: 'absolute', inset: 9, clipPath: SHAPE, overflow: 'hidden', background: `linear-gradient(170deg, ${theme.bgGlow} 0%, ${theme.bgMid} 45%, ${theme.bgDeep} 100%)`}}>
      {children}
    </div>
  </div>
);

export const MysteryFront: React.FC<{theme: Theme; flags: string[]; clubs: ClubBadge[]; questionPulse: number}> = ({theme, flags, clubs, questionPulse}) => {
  const frame = useCurrentFrame();
  const shimmer = ((frame * 2.2) % 260) - 60;
  return (
    <CardFrame theme={theme}>
      {/* diagonal pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.045) 0 14px, rgba(255,255,255,0) 14px 28px)',
        }}
      />
      <Silhouette color="#03170c" />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 64,
          textAlign: 'center',
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 210,
          lineHeight: 1,
          color: theme.accent,
          transform: `scale(${questionPulse})`,
          textShadow: `0 0 30px ${theme.accent}, 0 8px 0 rgba(0,0,0,0.35)`,
        }}
      >
        ?
      </div>
      {/* attributes collected from clues */}
      <div style={{position: 'absolute', bottom: 22, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12}}>
        {flags.map((f) => (
          <Flag key={f} code={f} height={40} radius={7} />
        ))}
        {clubs.slice(-3).map((c) => (
          <ClubShield key={c.name} club={c} size={46} />
        ))}
      </div>
      {/* shimmer */}
      <div
        style={{
          position: 'absolute',
          top: -100,
          bottom: -100,
          left: `${shimmer}%`,
          width: 70,
          background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.22), rgba(255,255,255,0))',
          transform: 'skewX(-22deg)',
        }}
      />
    </CardFrame>
  );
};

/** A jersey back with surname + number, used when there is no licensed photo. */
const JerseyFallback: React.FC<{answer: Answer; theme: Theme}> = ({answer, theme}) => {
  const c1 = answer.club?.c1 ?? theme.accent;
  const c2 = answer.club?.c2 ?? '#ffffff';
  const ink = answer.club?.ink ?? '#111';
  const surname = answer.title.split(' ').slice(-1)[0];
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <svg width={300} height={330} viewBox="0 0 100 110">
        <path d="M30 6 L12 14 L0 34 L14 44 L20 38 V104 H80 V38 L86 44 L100 34 L88 14 L70 6 C64 14 36 14 30 6 Z" fill={c1} stroke={c2} strokeWidth="2.5" />
        <text x="50" y="38" textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={900} fontSize={surname.length > 9 ? 7.5 : 10} fill={ink}>
          {surname}
        </text>
        <text x="50" y="84" textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={900} fontSize={40} fill={ink} stroke={c2} strokeWidth="0.8">
          {answer.jerseyNumber ?? '★'}
        </text>
      </svg>
    </div>
  );
};

export const RevealedBack: React.FC<{theme: Theme; answer: Answer; showImage: boolean; mode?: 'player' | 'club'}> = ({theme, answer, showImage, mode = 'player'}) => (
  <CardFrame theme={theme} glow={1.2}>
    {mode === 'club' && answer.club ? (
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <ClubShield club={answer.club} size={230} />
      </div>
    ) : showImage && answer.imageSrc ? (
      <Img
        src={answer.imageSrc.startsWith('http') ? answer.imageSrc : staticFile(answer.imageSrc)}
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%'}}
      />
    ) : (
      <JerseyFallback answer={answer} theme={theme} />
    )}
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0))'}} />
    {answer.flagCode ? (
      <div style={{position: 'absolute', left: 26, top: 34}}>
        <Flag code={answer.flagCode} height={44} radius={7} />
      </div>
    ) : null}
    {answer.club && mode === 'player' ? (
      <div style={{position: 'absolute', right: 24, top: 30}}>
        <ClubShield club={answer.club} size={52} />
      </div>
    ) : null}
  </CardFrame>
);

/** Card that flips from mystery front to revealed back. `flip` 0..1. */
export const MysteryCard: React.FC<{
  theme: Theme;
  flip: number;
  flags: string[];
  clubs: ClubBadge[];
  answer: Answer | null;
  showImage: boolean;
  questionPulse: number;
  mode?: 'player' | 'club';
}> = ({theme, flip, flags, clubs, answer, showImage, questionPulse, mode = 'player'}) => {
  const angle = interpolate(flip, [0, 1], [0, 180]);
  const showBack = angle > 90 && answer;
  return (
    <div style={{width: MC_W, height: MC_H, perspective: 1600}}>
      <div style={{width: '100%', height: '100%', position: 'relative', transform: `rotateY(${angle}deg)`, transformStyle: 'preserve-3d'}}>
        <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden'}}>
          {!showBack ? <MysteryFront theme={theme} flags={flags} clubs={clubs} questionPulse={questionPulse} /> : null}
        </div>
        <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)'}}>
          {showBack && answer ? <RevealedBack theme={theme} answer={answer} showImage={showImage} mode={mode} /> : null}
        </div>
      </div>
    </div>
  );
};
