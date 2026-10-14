import React from 'react';
import {Img, staticFile} from 'remotion';
import type {ClubBadge} from '../../shared/types';
import {FONT_DISPLAY} from '../theme';
import {SoccerBall} from './Icons';

/** Rounded country flag from /public/flags (public-domain flag images). */
export const Flag: React.FC<{code: string; height: number; radius?: number; shadow?: boolean}> = ({code, height, radius = 10, shadow = true}) => (
  <div
    style={{
      height,
      width: height * 1.5,
      borderRadius: radius,
      overflow: 'hidden',
      boxShadow: shadow ? '0 6px 18px rgba(0,0,0,0.45), inset 0 0 0 2px rgba(255,255,255,0.25)' : undefined,
      flexShrink: 0,
      position: 'relative',
    }}
  >
    <Img src={staticFile(`flags/${code.toLowerCase()}.png`)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    <div style={{position: 'absolute', inset: 0, borderRadius: radius, boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.18)'}} />
  </div>
);

/**
 * A generic club "shield" in the club's colours with its short name.
 * Deliberately NOT the club's real crest (trademarked) — just colours + letters.
 */
export const ClubShield: React.FC<{club: ClubBadge; size: number}> = ({club, size}) => {
  const id = `sh-${club.short.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 100 112" style={{flexShrink: 0, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.45))'}}>
      <defs>
        <clipPath id={id}>
          <path d="M50 4 L94 16 V54 C94 82 74 100 50 108 C26 100 6 82 6 54 V16 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect x="0" y="0" width="100" height="112" fill={club.c1} />
        <rect x="0" y="66" width="100" height="46" fill={club.c2} />
        <rect x="0" y="62" width="100" height="6" fill="rgba(255,255,255,0.35)" />
      </g>
      <path d="M50 4 L94 16 V54 C94 82 74 100 50 108 C26 100 6 82 6 54 V16 Z" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="4" />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        fontFamily={FONT_DISPLAY}
        fontWeight={900}
        fontSize={club.short.length > 3 ? 20 : 26}
        fill={club.ink}
        style={{letterSpacing: '0.02em'}}
      >
        {club.short}
      </text>
    </svg>
  );
};

/** Small, unobtrusive channel mark: ball + wordmark. */
export const BrandMark: React.FC<{channel: string; accent?: string; scale?: number; opacity?: number}> = ({channel, accent = '#ffc928', scale = 1, opacity = 0.9}) => {
  const [first, ...rest] = channel.toUpperCase().split(' ');
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12 * scale,
        padding: `${8 * scale}px ${22 * scale}px ${8 * scale}px ${10 * scale}px`,
        borderRadius: 999,
        background: 'rgba(0,0,0,0.35)',
        border: '2px solid rgba(255,255,255,0.14)',
        opacity,
      }}
    >
      <SoccerBall size={40 * scale} />
      <div style={{fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 28 * scale, letterSpacing: '0.12em', color: '#fff', fontStyle: 'italic'}}>
        {first}
        <span style={{color: accent}}>{rest.length ? ` ${rest.join(' ')}` : ''}</span>
      </div>
    </div>
  );
};
