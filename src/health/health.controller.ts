import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('/api/battle/health')
export class HealthController {
  @Get()
  ok() {
    return { ok: true };
  }
}
