import { defineConfig } from 'checkly'
import { Frequency, RetryStrategyBuilder } from 'checkly/constructs'

/**
 * Checkly monitoring-as-code for the OpenTelemetry Demo ("Astronomy Shop").
 *
 * The point of this project is segmentation. The OTel demo already emits
 * traces, metrics and logs, and the built-in Grafana dashboards aggregate
 * them. Aggregates dilute partial failures. These checks slice the same
 * checkout journey by currency so a failure on one path shows up as a
 * 100% failure on that check rather than a 4% wobble in a p95 line.
 */
export default defineConfig({
  projectName: 'Astronomy Shop Synthetics',
  logicalId: 'astronomy-shop-synthetics',
  repoUrl: 'https://github.com/songsbyarchit/checkly-synthetics',
  checks: {
    activated: true,
    muted: false,
    runtimeId: '2025.04',
    frequency: Frequency.EVERY_5M,
    locations: ['eu-west-1', 'us-east-1'],
    tags: ['astronomy-shop', 'otel-demo'],
    checkMatch: '**/__checks__/**/*.check.ts',
    // Two retries 30s apart before alerting. A single failed run on a
    // 5-minute schedule is not an incident, three in ninety seconds is.
    retryStrategy: RetryStrategyBuilder.fixedStrategy({
      baseBackoffSeconds: 30,
      maxRetries: 2,
      sameRegion: false,
    }),
    browserChecks: {
      frequency: Frequency.EVERY_5M,
      testMatch: '**/__checks__/**/*.spec.ts',
    },
  },
  cli: {
    runLocation: 'eu-west-1',
    reporters: ['list'],
  },
})
