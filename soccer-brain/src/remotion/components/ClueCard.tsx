import React, {useMemo} from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Clue} from '../../shared/types';
import {fitText} from '../fit';
import {TYPE, type Theme} from '../theme';
import {ClubShield, Flag} from './Badges';
import {Icon} from './Icons';

export const CARD_W = 900;
export const CARD_H = 150;
export const CARD_GAP = 16;

type Props = {
  clue: Clue;
  number: number;
  /** frame (absolute) the card appears */
  enterAt: number;
  /** frames the card is the "current" clue (for its timer bar), 0 for none */
  activeFor: number;
  isActive: boolean;
  theme: Theme;
  textScale: number;
  fontsReady: boolean;
  label?: string;
  /** card height in px (150 for up to 4 clues; smaller when there are 5) */
  height?: number;
};

const Visual: React.FC<{clue: Clue; k: number}> = ({clue, k}) => {
  const v = clue.visual;
  if (v.kind === 'flag') return <Flag code={v.code} height={Math.round(62 * k)} />;
  if (v.kind === 'club') return <ClubShield club={v.club} size={Math.round(78 * k)} />;
  if (v.kind === 'icon') return <Icon id={v.icon} size={Math.round(86 * k)} />;
  return null;
};

export const ClueCard: React.FC<Props> = ({clue, number, enterAt, activeFor, isActive, theme, textScale, fontsReady, label, height = CARD_H}) => {
  const k = Math.min(1, height / CARD_H); // shrink factor for badge, icon and fonts
  const badge = Math.round(92 * k);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - enterAt;
  const enter = spring({frame: local, fps, config: {damping: 14, stiffness: 160, mass: 0.7}});
  const hasVisual = clue.visual.kind !== 'none';
  const textWidth = CARD_W - 40 - badge - 24 - (hasVisual ? Math.round(94 * k) + 24 : 0) - 28;

  const size = useMemo(() => {
    const max = Math.round(TYPE.clue.size * textScale * k);
    if (!fontsReady) return {size: max * 0.85, lines: 1};
    return fitText({
      text: clue.text,
      fontFamily: TYPE.clue.family,
      fontWeight: TYPE.clue.weight,
      maxWidth: textWidth,
      maxLines: 2,
      maxSize: max,
      multiLineMax: Math.round(48 * Math.min(textScale, 1.05) * k),
      minSize: 28,
    });
  }, [clue.text, textScale, fontsReady, textWidth, k]);

  if (local < 0) return null;

  const x = interpolate(enter, [0, 1], [180, 0]);
  const scale = interpolate(enter, [0, 1], [0.86, 1]);
  const sweep = interpolate(local, [4, 22], [-40, 140], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const timer = activeFor > 0 ? interpolate(local, [0, activeFor], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;

  return (
    <div
      style={{
        width: CARD_W,
        height,
        transform: `translateX(${x}px) scale(${scale})`,
        opacity: enter * (isActive ? 1 : 0.8),
        borderRadius: 30,
        background: isActive ? theme.cardActive : theme.card,
        border: `3px solid ${isActive ? theme.accent : theme.cardBorder}`,
        boxShadow: isActive
          ? `0 18px 40px rgba(0,0,0,0.45), 0 0 34px ${theme.accentSoft}`
          : '0 10px 26px rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px 0 20px',
        gap: 24,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* light sweep */}
      <div
        style={{
          position: 'absolute',
          top: -40,
          bottom: -40,
          left: `${sweep}%`,
          width: 120,
          background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0) 100%)',
          transform: 'skewX(-20deg)',
        }}
      />
      {/* number badge */}
      <div
        style={{
          width: badge,
          height: badge,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isActive ? `linear-gradient(160deg, #fff3b8 0%, ${theme.accent} 55%, #c48a00 100%)` : 'rgba(255,255,255,0.08)',
          border: isActive ? 'none' : `3px solid ${theme.accent}`,
          color: isActive ? '#1b1300' : theme.accent,
          fontFamily: TYPE.title.family,
          fontWeight: 900,
          fontSize: Math.round(52 * k),
          fontStyle: 'italic',
          boxShadow: isActive ? '0 6px 16px rgba(0,0,0,0.4)' : undefined,
        }}
      >
        {number}
      </div>
      {hasVisual ? (
        <div style={{width: Math.round(94 * k), display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0}}>
          <Visual clue={clue} k={k} />
        </div>
      ) : null}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, flex: 1}}>
        <div
          style={{
            fontFamily: TYPE.clueLabel.family,
            fontWeight: TYPE.clueLabel.weight,
            fontSize: Math.round(TYPE.clueLabel.size * Math.max(k, 0.85)),
            letterSpacing: TYPE.clueLabel.tracking,
            color: isActive ? theme.accent : theme.textDim,
            marginBottom: 2,
          }}
        >
          {label ?? `CLUE ${number}`}
        </div>
        <div
          style={{
            fontFamily: TYPE.clue.family,
            fontWeight: TYPE.clue.weight,
            fontSize: size.size,
            lineHeight: 1.08,
            color: theme.text,
            textShadow: '0 3px 10px rgba(0,0,0,0.45)',
          }}
        >
          {clue.text}
        </div>
      </div>
      {/* per-clue timer */}
      {isActive && activeFor > 0 ? (
        <div style={{position: 'absolute', left: 0, bottom: 0, height: 7, width: `${timer * 100}%`, background: theme.accent, opacity: 0.85}} />
      ) : null}
    </div>
  );
};
