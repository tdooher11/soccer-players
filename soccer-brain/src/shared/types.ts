/**
 * The contract between the Python backend (which builds these props, measures narration
 * and computes the timeline) and the Remotion compositions (which only draw what they are
 * given). Keep in sync with backend/models.py -> VideoProps.
 */

export type FormatId = 'guess_player' | 'career_path' | 'who_won_more' | 'guess_club' | 'true_false';

export type ThemeId = 'stadium-gold' | 'electric-blue' | 'night-match';

export type ClubBadge = {
  name: string;
  short: string;
  c1: string;
  c2: string;
  ink: string;
};

export type ClueVisual =
  | {kind: 'flag'; code: string}
  | {kind: 'club'; club: ClubBadge}
  | {kind: 'icon'; icon: IconId}
  | {kind: 'none'};

export type IconId = 'ballon' | 'trophy' | 'cup' | 'boot' | 'gloves' | 'shirt' | 'cake' | 'star' | 'whistle';

export type Clue = {
  /** On-screen text. Must never contain the answer. */
  text: string;
  visual: ClueVisual;
};

/** A player shown openly in a question (e.g. Who Won More, Guess the Club). */
export type PlayerChip = {
  name: string;
  flagCode: string | null;
  imageSrc: string | null;
  club: ClubBadge | null;
  value?: string | null;
};

export type Answer = {
  /** e.g. "RONALDINHO" */
  title: string;
  /** small line under the title, e.g. "Brazil · Barcelona legend" */
  subtitle: string;
  flagCode: string | null;
  /** Relative to /public, or null to use the jersey fallback. */
  imageSrc: string | null;
  club: ClubBadge | null;
  jerseyNumber: number | null;
  /** Extra lines (True/False explanation, comparison values). */
  details: string[];
  /** For true/false. */
  verdict?: 'TRUE' | 'FALSE' | null;
  /** For who-won-more: the two compared players with values. */
  versus?: PlayerChip[] | null;
};

export type SceneType = 'clue' | 'countdown' | 'reveal' | 'outro';

export type Scene = {
  id: string;
  type: SceneType;
  /** for clue scenes: which clue/item this scene introduces */
  index: number;
  from: number;
  durationInFrames: number;
};

export type AudioCue = {
  src: string;
  from: number;
  durationInFrames: number;
  volume: number;
  sceneId: string;
};

export type VideoProps = {
  format: FormatId;
  fps: number;
  width: number;
  height: number;
  theme: ThemeId;
  textScale: number;
  title: string;
  /** Question line for formats that ask one (career path, who won more, true/false). */
  question: string | null;
  clues: Clue[];
  /** For formats that show players openly (guess the club, who won more). */
  chips: PlayerChip[];
  answer: Answer;
  showAnswerImage: boolean;
  timeline: {totalFrames: number; scenes: Scene[]};
  audio: {
    narration: AudioCue[];
    music: {src: string; volume: number} | null;
    sfxVolume: number;
  };
  branding: {channel: string; handle: string | null};
  /** Closing call-to-action, e.g. "HOW MANY CLUES?" / "Comment how many you needed!" */
  outro: {title: string; subtitle: string};
};
