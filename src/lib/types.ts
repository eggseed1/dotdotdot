export type Lang = 'en' | 'ko';
export type Mode = 'music' | 'all';
export type Kind = 'music' | 'film' | 'literature' | 'anime' | 'games' | 'any';
export type I18n = { en: string; ko: string };
export type Work = {
  id: string;
  kind: Exclude<Kind, 'any'>;
  title: string;
  titleKo?: string;
  creator: string;
  creatorKo?: string;
  year: number;
  country: string;
  genres: string[];
  format?: string;
  aliases?: string[];
  /** Hand-curated DEMO popularity proxy, NOT RYM or other service popularity. */
  popularity: number;
  /** Verified number of ratings/votes on the source when a licensed source is imported. */
  voteCount?: number;
  source?: string;
  sourceId?: string;
};
export type Prompt = {
  id: string;
  kind: Kind;
  label: I18n;
  badge: I18n;
  match: (work: Work) => boolean;
};
export type RoundResult = {
  promptId: string;
  workId?: string;
  title?: string;
  titleKo?: string;
  creator?: string;
  year?: number;
  country?: string;
  rawAnswer: string;
  points: number;
  tier: number;
  timedOut?: boolean;
};
export type GameSession = {
  id: string;
  date: string;
  mode: Mode;
  ranked: boolean;
  prompts: string[];
  index: number;
  roundStartedAt: number;
  state: 'play' | 'reveal' | 'finished';
  results: RoundResult[];
};
