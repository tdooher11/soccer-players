import React from 'react';
import type {ClubBadge, FormatId, VideoProps} from '../../shared/types';
import type {Theme} from '../theme';
import type {SceneState} from '../QuizVideo';
import {GuessPlayerPanel} from './GuessPlayer';
import {CareerPathPanel, GuessClubPanel, TrueFalsePanel, VersusPanel} from './Panels';

export type PanelProps = {props: VideoProps; st: SceneState; theme: Theme; fontsReady: boolean};

export const FORMAT_PANELS: Record<FormatId, React.FC<PanelProps>> = {
  guess_player: GuessPlayerPanel,
  career_path: CareerPathPanel,
  who_won_more: VersusPanel,
  guess_club: GuessClubPanel,
  true_false: TrueFalsePanel,
};

export type FormatLayout = {
  /** mystery card that flips at the reveal */
  hero: boolean;
  /** question panel stays visible during the reveal (answer is shown inside it) */
  keepPanel: boolean;
  answerTop: number;
  showDetails: boolean;
  countdown: {cy: number; size: number};
};

const CLUE_LAYOUT: FormatLayout = {hero: true, keepPanel: false, answerTop: 1010, showDetails: true, countdown: {cy: 600, size: 520}};

export const FORMAT_LAYOUT: Record<FormatId, FormatLayout> = {
  guess_player: CLUE_LAYOUT,
  career_path: CLUE_LAYOUT,
  guess_club: CLUE_LAYOUT,
  who_won_more: {hero: false, keepPanel: true, answerTop: 1310, showDetails: false, countdown: {cy: 960, size: 300}},
  true_false: {hero: false, keepPanel: true, answerTop: 650, showDetails: true, countdown: {cy: 1420, size: 280}},
};

/** Flags / clubs the viewer has already been shown — displayed on the mystery card. */
export const collectAttributes = (props: VideoProps, latestClue: number): {flags: string[]; clubs: ClubBadge[]} => {
  const flags: string[] = [];
  const clubs: ClubBadge[] = [];
  props.clues.slice(0, latestClue + 1).forEach((c) => {
    if (c.visual.kind === 'flag' && props.format !== 'guess_club' && !flags.includes(c.visual.code)) flags.push(c.visual.code);
    if (c.visual.kind === 'club' && !clubs.some((x) => x.name === (c.visual as {club: ClubBadge}).club.name)) clubs.push(c.visual.club);
  });
  return {flags, clubs};
};
