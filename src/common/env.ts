export const env = {
  // ======================
  // Battle config
  // ======================
  ROOM_3V3_TIMEOUT_SEC: Number(process.env.ROOM_3V3_TIMEOUT_SEC ?? 60),
  ROOM_CODE_LEN: Number(process.env.ROOM_CODE_LEN ?? 6),

  // ======================
  // External services
  // ======================
  AUTH_ME_URL: process.env.AUTH_ME_URL ?? '',
  USER_PUBLIC_PROFILE_URL: process.env.USER_PUBLIC_PROFILE_URL ?? '',
};
