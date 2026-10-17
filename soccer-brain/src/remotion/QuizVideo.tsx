import React, {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Scene, VideoProps} from '../shared/types';
import {loadFonts} from './fonts';
import {getTheme, type Theme} from './theme';
import {Background} from './components/Background';
import {BrandMark} from './components/Badges';
import {Confetti, Countdown, EdgePulse, Flash, LightRays, Sparkles} from './components/Effects';
import {Headline, ProgressPills} from './components/Header';
import {MC_H, MC_W, MysteryCard} from './components/MysteryCard';
import {Soundtrack} from './components/Soundtrack';
import {AnswerBlock, OutroBlock} from './components/AnswerBlock';
import {FORMAT_LAYOUT, FORMAT_PANELS, collectAttributes} from './formats';

const useFontsReady = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadFonts().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
};

export type SceneState = {
  frame: number;
  current: Scene | undefined;
  clueScenes: Scene[];
  countdown: Scene | undefined;
  reveal: Scene | undefined;
  outro: Scene | undefined;
  /** index of the latest clue on screen (-1 before the first) */
  latestClue: number;
};

export const useSceneState = (scenes: Scene[]): SceneState => {
  const frame = useCurrentFrame();
  return useMemo(() => {
    const clueScenes = scenes.filter((s) => s.type === 'clue');
    const current = scenes.find((s) => frame >= s.from && frame < s.from + s.durationInFrames) ?? scenes[scenes.length - 1];
    const latestClue = clueScenes.filter((s) => frame >= s.from).length - 1;
    return {
      frame,
      current,
      clueScenes,
      countdown: scenes.find((s) => s.type === 'countdown'),
      reveal: scenes.find((s) => s.type === 'reveal'),
      outro: scenes.find((s) => s.type === 'outro'),
      latestClue,
    };
  }, [frame, scenes]);
};

const HERO_CY = 600; // vertical centre of the hero card during the question

export const QuizVideo: React.FC<VideoProps> = (props) => {
  const theme: Theme = getTheme(props.theme);
  const fontsReady = useFontsReady();
  const {fps, width} = useVideoConfig();
  const st = useSceneState(props.timeline.scenes);
  const {frame, countdown, reveal, outro} = st;

  const inCountdown = countdown && frame >= countdown.from && (!reveal || frame < reveal.from);
  const revealed = reveal ? frame >= reveal.from : false;
  const revealLocal = reveal ? frame - reveal.from : -1;
  const cdLocal = countdown ? frame - countdown.from : -1;

  // Headline text per phase
  let headline = props.title;
  let headlineAt = 0;
  let headlineColor: string | undefined;
  if (revealed && reveal) {
    headline = props.format === 'true_false' ? 'THE ANSWER IS…' : props.format === 'who_won_more' ? 'THE WINNER IS…' : 'THE ANSWER IS…';
    headlineAt = reveal.from;
    headlineColor = theme.accent;
  } else if (inCountdown && countdown) {
    headline = 'LAST CHANCE!';
    headlineAt = countdown.from;
    headlineColor = theme.text;
  }

  // Hero card motion
  const flip = reveal ? spring({frame: revealLocal, fps, config: {damping: 15, stiffness: 120, mass: 0.8}}) : 0;
  const bob = Math.sin(frame / 18) * 7;
  const qPulse = 1 + (st.latestClue >= 0 ? Math.max(0, 1 - (frame - (st.clueScenes[st.latestClue]?.from ?? 0)) / 10) * 0.18 : 0);
  const heroScale = revealed ? interpolate(flip, [0, 1], [1, 1.32]) : inCountdown ? interpolate(spring({frame: cdLocal, fps, config: {damping: 18}}), [0, 1], [1, 0.9]) : 1;
  const heroY = revealed ? interpolate(flip, [0, 1], [HERO_CY, 700]) : HERO_CY;
  const shake = revealLocal >= 0 && revealLocal < 10 ? Math.sin(revealLocal * 3.1) * (10 - revealLocal) * 1.6 : 0;
  const heroDim = inCountdown ? 0.35 : 1;

  const attrs = collectAttributes(props, st.latestClue);
  const Panel = FORMAT_PANELS[props.format];
  const layout = FORMAT_LAYOUT[props.format];
  const panelExit = reveal && !layout.keepPanel ? interpolate(frame - reveal.from, [0, 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
  const showHeroCard = layout.hero;
  const outroLocal = outro ? frame - outro.from : -1;
  const answerFade = layout.keepPanel && outroLocal >= 0 ? interpolate(outroLocal, [0, 6], [1, 0], {extrapolateRight: 'clamp'}) : 1;

  return (
    <AbsoluteFill style={{fontFamily: 'Nunito, sans-serif', overflow: 'hidden'}}>
      <Background theme={theme} intensity={revealed ? 1.2 : 1} />

      <AbsoluteFill style={{transform: `translate(${shake}px, ${shake * 0.6}px)`}}>
        {/* Branding (small, top) */}
        <div style={{position: 'absolute', top: 92, width: '100%', display: 'flex', justifyContent: 'center'}}>
          <BrandMark channel={props.branding.channel} accent={theme.accent} scale={0.85} opacity={0.85} />
        </div>

        {/* Headline */}
        <div style={{position: 'absolute', top: 178, width: '100%'}}>
          <Headline text={headline} changedAt={headlineAt} theme={theme} color={headlineColor} fontsReady={fontsReady} textScale={props.textScale} />
        </div>

        {/* Progress */}
        {!revealed ? (
          <div style={{position: 'absolute', top: 334, width: '100%'}}>
            <ProgressPills scenes={props.timeline.scenes} theme={theme} />
          </div>
        ) : null}

        {/* Rays behind the revealed card */}
        {revealed ? (
          <div style={{position: 'absolute', left: width / 2 - 600, top: heroY - 600}}>
            <LightRays color={theme.accent} size={1200} opacity={interpolate(revealLocal, [0, 15], [0, 0.35], {extrapolateRight: 'clamp'})} />
          </div>
        ) : null}

        {/* Hero card */}
        {showHeroCard ? (
          <div
            style={{
              position: 'absolute',
              left: width / 2 - MC_W / 2,
              top: heroY - MC_H / 2 + (revealed ? 0 : bob),
              transform: `scale(${heroScale})`,
              opacity: heroDim,
            }}
          >
            <MysteryCard
              theme={theme}
              flip={flip}
              flags={attrs.flags}
              clubs={attrs.clubs}
              answer={revealed ? props.answer : null}
              showImage={props.showAnswerImage}
              questionPulse={qPulse}
              mode={props.format === 'guess_club' ? 'club' : 'player'}
            />
          </div>
        ) : null}

        {/* Format-specific question panel */}
        <div style={{position: 'absolute', inset: 0, opacity: 1 - panelExit, transform: `translateY(${panelExit * 160}px)`}}>
          {panelExit < 1 ? <Panel props={props} st={st} theme={theme} fontsReady={fontsReady} /> : null}
        </div>

        {/* Countdown */}
        {inCountdown && countdown ? (
          <div style={{position: 'absolute', left: width / 2 - layout.countdown.size / 2, top: layout.countdown.cy - layout.countdown.size / 2}}>
            <Countdown theme={theme} local={cdLocal} durationInFrames={countdown.durationInFrames} size={layout.countdown.size} />
          </div>
        ) : null}

        {/* Answer + outro */}
        {revealed && reveal && answerFade > 0 ? (
          <div style={{opacity: answerFade}}>
            <AnswerBlock
              props={props}
              theme={theme}
              local={revealLocal}
              fontsReady={fontsReady}
              outroAt={outro ? outro.from - reveal.from : null}
              top={layout.answerTop}
              showDetails={layout.showDetails}
              footer={!layout.keepPanel && outro && frame >= outro.from ? <OutroBlock props={props} theme={theme} local={frame - outro.from} inline /> : null}
            />
          </div>
        ) : null}
        {layout.keepPanel && outro && frame >= outro.from ? <OutroBlock props={props} theme={theme} local={frame - outro.from} top={layout.answerTop + 20} /> : null}
      </AbsoluteFill>

      {inCountdown && countdown ? (
        <EdgePulse color={cdLocal > (countdown.durationInFrames * 2) / 3 ? theme.danger : theme.accent} local={cdLocal} perStep={countdown.durationInFrames / Math.max(1, Math.round(countdown.durationInFrames / fps))} />
      ) : null}
      {revealed ? <Confetti local={revealLocal} colors={theme.confetti} originY={heroY} /> : null}
      {revealed && showHeroCard ? <Sparkles local={revealLocal} cx={width / 2} cy={heroY} radius={360} color={theme.accent} /> : null}
      {revealed ? <Flash local={revealLocal} /> : null}

      <Soundtrack props={props} />
    </AbsoluteFill>
  );
};
