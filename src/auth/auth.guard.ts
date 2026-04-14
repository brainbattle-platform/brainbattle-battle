import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctxType = context.getType();

    // ===== HTTP (REST) =====
    if (ctxType === 'http') {
      const req = context.switchToHttp().getRequest<Request>();

      const devUserId =
        (req.headers['x-dev-user-id'] as string) || 'dev-user-1';

      const user: AuthUser = {
        id: devUserId,
        name: 'Dev User',
      };

      (req as any).user = user;
      return true;
    }

    // ===== WS (Socket.IO) =====
    if (ctxType === 'ws') {
      const client: any = context.switchToWs().getClient();

      const devUserId =
        client.handshake.headers['x-dev-user-id'] || 'dev-user-1';

      client.data.user = {
        id: devUserId,
        name: 'Dev User',
      };

      return true;
    }

    return true;
  }
}
