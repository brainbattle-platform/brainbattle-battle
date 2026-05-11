export const env = {
  PORT: Number(process.env.PORT ?? 3001),

  ROOM_CODE_LEN: Number(process.env.ROOM_CODE_LEN ?? 6),
  ROOM_EXPIRE_MINUTES: Number(process.env.ROOM_EXPIRE_MINUTES ?? 30),

  AUTH_ME_URL: process.env.AUTH_ME_URL ?? '',
  AUTH_ME_TIMEOUT_MS: Number(process.env.AUTH_ME_TIMEOUT_MS ?? 3000),

  USER_PUBLIC_PROFILE_URL: process.env.USER_PUBLIC_PROFILE_URL ?? '',

  REDIS_URL: process.env.REDIS_URL ?? '',
  REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
  REDIS_PORT: Number(process.env.REDIS_PORT ?? 6379),

  AUTH_PROFILE_SYNC_URL: process.env.AUTH_PROFILE_SYNC_URL ?? '',
  AUTH_INTERNAL_SERVICE_KEY: process.env.AUTH_INTERNAL_SERVICE_KEY ?? '',
  AUTH_PROFILE_SYNC_ENABLED: process.env.AUTH_PROFILE_SYNC_ENABLED === 'true',
};