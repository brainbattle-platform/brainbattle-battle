import { Global, Module } from '@nestjs/common';
import { AuthContextClient } from './auth-context.client';
import { AuthGuard } from './auth.guard';
import { UserWalletClient } from './user-wallet.client';

@Global()
@Module({
  providers: [AuthContextClient, AuthGuard, UserWalletClient],
  exports: [AuthContextClient, AuthGuard, UserWalletClient],
})
export class AuthModule {}