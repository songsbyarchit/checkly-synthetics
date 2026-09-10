# Astronomy Shop Synthetics

Checkly monitoring-as-code for the [OpenTelemetry Demo](https://github.com/open-telemetry/opentelemetry-demo)
("Astronomy Shop"), running locally under Docker Desktop with its default
Grafana, Prometheus and Jaeger stack.

## The problem this is solving

The OTel demo is already instrumented to a standard most production estates
never reach. Traces, metrics and logs all flow, and the built-in Grafana
Spanmetrics dashboard shows checkout p95 sitting around 272ms.

That dashboard is an aggregate. Aggregates dilute.

When one currency path degrades and it accounts for roughly 4% of traffic,
the aggregate p95 barely moves. The failure is real, it is 100% of the users
on that path, and it is invisible until someone files a support ticket. The
trace is sitting in Jaeger the whole time, but nobody goes looking for a
trace they have no reason to believe exists.

Synthetics segment. That is the whole argument.

## What is here

| File | What it does |
| --- | --- |
| `src/__checks__/checkout-flow.spec.ts` | Playwright checkout journey, parameterised by `CURRENCY_CODE` |
| `src/__checks__/checkout-per-currency.check.ts` | Deploys that spec once per currency (USD, EUR, GBP, JPY) |
| `src/__checks__/catalog-api.check.ts` | API checks: product catalog with EUR conversion, recommendations, currency service |
| `src/__checks__/storefront-uptime.check.ts` | URL monitor on the storefront, 1-minute frequency |
| `src/__checks__/alert-channels.ts` | Routing: checkout journeys to Quality Engineering, infrastructure to SRE on-call |
| `checkly.config.ts` | Project defaults, retry strategy, runtime |

Three layers, deliberately:

1. **URL monitor** — is the shop reachable at all. Cheapest signal, highest frequency.
2. **API checks** — is a given service healthy, independent of the browser.
3. **Browser checks** — can a real user in a specific currency actually buy something.

When layer 3 goes red and layers 1 and 2 stay green, triage has already
narrowed to the checkout path before anyone opens a dashboard.

## Selectors

The browser check uses the `data-cy` attributes the OTel demo frontend ships
with, defined in `src/frontend/utils/enums/CypressFields.ts` upstream. No
scraped class names, no XPath into styled-components hashes. The selectors
are maintained by the application team as part of the application.

## Running it

The Astronomy Shop runs on `http://localhost:8080` by default. Checkly's
public runners cannot reach localhost, so pick one:

**Option A — public tunnel (fastest)**

```bash
cloudflared tunnel --url http://localhost:8080
export ENVIRONMENT_URL="https://<generated>.trycloudflare.com"
```

**Option B — Checkly Private Location (what a real customer does)**

Run the Checkly agent as a container alongside the demo, so checks execute
inside the same Docker network and reach the frontend directly. This is the
answer for anything in pre-prod or behind a firewall.

Then:

```bash
npm install
npx checkly login
npx checkly test          # dry run, nothing deployed
npx checkly deploy        # creates the checks in the account
```

`npx checkly test` runs the checks without creating them. That is the
property that makes this a CI gate as well as a monitoring config: the same
files that monitor production can block a bad deploy from reaching it.

## Adding a currency

```diff
- const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'] as const
+ const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF'] as const
```

One string, one pull request, one review. That is the monitoring-as-code
argument at its smallest.
