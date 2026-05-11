import { RankTier } from '@prisma/client';

export const RANK_STAR_CONFIG: Record<RankTier, number | null> = {
  BRONZE: 3,
  SILVER: 4,
  GOLD: 5,
  CHALLENGER: null,
};

export const RANK_ORDER: RankTier[] = [
  RankTier.BRONZE,
  RankTier.SILVER,
  RankTier.GOLD,
  RankTier.CHALLENGER,
];