import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers['authorization'];

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }

    // Dev fallback
    if (!process.env.AUTH_ME_URL) {
      const devUserId = req.headers['x-dev-user-id'];
      if (!devUserId) throw new UnauthorizedException('No dev user');
      req.user = { userId: devUserId };
      return true;
    }

    const { data } = await axios.get(process.env.AUTH_ME_URL!, {
      headers: { Authorization: auth },
    });

    req.user = { userId: data.userId };
    return true;
  }
}
