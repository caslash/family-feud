export * from './entities.js';
export * from './outbound.js';

export interface HealthCheckResponse {
  status: "ok" | "error";
  timestamp: string;
}
