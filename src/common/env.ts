export const env = {
  ROOM_3V3_TIMEOUT_SEC: Number(process.env.ROOM_3V3_TIMEOUT_SEC ?? 60),
  ROOM_CODE_LEN: Number(process.env.ROOM_CODE_LEN ?? 6),

  AUTH_ME_URL: process.env.AUTH_ME_URL ?? '',
  AUTH_ME_TIMEOUT_MS: Number(process.env.AUTH_ME_TIMEOUT_MS ?? 3000),

  USER_PUBLIC_PROFILE_URL: process.env.USER_PUBLIC_PROFILE_URL ?? '',
};