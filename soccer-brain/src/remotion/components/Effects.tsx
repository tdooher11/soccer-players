import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {TYPE, type Theme} from '../theme';

/** Big 3-2-1 with a draining ring. `local` = frames since countdown start. */
export const Countdown: React.FC<{theme: Theme; local: number; durationInFrames: number; size: number}> = ({theme, local, durationInFrames, size}) => {
  const {fps} = useVideoConfig();
  const seconds = Math.max(1, Math.round(durationInFrames / fps));
  const perStep = durationInFrames / seconds;
  const step = Math.min(seconds - 1, Math.floor(local / perStep));
  const stepLocal = local - step * perStep;
  const n = seconds - step;
  const punch = spring({frame: stepLocal, fps, config: {damping: 9, stiffness: 220, mass: 0.6}});
  const scale = interpolate(punch, [0, 1], [1.9, 1]);
  const progress = interpolate(local, [0, durationInFrames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const color = n === 1 ? theme.danger : n === 2 ? theme.accent : theme.text;
  const r = size / 2 - 18;
  const c = 2 * Math.PI * r;
  const enter = spring({frame: local, fps, config: {damping: 16}});
  const ringPulse = 1 + Math.max(0, 1 - stepLocal / 8) * 0.06;

  return (
    <div style={{width: size, height: size, position: 'relative', transform: `scale(${enter * ringPulse})`}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0) 72%)'}} />
      <svg width={size} height={size} style={{position: 'absolute', inset: 0, transform: 'rotate(-90deg)'}}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.15)" strokeWidth={22} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={22}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{filter: `drop-shadow(0 0 16px ${color})`}}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: TYPE.countdown.family,
          fontWeight: 900,
          fontStyle: 'italic',
          fontSize: TYPE.countdown.size * (size / 520),
          color,
          transform: `scale(${scale})`,
          opacity: interpolate(stepLocal, [perStep - 4, perStep], [1, 0.2], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
          textShadow: `0 0 40px ${color}, 0 10px 0 rgba(0,0,0,0.4)`,
        }}
      >
        {n}
      </div>
    </div>
  );
};

/** Edge glow that pulses on each countdown second. */
export const EdgePulse: React.FC<{color: string; local: number; perStep: number}> = ({color, local, perStep}) => {
  const stepLocal = local % perStep;
  const o = interpolate(stepLocal, [0, 3, 16], [0, 0.42, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{boxShadow: `inset 0 0 120px 20px ${color}`, opacity: o, pointerEvents: 'none'}} />;
};

export const Flash: React.FC<{local: number; length?: number}> = ({local, length = 10}) => {
  const o = interpolate(local, [0, 1, length], [0, 0.8, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: '#ffffff', opacity: o, pointerEvents: 'none'}} />;
};

/** Rotating light rays behind the revealed card. */
export const LightRays: React.FC<{color: string; opacity: number; size: number}> = ({color, opacity, size}) => {
  const frame = useCurrentFrame();
  const rays = 14;
  return (
    <div style={{width: size, height: size, opacity, transform: `rotate(${frame * 0.6}deg)`, position: 'relative'}}>
      <svg width={size} height={size} viewBox="-100 -100 200 200">
        <defs>
          <radialGradient id="rayfade">
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>
        {new Array(rays).fill(0).map((_, i) => {
          const a = (i / rays) * Math.PI * 2;
          const w = 0.09;
          const x1 = Math.cos(a - w) * 100;
          const y1 = Math.sin(a - w) * 100;
          const x2 = Math.cos(a + w) * 100;
          const y2 = Math.sin(a + w) * 100;
          return <polygon key={i} points={`0,0 ${x1},${y1} ${x2},${y2}`} fill="url(#rayfade)" />;
        })}
      </svg>
    </div>
  );
};

/** Deterministic confetti burst (same frames every render). */
export const Confetti: React.FC<{local: number; colors: string[]; originY: number; count?: number}> = ({local, colors, originY, count = 140}) => {
  const {width, fps} = useVideoConfig();
  const pieces = useMemo(
    () =>
      new Array(count).fill(0).map((_, i) => {
        const fromSide = i % 3 === 0;
        const angle = fromSide ? (i % 2 ? -0.95 : -2.2) + (random(`ca${i}`) - 0.5) * 0.6 : -Math.PI / 2 + (random(`ca${i}`) - 0.5) * 2.4;
        const speed = 1300 + random(`cs${i}`) * 1500;
        return {
          x0: fromSide ? (i % 2 ? 0 : width) : width / 2 + (random(`cx${i}`) - 0.5) * 200,
          y0: fromSide ? originY + 300 : originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: colors[i % colors.length],
          w: 14 + random(`cw${i}`) * 16,
          h: 8 + random(`ch${i}`) * 10,
          spin: (random(`cr${i}`) - 0.5) * 1400,
          wobble: random(`cb${i}`) * 6,
          delay: Math.floor(random(`cd${i}`) * 5),
        };
      }),
    [count, width, originY, colors],
  );
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {pieces.map((p, i) => {
        const t = Math.max(0, local - p.delay) / fps;
        if (local - p.delay < 0) return null;
        const drag = Math.exp(-t * 1.6);
        const x = p.x0 + (p.vx * (1 - drag)) / 1.6 + Math.sin(t * p.wobble * 2) * 30;
        const y = p.y0 + (p.vy * (1 - drag)) / 1.6 + 900 * t * t;
        const o = interpolate(t, [0, 2.2, 3], [1, 1, 0], {extrapolateRight: 'clamp'});
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: p.w,
              height: p.h,
              background: p.color,
              borderRadius: 3,
              opacity: o,
              transform: `rotate(${p.spin * t}deg) rotateX(${p.spin * t * 1.3}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Sparkle stars around a point. */
export const Sparkles: React.FC<{local: number; cx: number; cy: number; radius: number; color: string}> = ({local, cx, cy, radius, color}) => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    {new Array(16).fill(0).map((_, i) => {
      const a = random(`sa${i}`) * Math.PI * 2;
      const d = radius * (0.65 + random(`sd${i}`) * 0.5);
      const start = Math.floor(random(`st${i}`) * 40);
      const life = 18;
      const t = local - start;
      if (t < 0 || t > life * 3) return null;
      const s = Math.sin(((t % life) / life) * Math.PI);
      const size = 18 + random(`ss${i}`) * 26;
      return (
        <svg key={i} width={size} height={size} viewBox="-10 -10 20 20" style={{position: 'absolute', left: cx + Math.cos(a) * d - size / 2, top: cy + Math.sin(a) * d - size / 2, opacity: s, transform: `scale(${s})`}}>
          <path d="M0 -10 L2 -2 L10 0 L2 2 L0 10 L-2 2 L-10 0 L-2 -2 Z" fill={color} />
        </svg>
      );
    })}
  </AbsoluteFill>
);
