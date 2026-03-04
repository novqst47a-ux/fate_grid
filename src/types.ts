// ─── Character Roles ─────────────────────────────────────────────────────────

export type Position =
  | 'PROTAG'
  | 'SUPPORT'
  | 'RIVAL'
  | 'VILLAIN'
  | 'MENTOR'
  | 'EXTRA';

export const PositionLabels: Record<Position, string> = {
  PROTAG: '주인공',
  SUPPORT: '조연',
  RIVAL: '라이벌',
  VILLAIN: '악당',
  MENTOR: '멘토',
  EXTRA: '엑스트라',
};

export const PositionColors: Record<Position, string> = {
  PROTAG: '#ffd32a',
  SUPPORT: '#0be881',
  RIVAL: '#ff5e57',
  VILLAIN: '#9c1de7',
  MENTOR: '#1089ff',
  EXTRA: '#808080',
};

// ─── Personalities ────────────────────────────────────────────────────────────

export type Personality =
  | 'SOCIAL'
  | 'BRIGHT'
  | 'INTRO'
  | 'CYNICAL'
  | 'MAD'
  | 'CALM'
  | 'AGGRESSIVE'
  | 'TIMID';

export const PersonalityLabels: Record<Personality, string> = {
  SOCIAL: '사교적',
  BRIGHT: '밝음',
  INTRO: '내성적',
  CYNICAL: '냉소적',
  MAD: '광기',
  CALM: '침착함',
  AGGRESSIVE: '공격적',
  TIMID: '소심함',
};

// ─── Emotions ─────────────────────────────────────────────────────────────────

export type Emotion = 'Love' | 'Friendly' | 'Hostile' | 'Awkward';

export const EmotionLabels: Record<Emotion, string> = {
  Love: '사랑',
  Friendly: '친밀',
  Hostile: '적대',
  Awkward: '어색',
};

export const EmotionSubCategories: Record<Emotion, string[]> = {
  Love: ['짝사랑', '연인', '동경', '집착', '옛사랑'],
  Friendly: ['가족', '단짝', '신뢰', '사업동지', '호의'],
  Hostile: ['원수', '경쟁자', '증오', '불신', '짜증남'],
  Awkward: ['낯가림', '서먹함', '불편함', '구면(어색한)', '직장동료', '계약관계'],
};

export const EmotionColors: Record<Emotion, string> = {
  Love: '#ff6b9d',
  Friendly: '#4ecdc4',
  Hostile: '#ff4757',
  Awkward: '#95a5a6',
};

// ─── Data Models ──────────────────────────────────────────────────────────────

export interface CharacterNode {
  id: string;
  name: string;
  position: Position;
  personality: Personality;
  range: number;       // 999 = ∞
  slots: number;
  slotsRemaining: number;
  x: number;
  y: number;
  /** 0 = PROTAG (excluded from alphabet suffix); 1–26 = user-placed cards (A–Z). */
  placementIndex: number;
}

export interface Link {
  id: string;
  from: string;        // CharacterNode id
  to: string;          // CharacterNode id
  emotion: Emotion;
  subCategory: string;
  modifier?: unknown;
}

export interface NextCard {
  position: Position;
  personality: Personality;
}

export interface PreviewLink {
  toX: number;
  toY: number;
  emotion: Emotion;
  weight: number;
}

// ─── Session Storage Shape ────────────────────────────────────────────────────

export interface SessionData {
  nodes: CharacterNode[];
  links: Link[];
  seed: number;
}
