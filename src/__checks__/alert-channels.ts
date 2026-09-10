import { EmailAlertChannel } from 'checkly/constructs'

/**
 * Routing is the part of the narrative that actually changes who finds out.
 *
 * In the "before" story the first signal is a customer support ticket at
 * 10:15, which means the first person who knows is the person least able to
 * fix it. Below, the checkout journeys page Quality Engineering first,
 * because a failing user journey is a quality signal before it is an
 * infrastructure one. Infrastructure-level checks page the SRE rotation.
 *
 * Swap these for a Slack, PagerDuty or Opsgenie channel construct and the
 * shape of the file does not change.
 */

const sendDefaults = {
  sendRecovery: true,
  sendFailure: true,
  sendDegraded: true,
  sslExpiry: false,
}

export const qualityEngineering = new EmailAlertChannel('qe-alerts', {
  address: 'quality-engineering@example.com',
  ...sendDefaults,
})

export const sreOncall = new EmailAlertChannel('sre-oncall', {
  address: 'sre-oncall@example.com',
  ...sendDefaults,
  // Recovery notifications matter more to the on-call rotation than to QE:
  // it is the difference between "still broken" and "self-healed at 09:47".
  sendRecovery: true,
})
