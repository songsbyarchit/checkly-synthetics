import { BrowserCheck, CheckGroup, Frequency, RetryStrategyBuilder } from 'checkly/constructs'
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
  locations: ['eu-central-1', 'us-east-1'],
  tags: ['checkout', 'revenue-path'],
  alertChannels: [qualityEngineering, sreOncall],
  // Setting noRetries() on each check alone isn't enough: it synthesizes to
  // retryStrategy: null, which Checkly treats as "inherit from the group,"
  // and this group otherwise falls back to a platform default retry. Has
  // to be set here explicitly too, or retries silently keep happening.
  retryStrategy: RetryStrategyBuilder.noRetries(),
  environmentVariables: [
    { key: 'ENVIRONMENT_URL', value: process.env.ENVIRONMENT_URL ?? 'http://localhost:8080' },
  ],
})

for (const currency of CURRENCIES) {
  new BrowserCheck(`checkout-${currency.toLowerCase()}`, {
    name: `Checkout journey - ${currency}`,
    group: checkoutGroup,
    frequency: Frequency.EVERY_5M,
    // Overrides the project's default 2-retry strategy. Retries exist to
    // stop a single network blip from paging someone - the right call for
    // the API checks. But this check's whole job is to catch the first
    // sign of a currency-scoped incident, so masking a genuine first
    // failure with a lucky cross-region retry defeats the point of it.
    retryStrategy: RetryStrategyBuilder.noRetries(),
    tags: ['checkout', `currency:${currency.toLowerCase()}`],
    environmentVariables: [{ key: 'CURRENCY_CODE', value: currency }],
    code: {
      entrypoint: './checkout-flow.spec.ts',
    },
    // IMPORTANT: the actual pass/fail threshold for these checks is NOT
    // expressible in this file. degradedResponseTime/maxResponseTime are
    // real fields on the Checkly platform for browser checks, but this
    // project's checkly SDK (6.9.10, several majors behind current) doesn't
    // wire them through BrowserCheck's constructor at all - not just a type
    // restriction, the JS silently drops them even with a type-cast.
    // playwrightConfig.timeout looked like the SDK-sanctioned alternative,
    // but a separate CLI bug in this version drops it on deploy too
    // (confirmed via the API: stayed null after multiple successful-looking
    // deploys). The threshold that's actually live was set via a direct API
    // PUT to maxResponseTime/degradedResponseTime, outside this codebase,
    // and is NOT reapplied by `checkly deploy` - a deploy resets it back to
    // the SDK's 20s default. Validated: domestic (USD) stayed 9.4-10.9s
    // across repeated runs, international (EUR/GBP/JPY) never dropped below
    // 16.0s. 13s sits with real margin on both sides. Upgrading the checkly
    // package to current would let this be expressed here properly.
  })
}
