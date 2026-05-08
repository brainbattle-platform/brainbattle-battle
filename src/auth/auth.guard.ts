import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthContextClient } from './auth-context.client';
import { extractBearerToken } from './auth-token.util';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authContextClient: AuthContextClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctxType = context.getType();

    if (ctxType === 'http') {
      const req = context.switchToHttp().getRequest<Request>();
      const token = extractBearerToken(req.headers.authorization);

      (req as any).user =
        await this.authContextClient.verifyBearerToken(token);

      return true;
    }

    if (ctxType === 'ws') {
      const client: any = context.switchToWs().getClient();

      const token = extractBearerToken(
        client.handshake?.auth?.token
          ? `Bearer ${client.handshake.auth.token}`
          : client.handshake?.headers?.authorization,
      );

      client.data.user =
        await this.authContextClient.verifyBearerToken(token);

      return true;
    }

    return false;
  }
}