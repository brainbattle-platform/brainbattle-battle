import { Global, Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AuthContextClient } from './auth-context.client';
import { AuthDiagnosticsController } from './auth-diagnostics.controller';
import { AuthGuard } from './auth.guard';
import { UserWalletClient } from './user-wallet.client';

@Global()
@Module({
  imports: [UserModule],
  controllers: [AuthDiagnosticsController],
  providers: [AuthContextClient, AuthGuard, UserWalletClient],
  exports: [AuthContextClient, AuthGuard, UserWalletClient],
})
export class AuthModule {}