import React, {useMemo} from 'react';
import {interpolate, spring, useVideoConfig} from 'remotion';
import type {VideoProps} from '../../shared/types';
import {fitText} from '../fit';
import {TYPE, type Theme} from '../theme';
import {BrandMark, Flag} from './Badges';
import {SoccerBall} from './Icons';

export const ANSWER_TOP = 1010;

/** Big name slam + subtitle line. Only ever mounted from the reveal frame onwards. */
export const AnswerBlock: React.FC<{props: VideoProps; theme: Theme; local: number; fontsReady: boolean; outroAt: number | null; top?: number; showDetails?: boolean}> = ({
  props,
  theme,
  local,
  fontsReady,
  top = ANSWER_TOP,
  showDetails = true,
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
    </div>
  );
};

export const OutroBlock: React.FC<{props: VideoProps; theme: Theme; local: number; top?: number}> = ({props, theme, local, top = 1300}) => {
  const {fps} = useVideoConfig();
  const s = spring({frame: local, fps, config: {damping: 10, stiffness: 200, mass: 0.6}});
  const bounce = Math.abs(Math.sin(local / 6)) * -26;
  return (
    <div style={{position: 'absolute', top, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22}}>
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
        <div style={{fontFamily: TYPE.outro.family, fontWeight: 900, fontStyle: 'italic', fontSize: 74, color: '#1b1300', whiteSpace: 'nowrap'}}>DID YOU GET IT?</div>
        <div style={{transform: `translateY(${bounce}px)`}}>
          <SoccerBall size={78} rotate={local * 12} />
        </div>
      </div>
      <div style={{opacity: interpolate(local, [6, 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
        <BrandMark channel={props.branding.channel} accent={theme.accent} scale={0.9} opacity={0.95} />
      </div>
    </div>
  );
};
