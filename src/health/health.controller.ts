import { Controller, Get, HttpCode } from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('/api/battle/health')
export class HealthController {
  @Get()
  @HttpCode(201)
  @ApiResponse({ status: 201, description: 'OK' })
  ok() {
    return { ok: true };
  }
}
