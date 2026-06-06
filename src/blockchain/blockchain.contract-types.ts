export interface ContractRewardInput {
  player: string;
  rewardType: string;
  amount: bigint;
}

export interface ContractBattleResultInput {
  battleId: string;
  resultHash: string;
  rewards: ContractRewardInput[];
}