import 'dotenv/config';

function readString(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];

  if (!raw) return fallback;

  const value = Number(raw);

  if (Number.isNaN(value)) {
    throw new Error(`Invalid environment variable ${name}: expected number`);
  }

  return value;
}

function readBoolean(name: string, fallback = false): boolean {
  const raw = process.env[name];

  if (!raw) return fallback;

  return raw === 'true' || raw === '1';
}

function requireString(name: string): string {
  const value = readString(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  NODE_ENV: readString('NODE_ENV', 'development'),
  PORT: readNumber('PORT', 3001),

  DATABASE_URL: requireString('DATABASE_URL'),

  ROOM_CODE_LEN: readNumber('ROOM_CODE_LEN', 6),
  ROOM_EXPIRE_MINUTES: readNumber('ROOM_EXPIRE_MINUTES', 30),

  AUTH_ME_URL: readString('AUTH_ME_URL', 'http://localhost:3000/auth/me'),
  AUTH_ME_TIMEOUT_MS: readNumber('AUTH_ME_TIMEOUT_MS', 3000),

  USER_PUBLIC_PROFILE_URL: readString(
    'USER_PUBLIC_PROFILE_URL',
    'http://localhost:3000/internal/users/public-profiles',
  ),

  AUTH_PROFILE_SYNC_URL: readString(
    'AUTH_PROFILE_SYNC_URL',
    'http://localhost:3000/internal/learner-profiles/rank-sync',
  ),

  AUTH_WALLET_URL: readString(
    'AUTH_WALLET_URL',
    'http://localhost:3000/internal/users',
  ),

  AUTH_INTERNAL_SERVICE_KEY: readString(
    'AUTH_INTERNAL_SERVICE_KEY',
    'dev-internal-key',
  ),

  AUTH_PROFILE_SYNC_ENABLED: readBoolean('AUTH_PROFILE_SYNC_ENABLED', true),

  DAILY_BP_CAP: readNumber('DAILY_BP_CAP', 300),

  REPEAT_OPPONENT_LIMIT_PER_DAY: readNumber(
    'REPEAT_OPPONENT_LIMIT_PER_DAY',
    5,
  ),

  REPEAT_OPPONENT_REWARD_MULTIPLIER: readNumber(
    'REPEAT_OPPONENT_REWARD_MULTIPLIER',
    0.2,
  ),

  BLOCKCHAIN_ENABLED: readBoolean('BLOCKCHAIN_ENABLED', false),
  RPC_URL: readString('RPC_URL', 'http://127.0.0.1:8545'),
  PRIVATE_KEY: readString('PRIVATE_KEY'),
  CONTRACT_ADDRESS: readString('CONTRACT_ADDRESS'),
  CHAIN_ID: readNumber('CHAIN_ID', 31337),

  REDIS_URL: readString('REDIS_URL'),
  REDIS_HOST: readString('REDIS_HOST', 'localhost'),
  REDIS_PORT: readNumber('REDIS_PORT', 6379),
};

export function validateEnv() {
  if (env.NODE_ENV === 'production') {
    if (env.AUTH_INTERNAL_SERVICE_KEY === 'dev-internal-key') {
      throw new Error(
        'AUTH_INTERNAL_SERVICE_KEY must not use the default dev value in production',
      );
    }

    if (env.BLOCKCHAIN_ENABLED && !env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY is required when BLOCKCHAIN_ENABLED=true');
    }

    if (env.BLOCKCHAIN_ENABLED && !env.CONTRACT_ADDRESS) {
      throw new Error('CONTRACT_ADDRESS is required when BLOCKCHAIN_ENABLED=true');
    }
  }

  if (env.BLOCKCHAIN_ENABLED) {
    if (!env.RPC_URL) {
      throw new Error('RPC_URL is required when BLOCKCHAIN_ENABLED=true');
    }

    if (!env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY is required when BLOCKCHAIN_ENABLED=true');
    }

    if (!env.CONTRACT_ADDRESS) {
      throw new Error('CONTRACT_ADDRESS is required when BLOCKCHAIN_ENABLED=true');
    }
  }

  return env;
}