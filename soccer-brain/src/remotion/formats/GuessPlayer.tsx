import React from 'react';
import {CARD_GAP, CARD_H, CARD_W, ClueCard} from '../components/ClueCard';
import type {PanelProps} from '.';

export const CLUE_TOP = 846;

/** Stacked clue cards. Earlier clues stay visible so late viewers can catch up. */
export const GuessPlayerPanel: React.FC<PanelProps> = ({props, st, theme, fontsReady}) => {
  const n = props.clues.length;
  // Shrink the stack slightly if a format supplies more than 4 clues.
  const h = n > 4 ? Math.floor((CARD_H * 4 + CARD_GAP * 3) / n - CARD_GAP) : CARD_H;
  return (
    <div style={{position: 'absolute', top: CLUE_TOP, left: (1080 - CARD_W) / 2, display: 'flex', flexDirection: 'column', gap: CARD_GAP}}>
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
            />
          </div>
        );
      })}
    </div>
  );
};
