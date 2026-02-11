
export enum VideoType {
  ORIGINAL = 'ORIGINAL',
  REPOST = 'REPOST'
}

export enum RankingType {
  DAILY_WEEKLY = 'daily_weekly',
  MONTHLY = 'monthly',
  ANNUAL_SPECIAL = 'annual_special'
}

export interface InputState {
  views: number;
  bookmarks: number;
  coins: number;
  likes: number;
  danmaku: number;
  comments: number;
  shares: number;
  type: VideoType;
  rankingType: RankingType;
}

export interface CalculationResults {
  fixA: number;
  fixB: number;
  fixC: number;
  fixD: number;
  corrections: {
    views: number;
    bookmarks: number;
    coins: number;
    likes: number;
    danmaku: number;
    comments: number;
    shares: number;
  };
  scores: {
    views: number;
    bookmarks: number;
    coins: number;
    likes: number;
    danmaku: number;
    comments: number;
    shares: number;
  };
  totalScore: number;
}
