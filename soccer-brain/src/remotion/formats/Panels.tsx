import React, {useMemo} from 'react';
import {Img, interpolate, spring, staticFile, useVideoConfig} from 'remotion';
import type {PlayerChip} from '../../shared/types';
import {ClubShield, Flag} from '../components/Badges';
import {fitText} from '../fit';
import {FONT_BODY, FONT_DISPLAY, TYPE} from '../theme';
import type {PanelProps} from '.';
import {CLUE_TOP} from './GuessPlayer';

/** Big question line used by question-led formats. */
export const QuestionLine: React.FC<{text: string; top: number; enterAt: number; props: PanelProps}> = ({text, top, enterAt, props: {st, theme, fontsReady, props}}) => {
  const {fps} = useVideoConfig();
  const s = spring({frame: st.frame - enterAt, fps, config: {damping: 14}});
  const size = useMemo(() => {
    const max = Math.round(64 * Math.min(props.textScale, 1.15));
    return fontsReady ? fitText({text, fontFamily: FONT_BODY, fontWeight: 900, maxWidth: 920, maxLines: 3, maxSize: max, minSize: 40}).size : max * 0.8;
  }, [text, fontsReady, props.textScale]);
  return (
    <div style={{position: 'absolute', top, left: 60, right: 60, textAlign: 'center', opacity: s, transform: `translateY(${(1 - s) * 30}px)`}}>
      <div
        style={{
          display: 'inline-block',
          padding: '22px 34px',
          borderRadius: 28,
          background: theme.cardActive,
          border: `3px solid ${theme.accent}`,
          boxShadow: `0 18px 40px rgba(0,0,0,0.45), 0 0 34px ${theme.accentSoft}`,
          fontFamily: FONT_BODY,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1.12,
          color: theme.text,
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ career path

export const CareerPathPanel: React.FC<PanelProps> = (pp) => {
  const {props, st, theme} = pp;
  const {fps} = useVideoConfig();
  const n = props.clues.length;
  const stepH = Math.min(118, Math.floor(590 / n));
  return (
    <>
      <div style={{position: 'absolute', top: CLUE_TOP - 6, width: '100%', textAlign: 'center', fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 28, letterSpacing: '0.16em', color: theme.accent}}>
        MAJOR CLUBS · IN ORDER
      </div>
      <div style={{position: 'absolute', top: CLUE_TOP + 40, left: 140, width: 800}}>
        {props.clues.map((clue, i) => {
          const scene = st.clueScenes[i];
          if (!scene) return null;
          const local = st.frame - scene.from;
          if (local < 0) return null;
          const s = spring({frame: local, fps, config: {damping: 14, stiffness: 160}});
          const active = i === st.latestClue && st.current?.type === 'clue';
          const lineGrow = i < n - 1 ? interpolate(st.frame - (st.clueScenes[i + 1]?.from ?? 1e9), [-8, 4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
          return (
            <div key={i} style={{position: 'absolute', top: i * stepH, left: 0, height: stepH, width: 800}}>
              {i < n - 1 ? (
                <div style={{position: 'absolute', left: 44, top: 88, width: 8, height: (stepH - 86) * lineGrow, background: theme.accent, borderRadius: 4, opacity: 0.8}} />
              ) : null}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 26,
                  transform: `translateX(${(1 - s) * 160}px) scale(${interpolate(s, [0, 1], [0.85, 1])})`,
                  opacity: s * (active ? 1 : 0.85),
                  transformOrigin: 'left center',
                }}
              >
                {clue.visual.kind === 'club' ? <ClubShield club={clue.visual.club} size={96} /> : null}
                <div
                  style={{
                    padding: '14px 28px',
                    borderRadius: 22,
                    background: active ? theme.cardActive : theme.card,
                    border: `3px solid ${active ? theme.accent : theme.cardBorder}`,
                    fontFamily: FONT_BODY,
                    fontWeight: 900,
                    fontSize: Math.min(54, 56 * props.textScale) * (clue.text.length > 18 ? 0.82 : 1),
                    color: theme.text,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{color: theme.accent, fontFamily: FONT_DISPLAY, fontStyle: 'italic', marginRight: 14}}>{i + 1}</span>
                  {clue.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

// ------------------------------------------------------------------ guess club

export const GuessClubPanel: React.FC<PanelProps> = (pp) => {
  const {props, st, theme} = pp;
  const {fps} = useVideoConfig();
  return (
    <div style={{position: 'absolute', top: CLUE_TOP, left: 90, width: 900, display: 'flex', flexDirection: 'column', gap: 18}}>
      {props.clues.map((clue, i) => {
        const scene = st.clueScenes[i];
        const chip = props.chips[i];
        if (!scene || st.frame < scene.from) return <div key={i} style={{height: 170}} />;
        const s = spring({frame: st.frame - scene.from, fps, config: {damping: 14, stiffness: 160}});
        const active = i === st.latestClue && st.current?.type === 'clue';
        return (
          <div
            key={i}
            style={{
              height: 170,
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              padding: '0 26px',
              borderRadius: 30,
              background: active ? theme.cardActive : theme.card,
              border: `3px solid ${active ? theme.accent : theme.cardBorder}`,
              transform: `translateX(${(1 - s) * 180}px)`,
              opacity: s,
            }}
          >
            <Avatar chip={chip} size={128} accent={theme.accent} />
            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
              <div style={{fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: '0.14em', color: active ? theme.accent : theme.textDim}}>PLAYER {i + 1}</div>
              <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                {clue.visual.kind === 'flag' ? <Flag code={clue.visual.code} height={46} radius={7} /> : null}
                <div style={{fontFamily: FONT_BODY, fontWeight: 900, fontSize: clue.text.length > 16 ? 50 : 58, color: theme.text}}>{clue.text}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Avatar: React.FC<{chip?: PlayerChip; size: number; accent: string}> = ({chip, size, accent}) => (
  <div style={{width: size, height: size, borderRadius: '50%', overflow: 'hidden', border: `5px solid ${accent}`, flexShrink: 0, background: '#0a2a18', position: 'relative'}}>
    {chip?.imageSrc ? (
      <Img src={staticFile(chip.imageSrc)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%'}} />
    ) : (
      <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: size * 0.42, color: '#fff'}}>
        {(chip?.name ?? '?')
          .split(' ')
          .map((w) => w[0])
          .slice(0, 2)
          .join('')}
      </div>
    )}
  </div>
);

// ------------------------------------------------------------------ who won more

export const VersusPanel: React.FC<PanelProps> = (pp) => {
  const {props, st, theme} = pp;
  const {fps} = useVideoConfig();
  const [a, b] = props.chips;
  const revealed = st.reveal ? st.frame >= st.reveal.from : false;
  const rl = st.reveal ? st.frame - st.reveal.from : 0;
  const va = Number(a?.value ?? 0);
  const vb = Number(b?.value ?? 0);
  const enter = (d: number) => spring({frame: st.frame - d, fps, config: {damping: 13}});
  const card = (chip: PlayerChip, i: number, value: number, win: boolean) => {
    const s = enter(8 + i * 10);
    const count = revealed ? Math.round(interpolate(rl, [8, 30], [0, value], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})) : null;
    const winGlow = revealed && win ? interpolate(rl, [24, 34], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
    return (
      <div
        style={{
          width: 430,
          height: 640,
          borderRadius: 34,
          background: theme.card,
          border: `4px solid ${win && revealed ? theme.accent : theme.cardBorder}`,
          boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 ${60 * winGlow}px ${theme.accent}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '34px 20px',
          gap: 18,
          transform: `translateY(${(1 - s) * 200}px) scale(${1 + winGlow * 0.04})`,
          opacity: s * (revealed && !win ? 0.6 : 1),
        }}
      >
        <Avatar chip={chip} size={250} accent={theme.accent} />
        {chip.flagCode ? <Flag code={chip.flagCode} height={46} radius={7} /> : null}
        <div style={{fontFamily: FONT_BODY, fontWeight: 900, fontSize: chip.name.length > 15 ? 40 : 48, color: theme.text, textAlign: 'center', lineHeight: 1.05}}>{chip.name}</div>
        <div
          style={{
            marginTop: 'auto',
            fontFamily: TYPE.countdown.family,
            fontWeight: 900,
            fontStyle: 'italic',
            fontSize: 120,
            lineHeight: 1,
            color: revealed ? (win ? theme.accent : theme.text) : theme.textDim,
          }}
        >
          {count ?? '?'}
        </div>
      </div>
    );
  };
  if (!a || !b) return null;
  const inCountdown = st.countdown ? st.frame >= st.countdown.from && !revealed : false;
  const vs = inCountdown ? 0 : enter(20);
  return (
    <>
      <QuestionLine text={props.question ?? ''} top={400} enterAt={0} props={pp} />
      <div style={{position: 'absolute', top: 640, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 60}}>
        {card(a, 0, va, va > vb)}
        {card(b, 1, vb, vb > va)}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 900,
          left: 540 - 70,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: `linear-gradient(160deg, #fff3b8 0%, ${theme.accent} 55%, #c48a00 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontStyle: 'italic',
          fontSize: 62,
          color: '#1b1300',
          transform: `scale(${vs}) rotate(${(1 - vs) * -90}deg)`,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}
      >
        VS
      </div>
    </>
  );
};

// ------------------------------------------------------------------ true / false

export const TrueFalsePanel: React.FC<PanelProps> = (pp) => {
  const {props, st, theme} = pp;
  const {fps} = useVideoConfig();
  const chip = props.chips[0];
  const revealed = st.reveal ? st.frame >= st.reveal.from : false;
  const rl = st.reveal ? st.frame - st.reveal.from : 0;
  const verdict = props.answer.verdict;
  const s = spring({frame: st.frame - 6, fps, config: {damping: 13}});
  const btn = (label: 'TRUE' | 'FALSE', i: number) => {
    const color = label === 'TRUE' ? '#25c46b' : '#ff4d4d';
    const right = verdict === label;
    const pop = revealed && right ? spring({frame: rl - 4, fps, config: {damping: 8, stiffness: 200}}) : 0;
    const bs = spring({frame: st.frame - 20 - i * 6, fps, config: {damping: 12}});
    return (
      <div
        key={label}
        style={{
          width: 420,
          height: 170,
          borderRadius: 34,
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontStyle: 'italic',
          fontSize: 76,
          color: '#fff',
          boxShadow: `0 14px 0 rgba(0,0,0,0.35), 0 0 ${80 * pop}px ${color}`,
          transform: `scale(${bs * (1 + pop * 0.12)})`,
          opacity: revealed && !right ? 0.25 : 1,
          textShadow: '0 4px 0 rgba(0,0,0,0.25)',
        }}
      >
        {label === 'TRUE' ? '✓' : '✗'} {label}
      </div>
    );
  };
  return (
    <>
      <div style={{position: 'absolute', top: 400, width: '100%', display: 'flex', justifyContent: 'center', gap: 34, alignItems: 'center', opacity: s, transform: `scale(${s})`}}>
        <Avatar chip={chip} size={230} accent={theme.accent} />
        {props.answer.club ? <ClubShield club={props.answer.club} size={180} /> : null}
      </div>
      {!revealed ? <QuestionLine text={props.question ?? ''} top={680} enterAt={10} props={pp} /> : null}
      <div style={{position: 'absolute', top: 1070, width: '100%', display: 'flex', justifyContent: 'center', gap: 40}}>
        {btn('TRUE', 0)}
        {btn('FALSE', 1)}
      </div>
    </>
  );
};
