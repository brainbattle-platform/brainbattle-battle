export const BRAIN_BATTLE_ABI = [
  'function recordBattleResult(bytes32 matchId, uint8 mode, bytes32 resultHash, tuple(address player, uint8 outcome, uint256 totalBp, tuple(uint8 rewardType, uint256 amountBp)[] breakdown)[] rewards) external',
] as const;