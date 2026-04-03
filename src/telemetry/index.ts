/**
 * Telemetry Module
 * 
 * This module exports all telemetry-related classes and interfaces.
 */

// Types
export type {
  TelemetryEvent,
  TelemetryEventType,
  TelemetryConfig,
} from '@types/index';

// Re-export from core
export type { ITelemetryService } from '@core/interfaces';

// Placeholder for future telemetry implementations
// These will be implemented in separate files:
// - service.ts
// - events.ts
// - metrics.ts
// - exporters.ts
