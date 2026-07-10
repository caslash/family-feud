import { Injectable } from '@nestjs/common';
import type { HealthCheckResponse } from '@family-feud/types';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealth(): HealthCheckResponse {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
