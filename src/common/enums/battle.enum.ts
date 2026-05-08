export enum BattleFormat {
  DUEL_1V1 = 'DUEL_1V1',
  TEAM_3V3 = 'TEAM_3V3',
}

export enum BattleSkill {
  GRAMMAR = 'GRAMMAR',
  LISTENING = 'LISTENING',
  VOCABULARY = 'VOCABULARY',
  MIXED = 'MIXED',
}

export enum BattleRoomStatus {
  WAITING = 'WAITING',
  READY = 'READY',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}

export enum BattleStatus {
  CREATED = 'CREATED',
  RUNNING = 'RUNNING',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}

export enum BattleResult {
  WIN = 'WIN',
  LOSE = 'LOSE',
  DRAW = 'DRAW',
}