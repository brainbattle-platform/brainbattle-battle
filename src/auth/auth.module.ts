import { Global, Module } from '@nestjs/common';
import { AuthContextClient } from './auth-context.client';
import { AuthGuard } from './auth.guard';

@Global()
@Module({
  providers: [AuthContextClient, AuthGuard],
  exports: [AuthContextClient, AuthGuard],
})
export class AuthModule {}