import { UnauthorizedException } from '@nestjs/common';

export function extractBearerToken(authHeader?: string | string[]): string {
  const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (!value?.startsWith('Bearer ')) {
    throw new UnauthorizedException('Missing bearer token');
  }

  const token = value.slice('Bearer '.length).trim();

  if (!token) {
    throw new UnauthorizedException('Missing bearer token');
  }

  return token;
}