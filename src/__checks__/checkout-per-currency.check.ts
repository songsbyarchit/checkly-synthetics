import { BrowserCheck, CheckGroup, Frequency } from 'checkly/constructs'
import { qualityEngineering, sreOncall } from './alert-channels'

/**
 * One deployed check per currency, all running the same spec file.
 *
 * This is the core argument of the demo. The Astronomy Shop serves multiple
 * currency paths through the currency service. An incident that only affects
 * one of them is roughly 4% of traffic, which is inside the noise band of an
 * aggregate p95 panel. Split into per-currency checks, the same incident is
 * a 100% failure on exactly one check, named for the currency, in under a
 * scheduling interval.
 *
 * Adding a currency is one string, which is the monitoring-as-code argument
 * in its smallest possible form.
 */

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'] as const

export const checkoutGroup = new CheckGroup('astronomy-checkout-journeys', {
  name: 'Astronomy Shop / Checkout journeys',
  activated: true,
  concurrency: 4,
  locations: ['eu-west-1', 'us-east-1'],
  tags: ['checkout', 'revenue-path'],
  alertChannels: [qualityEngineering, sreOncall],
  environmentVariables: [
    { key: 'ENVIRONMENT_URL', value: process.env.ENVIRONMENT_URL ?? 'http://localhost:8080' },
  ],
})

for (const currency of CURRENCIES) {
  new BrowserCheck(`checkout-${currency.toLowerCase()}`, {
    name: `Checkout journey - ${currency}`,
    group: checkoutGroup,
    frequency: Frequency.EVERY_5M,
    // Browser checks have no degraded-response-time threshold in this SDK,
    // that's an API/monitor check concept only. This is just the hard
    // timeout for the whole Playwright run.
    playwrightConfig: {
      timeout: 45_000,
    },
    tags: ['checkout', `currency:${currency.toLowerCase()}`],
    environmentVariables: [{ key: 'CURRENCY_CODE', value: currency }],
    code: {
      entrypoint: './checkout-flow.spec.ts',
    },
  })
}
