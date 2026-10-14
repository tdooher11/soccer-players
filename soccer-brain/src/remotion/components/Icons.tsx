import React from 'react';
import type {IconId} from '../../shared/types';

type P = {size: number; color?: string};

/** Classic black-and-white ball (pentagon pattern), drawn from scratch. */
export const SoccerBall: React.FC<P & {rotate?: number}> = ({size, rotate = 0}) => (
  <svg width={size} height={size} viewBox="-50 -50 100 100" style={{transform: `rotate(${rotate}deg)`}}>
    <defs>
      <radialGradient id="ballShade" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="70%" stopColor="#e9eef2" />
        <stop offset="100%" stopColor="#9aa5ae" />
      </radialGradient>
      <clipPath id="ballClip">
        <circle r="47" />
      </clipPath>
    </defs>
    <circle r="47" fill="url(#ballShade)" />
    <g clipPath="url(#ballClip)" fill="#14181c">
      <polygon points="0,-17 16,-5 10,14 -10,14 -16,-5" />
      {[0, 72, 144, 216, 288].map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <polygon points="0,-58 13,-49 9,-36 -9,-36 -13,-49" />
          <line x1="0" y1="-17" x2="0" y2="-36" stroke="#14181c" strokeWidth="3" />
        </g>
      ))}
    </g>
    <circle r="47" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
  </svg>
);

const GoldBall: React.FC<P> = ({size}) => (
  <svg width={size} height={size} viewBox="-50 -50 100 100">
    <defs>
      <radialGradient id="gold" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#fff6c2" />
        <stop offset="45%" stopColor="#f5c22b" />
        <stop offset="100%" stopColor="#9a6a00" />
      </radialGradient>
    </defs>
    <circle r="44" fill="url(#gold)" />
    <g fill="none" stroke="rgba(120,80,0,0.7)" strokeWidth="2.5">
      <polygon points="0,-15 14,-5 9,12 -9,12 -14,-5" />
      {[0, 72, 144, 216, 288].map((a) => (
        <line key={a} transform={`rotate(${a})`} x1="0" y1="-15" x2="0" y2="-38" />
      ))}
    </g>
    <ellipse cx="-14" cy="-18" rx="12" ry="7" fill="rgba(255,255,255,0.55)" transform="rotate(-30 -14 -18)" />
  </svg>
);

const Trophy: React.FC<P> = ({size, color = '#ffc928'}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <defs>
      <linearGradient id="tg" x1="0" x2="1">
        <stop offset="0%" stopColor="#a87400" />
        <stop offset="45%" stopColor={color} />
        <stop offset="60%" stopColor="#fff2b0" />
        <stop offset="100%" stopColor="#b88200" />
      </linearGradient>
    </defs>
    <path d="M28 14 H72 V36 C72 52 62 62 50 62 C38 62 28 52 28 36 Z" fill="url(#tg)" />
    <path d="M28 20 H14 C14 36 22 44 32 46" fill="none" stroke="url(#tg)" strokeWidth="6" />
    <path d="M72 20 H86 C86 36 78 44 68 46" fill="none" stroke="url(#tg)" strokeWidth="6" />
    <rect x="45" y="60" width="10" height="14" fill="url(#tg)" />
    <rect x="32" y="74" width="36" height="8" rx="2" fill="url(#tg)" />
    <rect x="26" y="82" width="48" height="10" rx="3" fill="#5a3b00" />
  </svg>
);

const WorldCup: React.FC<P> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <defs>
      <linearGradient id="wc" x1="0" x2="1">
        <stop offset="0%" stopColor="#9a6a00" />
        <stop offset="50%" stopColor="#ffd84a" />
        <stop offset="100%" stopColor="#a87400" />
      </linearGradient>
    </defs>
    {/* Generic golden globe trophy (not the official design) */}
    <path d="M22 40 C16 22 34 6 50 6 C66 6 84 22 78 40 C74 52 62 56 60 70 H40 C38 56 26 52 22 40 Z" fill="url(#wc)" />
    <path d="M30 30 C38 20 62 20 70 30 M28 42 C40 34 60 34 72 42" stroke="#8a5c00" strokeWidth="3" fill="none" />
    <ellipse cx="40" cy="20" rx="8" ry="5" fill="rgba(255,255,255,0.55)" transform="rotate(-25 40 20)" />
    <rect x="34" y="70" width="32" height="8" rx="2" fill="#1f7a3a" />
    <rect x="28" y="78" width="44" height="14" rx="3" fill="url(#wc)" />
  </svg>
);

const Boot: React.FC<P> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M14 30 L44 30 L48 52 C62 54 80 58 88 66 C92 72 88 78 80 78 L18 78 C12 78 10 72 12 66 Z" fill="#ffffff" />
    <path d="M44 30 L48 52" stroke="#20c05c" strokeWidth="6" />
    <path d="M22 50 L40 48 M24 58 L42 56" stroke="#20c05c" strokeWidth="5" strokeLinecap="round" />
    {[22, 40, 58, 76].map((x) => (
      <rect key={x} x={x} y="78" width="7" height="8" fill="#9aa5ae" />
    ))}
  </svg>
);

const Gloves: React.FC<P> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M30 88 V56 L22 40 C20 34 28 30 32 36 L36 44 V20 C36 14 44 14 44 20 V40 V14 C44 8 52 8 52 14 V40 V18 C52 12 60 12 60 18 V42 V26 C60 20 68 20 68 26 V62 C68 76 60 82 58 88 Z" fill="#2bd4ff" stroke="#0a3a55" strokeWidth="3" />
    <rect x="28" y="80" width="32" height="12" rx="3" fill="#ffffff" />
  </svg>
);

const Shirt: React.FC<P> = ({size, color = '#ffffff'}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M34 12 L20 18 L6 36 L20 46 L26 40 V90 H74 V40 L80 46 L94 36 L80 18 L66 12 C62 20 38 20 34 12 Z" fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
  </svg>
);

const Cake: React.FC<P> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <rect x="18" y="50" width="64" height="36" rx="6" fill="#ff7ab6" />
    <path d="M18 58 C26 66 34 52 42 60 C50 68 58 52 66 60 C72 66 78 58 82 58 V50 H18 Z" fill="#ffffff" />
    {[34, 50, 66].map((x) => (
      <g key={x}>
        <rect x={x - 3} y="30" width="6" height="20" fill="#2bd4ff" />
        <ellipse cx={x} cy="25" rx="4" ry="7" fill="#ffc928" />
      </g>
    ))}
  </svg>
);

const Star: React.FC<P> = ({size, color = '#ffc928'}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <polygon points="50,6 62,38 96,38 68,58 79,92 50,72 21,92 32,58 4,38 38,38" fill={color} />
  </svg>
);

const Whistle: React.FC<P> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <circle cx="40" cy="58" r="26" fill="#cfd8dc" stroke="#455a64" strokeWidth="4" />
    <rect x="44" y="32" width="46" height="18" rx="4" fill="#cfd8dc" stroke="#455a64" strokeWidth="4" />
    <circle cx="40" cy="58" r="8" fill="#455a64" />
  </svg>
);

export const Icon: React.FC<{id: IconId; size: number}> = ({id, size}) => {
  switch (id) {
    case 'ballon':
      return <GoldBall size={size} />;
    case 'trophy':
      return <Trophy size={size} />;
    case 'cup':
      return <WorldCup size={size} />;
    case 'boot':
      return <Boot size={size} />;
    case 'gloves':
      return <Gloves size={size} />;
    case 'shirt':
      return <Shirt size={size} />;
    case 'cake':
      return <Cake size={size} />;
    case 'star':
      return <Star size={size} />;
    case 'whistle':
      return <Whistle size={size} />;
    default:
      return null;
  }
};
