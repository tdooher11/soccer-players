import React from 'react';
import {CARD_GAP, CARD_H, CARD_W, ClueCard} from '../components/ClueCard';
import type {PanelProps} from '.';

export const CLUE_TOP = 846;
/** With 5+ clues the stack starts higher (the mystery card shrinks a little to make room). */
export const CLUE_TOP_5 = 800;

/** Stacked clue cards. Earlier clues stay visible so late viewers can catch up. */
export const GuessPlayerPanel: React.FC<PanelProps> = ({props, st, theme, fontsReady}) => {
  const n = props.clues.length;
  // 4 clues: 150px cards. 5+: fit them in the same area (ending ~1510px, clear of the Shorts UI).
  const top = n > 4 ? CLUE_TOP_5 : CLUE_TOP;
  const gap = n > 4 ? 12 : CARD_GAP;
  const h = n > 4 ? Math.floor((1512 - top - gap * (n - 1)) / n) : CARD_H;
  return (
    <div style={{position: 'absolute', top, left: (1080 - CARD_W) / 2, display: 'flex', flexDirection: 'column', gap}}>
      {props.clues.map((clue, i) => {
        const scene = st.clueScenes[i];
        if (!scene) return null;
        return (
          <div key={i} style={{height: h}}>
            <ClueCard
              clue={clue}
              number={i + 1}
              enterAt={scene.from}
              activeFor={scene.durationInFrames}
              isActive={i === st.latestClue && st.current?.type === 'clue'}
              theme={theme}
              textScale={props.textScale}
              fontsReady={fontsReady}
              height={h}
            />
          </div>
        );
      })}
    </div>
  );
};
