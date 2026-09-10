import { ApiCheck, AssertionBuilder, CheckGroup, Frequency } from 'checkly/constructs'
import { sreOncall } from './alert-channels'

/**
 * API checks against the Astronomy Shop's Next.js API routes.
 *
 * These sit a layer below the browser checks. When a checkout journey goes
 * red, the API checks answer "is this the browser, the frontend, or a
 * backend service?" without anyone opening Jaeger. If catalog is green and
 * checkout is red, the fault is downstream of catalog.
 */

const BASE_URL = process.env.ENVIRONMENT_URL ?? 'http://localhost:8080'

// Stable product from the demo seed data: National Park Foundation Explorascope.
const PRODUCT_ID = 'OLJCESPC7Z'
const SESSION_ID = 'checkly-synthetic-session'

export const apiGroup = new CheckGroup('astronomy-api-checks', {
  name: 'Astronomy Shop / Service APIs',
  activated: true,
  concurrency: 3,
  locations: ['eu-west-1'],
  tags: ['api', 'astronomy-shop'],
  alertChannels: [sreOncall],
})

/**
 * Product catalog, requested in EUR.
 *
 * The currencyCode parameter forces the request through the currency
 * service, so this single check covers catalog and currency conversion.
 * The assertion on the returned currencyCode is the important one: a 200
 * with prices silently falling back to USD is a failure the status code
 * will never tell you about.
 */
new ApiCheck('product-catalog-eur', {
  name: 'Product catalog - EUR conversion',
  group: apiGroup,
  frequency: Frequency.EVERY_2M,
  degradedResponseTime: 800,
  maxResponseTime: 3000,
  tags: ['catalog', 'currency'],
  request: {
    method: 'GET',
    url: `${BASE_URL}/api/products?currencyCode=EUR`,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.responseTime().lessThan(2000),
      AssertionBuilder.jsonBody('$[0].id').isNotNull(),
      AssertionBuilder.jsonBody('$[0].priceUsd.currencyCode').equals('EUR'),
    ],
  },
})

/**
 * Recommendation service, exercised through the frontend's API route.
 *
 * Recommendations are a soft dependency: the storefront still renders when
 * they fail, which is exactly why they rot unnoticed. A cheap check here
 * catches silent degradation on a path no user complains about.
 */
new ApiCheck('recommendations-service', {
  name: 'Recommendations - returns products',
  group: apiGroup,
  frequency: Frequency.EVERY_5M,
  degradedResponseTime: 1000,
  maxResponseTime: 4000,
  tags: ['recommendations'],
  request: {
    method: 'GET',
    url: `${BASE_URL}/api/recommendations?productIds=${PRODUCT_ID}&sessionId=${SESSION_ID}&currencyCode=USD`,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.responseTime().lessThan(3000),
      AssertionBuilder.jsonBody('$[0].id').isNotNull(),
      AssertionBuilder.jsonBody('$[0].name').isNotNull(),
    ],
  },
})

/**
 * Currency service, checked directly.
 *
 * If this goes red at the same moment a single-currency checkout check goes
 * red, the correlation does the triage for you.
 */
new ApiCheck('currency-service', {
  name: 'Currency service - supported codes',
  group: apiGroup,
  frequency: Frequency.EVERY_5M,
  degradedResponseTime: 500,
  maxResponseTime: 2000,
  tags: ['currency'],
  request: {
    method: 'GET',
    url: `${BASE_URL}/api/currency`,
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.responseTime().lessThan(1500),
      AssertionBuilder.jsonBody('$[0]').isNotNull(),
    ],
  },
})
