import { Frequency, UrlMonitor, UrlAssertionBuilder } from 'checkly/constructs'
import { sreOncall } from './alert-channels'

/**
 * Storefront availability.
 *
 * Deliberately a URL monitor, not a heartbeat check. In Checkly's model a
 * heartbeat check is passive: a cron job or worker pings Checkly, and the
 * check fails when that ping does not arrive. That is the right tool for
 * "did the nightly settlement job run", not for "is the shop up".
 *
 * A URL monitor is the active equivalent: cheapest possible signal, highest
 * possible frequency, no Playwright runtime. It is the floor of the stack.
 * If this is red, nothing above it is worth reading.
 */

const BASE_URL = process.env.ENVIRONMENT_URL ?? 'http://localhost:8080'

new UrlMonitor('storefront-uptime', {
  name: 'Astronomy Shop - storefront uptime',
  activated: true,
  frequency: Frequency.EVERY_1M,
  locations: ['eu-west-1', 'us-east-1'],
  tags: ['uptime', 'astronomy-shop'],
  alertChannels: [sreOncall],
  degradedResponseTime: 1500,
  maxResponseTime: 5000,
  request: {
    url: BASE_URL,
    followRedirects: true,
    skipSSL: false,
    assertions: [UrlAssertionBuilder.statusCode().equals(200)],
  },
})
