import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Theme} from '../theme';

/** Stadium-at-night backdrop: glow, mowed stripes, perspective pitch lines, floodlights, bokeh. */
export const Background: React.FC<{theme: Theme; intensity?: number}> = ({theme, intensity = 1}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const sway = Math.sin(frame / 55) * 3;
  const drift = (frame * 0.35) % 140;

  const bokeh = useMemo(
    () =>
      new Array(26).fill(0).map((_, i) => ({
        x: random(`bx${i}`) * width,
        y: random(`by${i}`) * height,
        r: 6 + random(`br${i}`) * 26,
        speed: 0.15 + random(`bs${i}`) * 0.5,
        o: 0.05 + random(`bo${i}`) * 0.12,
      })),
    [width, height],
  );

  return (
    <AbsoluteFill style={{backgroundColor: theme.bgDeep, overflow: 'hidden'}}>
      {/* Core glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 90% 55% at 50% 38%, ${theme.bgMid} 0%, ${theme.bgDeep} 72%)`,
        }}
      />
      {/* Mowed grass stripes (perspective) */}
      <AbsoluteFill style={{perspective: 900, perspectiveOrigin: '50% 30%'}}>
        <div
          style={{
            position: 'absolute',
            left: -width * 0.5,
            width: width * 2,
            top: height * 0.42,
            height: height * 1.1,
            transform: 'rotateX(62deg)',
            transformOrigin: '50% 0%',
            backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 70px, rgba(0,0,0,0.0) 70px, rgba(0,0,0,0) 140px)`,
            backgroundPositionY: drift,
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 100%)',
          }}
        >
          <svg width={width * 2} height={height * 1.1} style={{position: 'absolute', inset: 0}}>
            <g stroke={theme.pitchLine} strokeWidth={6} fill="none">
              <line x1={0} y1={520} x2={width * 2} y2={520} />
              <circle cx={width} cy={520} r={190} />
              <circle cx={width} cy={520} r={8} fill={theme.pitchLine} />
              <rect x={width - 420} y={1400} width={840} height={420} />
              <rect x={width - 200} y={1640} width={400} height={180} />
              <rect x={60} y={-200} width={width * 2 - 120} height={2200} />
            </g>
          </svg>
        </div>
      </AbsoluteFill>
      {/* Floodlight beams */}
      {[-1, 1].map((side) => (
        <div
          key={side}
          style={{
            position: 'absolute',
            top: -200,
            left: side < 0 ? -260 : width - 260,
            width: 520,
            height: height * 1.05,
            background: `linear-gradient(to bottom, rgba(255,255,240,${0.16 * intensity}) 0%, rgba(255,255,240,0) 70%)`,
            clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
            transform: `rotate(${side * (-24 + sway)}deg)`,
            transformOrigin: '50% 0%',
            filter: 'blur(18px)',
            mixBlendMode: 'screen',
          }}
        />
      ))}
      {[-1, 1].map((side) => (
        <div
          key={`l${side}`}
          style={{
            position: 'absolute',
            top: -60,
            left: side < 0 ? 40 : width - 200,
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,235,0.55) 0%, rgba(255,255,235,0) 65%)',
            opacity: 0.75 + Math.sin(frame / 9 + side) * 0.05,
          }}
        />
      ))}
      {/* Bokeh */}
      {bokeh.map((b, i) => {
        const y = (b.y - frame * b.speed * 2 + height * 2) % (height + 100);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: b.x,
              top: y,
              width: b.r * 2,
              height: b.r * 2,
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(255,255,255,${b.o}) 0%, rgba(255,255,255,0) 70%)`,
            }}
          />
        );
      })}
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.65) 100%)',
          opacity: interpolate(intensity, [0, 1], [0.6, 1]),
        }}
      />
    </AbsoluteFill>
  );
};
