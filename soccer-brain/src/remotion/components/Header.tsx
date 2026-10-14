import React, {useMemo} from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Scene} from '../../shared/types';
import {fitText} from '../fit';
import {TYPE, type Theme} from '../theme';

/** Main headline. Swaps text with a quick slam when `text` changes at `changedAt`. */
export const Headline: React.FC<{text: string; changedAt: number; theme: Theme; color?: string; fontsReady: boolean; textScale: number}> = ({
  text,
  changedAt,
  theme,
  color,
  fontsReady,
  textScale,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - changedAt;
  const s = spring({frame: local, fps, config: {damping: 12, stiffness: 200, mass: 0.6}});
  const size = useMemo(() => {
    const max = Math.round(TYPE.title.size * Math.min(textScale, 1.15));
    if (!fontsReady) return max * 0.8;
    return fitText({text, fontFamily: TYPE.title.family, fontWeight: 900, maxWidth: 960, maxLines: 1, maxSize: max, minSize: 54}).size;
  }, [text, fontsReady, textScale]);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div
        style={{
          fontFamily: TYPE.title.family,
          fontWeight: 900,
          fontStyle: 'italic',
          fontSize: size,
          lineHeight: 1.05,
          color: color ?? theme.text,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          transform: `scale(${interpolate(s, [0, 1], [1.25, 1])})`,
          opacity: interpolate(s, [0, 0.4], [0, 1], {extrapolateRight: 'clamp'}),
          textShadow: '0 6px 0 rgba(0,0,0,0.35), 0 0 28px rgba(0,0,0,0.5)',
        }}
      >
        {text}
      </div>
      <div
        style={{
          marginTop: 10,
          height: 12,
          width: interpolate(s, [0, 1], [0, 420]),
          background: `linear-gradient(90deg, rgba(0,0,0,0), ${theme.accent} 20%, ${theme.accent} 80%, rgba(0,0,0,0))`,
          transform: 'skewX(-30deg)',
          borderRadius: 4,
        }}
      />
    </div>
  );
};

/** Segmented progress bar: one pill per clue + one for the countdown. */
export const ProgressPills: React.FC<{scenes: Scene[]; theme: Theme}> = ({scenes, theme}) => {
  const frame = useCurrentFrame();
  const steps = scenes.filter((s) => s.type === 'clue' || s.type === 'countdown');
  return (
    <div style={{display: 'flex', gap: 12, justifyContent: 'center'}}>
      {steps.map((s) => {
        const p = interpolate(frame, [s.from, s.from + s.durationInFrames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const isCd = s.type === 'countdown';
        return (
          <div key={s.id} style={{width: isCd ? 70 : 110, height: 14, borderRadius: 999, background: 'rgba(255,255,255,0.16)', overflow: 'hidden'}}>
            <div style={{width: `${p * 100}%`, height: '100%', background: isCd ? theme.danger : theme.accent, borderRadius: 999}} />
          </div>
        );
      })}
    </div>
  );
};
