import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('/health')
  health(): { status: string; app: string; phase: number } {
    return { status: 'ok', app: 'Domovník — Phase 0', phase: 0 };
  }
}