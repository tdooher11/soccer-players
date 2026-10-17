import React, {useMemo} from 'react';
import {interpolate, spring, useVideoConfig} from 'remotion';
import type {VideoProps} from '../../shared/types';
import {fitText} from '../fit';
import {TYPE, type Theme} from '../theme';
import {Flag} from './Badges';
import {SoccerBall} from './Icons';

export const ANSWER_TOP = 1010;

/** Big name slam + subtitle line. Only ever mounted from the reveal frame onwards. */
export const AnswerBlock: React.FC<{props: VideoProps; theme: Theme; local: number; fontsReady: boolean; outroAt: number | null; top?: number; showDetails?: boolean; footer?: React.ReactNode}> = ({
  props,
  theme,
  local,
  fontsReady,
  top = ANSWER_TOP,
  showDetails = true,
  footer,
}) => {
  const {fps} = useVideoConfig();
  const {answer} = props;
  const slam = spring({frame: local - 9, fps, config: {damping: 9, stiffness: 210, mass: 0.6}});
  const sub = spring({frame: local - 16, fps, config: {damping: 16}});
  const title = answer.title.endsWith('!') ? answer.title : `${answer.title}!`;
  const fit = useMemo(() => {
    const max = Math.round(TYPE.answer.size * Math.min(props.textScale, 1.15));
    if (!fontsReady) return {size: max * 0.8, lines: 1};
    return fitText({text: title, fontFamily: TYPE.answer.family, fontWeight: 900, maxWidth: 940, maxLines: 2, maxSize: max, minSize: 64});
  }, [title, fontsReady, props.textScale]);

  if (local < 9) return null;
  return (
    <div style={{position: 'absolute', top, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
      <div
        style={{
          fontFamily: TYPE.answer.family,
          fontWeight: 900,
          fontStyle: 'italic',
          fontSize: fit.size,
          lineHeight: 1.0,
          textAlign: 'center',
          color: theme.text,
          padding: '0 40px',
          transform: `scale(${interpolate(slam, [0, 1], [0.45, 1])})`,
          opacity: interpolate(slam, [0, 0.6], [0, 1], {extrapolateRight: 'clamp'}),
          textShadow: `0 0 2px ${theme.accent}, 0 0 18px ${theme.accent}, 0 8px 0 rgba(0,0,0,0.45), 0 0 50px ${theme.accentSoft}`,
        }}
      >
        {title}
      </div>
      {answer.subtitle ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '12px 30px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.45)',
            border: `2px solid ${theme.cardBorder}`,
            opacity: sub,
            transform: `translateY(${(1 - sub) * 40}px)`,
          }}
        >
          {answer.flagCode ? <Flag code={answer.flagCode} height={44} radius={7} /> : null}
          <div style={{fontFamily: TYPE.answerSub.family, fontWeight: 800, fontSize: TYPE.answerSub.size * Math.min(props.textScale, 1.1), color: theme.text}}>{answer.subtitle}</div>
        </div>
      ) : null}
      {(showDetails ? answer.details : []).map((d, i) => {
        const s = spring({frame: local - 22 - i * 6, fps, config: {damping: 16}});
        return (
          <div key={i} style={{fontFamily: TYPE.answerSub.family, fontWeight: 800, fontSize: 40 * Math.min(props.textScale, 1.1), color: theme.textDim, opacity: s, textAlign: 'center', padding: '0 70px'}}>
            {d}
          </div>
        );
      })}
      {footer}
    </div>
  );
};

/** Small speech bubble used in the "comment" call-to-action. */
const CommentIcon: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M14 18 H86 Q94 18 94 26 V64 Q94 72 86 72 H46 L26 90 L30 72 H14 Q6 72 6 64 V26 Q6 18 14 18 Z" fill={color} />
    <circle cx="30" cy="45" r="7" fill="#0b2417" />
    <circle cx="50" cy="45" r="7" fill="#0b2417" />
    <circle cx="70" cy="45" r="7" fill="#0b2417" />
  </svg>
);

/** Closing call-to-action: "HOW MANY CLUES?" + "Comment how many you needed!" */
export const OutroBlock: React.FC<{props: VideoProps; theme: Theme; local: number; top?: number; inline?: boolean}> = ({props, theme, local, top = 1300, inline = false}) => {
  const {fps} = useVideoConfig();
  const s = spring({frame: local, fps, config: {damping: 10, stiffness: 200, mass: 0.6}});
  const s2 = spring({frame: local - 8, fps, config: {damping: 12, stiffness: 180}});
  const bounce = Math.abs(Math.sin(local / 6)) * -26;
  const title = props.outro?.title ?? 'DID YOU GET IT?';
  const subtitle = props.outro?.subtitle ?? '';
  const wiggle = Math.sin(local / 4) * 4 * Math.max(0, 1 - local / 40);
  return (
    <div style={{...(inline ? {marginTop: 14} : {position: 'absolute' as const, top, left: 0, right: 0}), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          padding: '18px 40px',
          background: `linear-gradient(160deg, #fff3b8 0%, ${theme.accent} 55%, #c48a00 100%)`,
          borderRadius: 26,
          transform: `scale(${interpolate(s, [0, 1], [0.4, 1])}) rotate(-2deg)`,
          opacity: s,
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{fontFamily: TYPE.outro.family, fontWeight: 900, fontStyle: 'italic', fontSize: title.length > 15 ? 64 : 74, color: '#1b1300', whiteSpace: 'nowrap'}}>{title}</div>
        <div style={{transform: `translateY(${bounce}px)`}}>
          <SoccerBall size={78} rotate={local * 12} />
        </div>
      </div>
      {subtitle ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '14px 32px 14px 22px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.55)',
            border: `3px solid ${theme.accent}`,
            opacity: s2,
            transform: `translateY(${(1 - s2) * 40}px) rotate(${wiggle}deg)`,
          }}
        >
          <CommentIcon size={56} color={theme.accent} />
          <div style={{fontFamily: TYPE.answerSub.family, fontWeight: 900, fontSize: 46, color: theme.text, whiteSpace: 'nowrap'}}>{subtitle}</div>
        </div>
      ) : null}
    </div>
  );
};
