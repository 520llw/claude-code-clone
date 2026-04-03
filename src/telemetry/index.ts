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

// Actual implementations
export { TelemetryClient } from './TelemetryClient';
export type {
  TelemetryConfig as TelemetryClientConfig,
  TelemetryContext,
} from './TelemetryClient';
export { Analytics } from './Analytics';
export { ErrorReporter } from './ErrorReporter';
