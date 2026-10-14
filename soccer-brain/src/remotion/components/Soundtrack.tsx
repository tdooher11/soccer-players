import React from 'react';
import {Audio} from '@remotion/media';
import {interpolate, Sequence, staticFile, useVideoConfig} from 'remotion';
import type {VideoProps} from '../../shared/types';

const src = (p: string) => (p.startsWith('http') ? p : staticFile(p));

/**
 * All audio for a video: narration (measured, placed by the backend), a ducked music
 * bed, and SFX derived from the scene timeline.
 */
export const Soundtrack: React.FC<{props: VideoProps}> = ({props}) => {
  const {fps} = useVideoConfig();
  const {timeline, audio} = props;
  const total = timeline.totalFrames;
  const sfx = audio.sfxVolume;
  const countdown = timeline.scenes.find((s) => s.type === 'countdown');
  const reveal = timeline.scenes.find((s) => s.type === 'reveal');
  const outro = timeline.scenes.find((s) => s.type === 'outro');

  const narrationAt = (f: number) => audio.narration.some((n) => f >= n.from - 4 && f <= n.from + n.durationInFrames + 4);

  const musicVolume = (f: number) => {
    if (!audio.music) return 0;
    let v = audio.music.volume;
    if (narrationAt(f)) v *= 0.55;
    if (countdown && f >= countdown.from && f < countdown.from + countdown.durationInFrames) v *= 0.35;
    if (reveal && f >= reveal.from) v = audio.music.volume * (narrationAt(f) ? 0.7 : 1.15);
    const fadeIn = interpolate(f, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
    const fadeOut = interpolate(f, [total - 20, total - 1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    return v * fadeIn * fadeOut;
  };

  return (
    <>
      {audio.music ? <Audio src={src(audio.music.src)} loop volume={musicVolume} /> : null}

      {audio.narration.map((n, i) => (
        <Sequence key={`n${i}`} from={n.from} durationInFrames={n.durationInFrames + 2} layout="none" name={`Narration ${n.sceneId}`}>
          <Audio src={src(n.src)} volume={n.volume} />
        </Sequence>
      ))}

      {timeline.scenes
        .filter((s) => s.type === 'clue')
        .map((s) => (
          <Sequence key={`w${s.id}`} from={s.from} durationInFrames={Math.round(0.5 * fps)} layout="none" name="Whoosh">
            <Audio src={staticFile('audio/sfx/whoosh.wav')} volume={(s.index === 0 ? 0.3 : 0.5) * sfx} />
          </Sequence>
        ))}

      {countdown ? (
        <>
          <Sequence from={countdown.from} durationInFrames={countdown.durationInFrames} layout="none" name="Riser">
            <Audio src={staticFile('audio/sfx/riser.wav')} volume={0.32 * sfx} />
          </Sequence>
          {new Array(Math.max(1, Math.round(countdown.durationInFrames / fps))).fill(0).map((_, i, arr) => {
            const per = countdown.durationInFrames / arr.length;
            const last = i === arr.length - 1;
            return (
              <Sequence key={`t${i}`} from={Math.round(countdown.from + i * per)} durationInFrames={Math.round(0.4 * fps)} layout="none" name={`Tick ${arr.length - i}`}>
                <Audio src={staticFile(last ? 'audio/sfx/tick-final.wav' : 'audio/sfx/tick.wav')} volume={0.7 * sfx} />
                <Audio src={staticFile('audio/sfx/thump.wav')} volume={0.6 * sfx} />
              </Sequence>
            );
          })}
        </>
      ) : null}

      {reveal ? (
        <Sequence from={reveal.from} durationInFrames={Math.round(2.4 * fps)} layout="none" name="Reveal hit">
          <Audio src={staticFile('audio/sfx/reveal.wav')} volume={0.85 * sfx} />
        </Sequence>
      ) : null}

      {outro ? (
        <Sequence from={outro.from} durationInFrames={Math.round(0.3 * fps)} layout="none" name="Pop">
          <Audio src={staticFile('audio/sfx/pop.wav')} volume={0.5 * sfx} />
        </Sequence>
      ) : null}
    </>
  );
};
