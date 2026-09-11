import { expect, test } from '@playwright/test'

/**
 * End-to-end checkout journey against the OpenTelemetry Demo storefront.
 *
 * Parameterised by CURRENCY_CODE. One deployed check per currency means a
 * failure isolated to a single currency path surfaces as one red check with
 * the currency already in its name, instead of a small dip in an aggregate
 * success-rate panel.
 *
 * Each currency also ships to a matching country. That matters: it makes the
 * synthetic a realistic user rather than a US shopper who happens to have
 * switched the price display. It also means a fault on the international
 * shipping path degrades the non-USD checks and leaves USD green, which is
 * the segmentation argument made visible.
 *
 * Selectors are the data-cy attributes the OTel demo frontend ships with
 * (src/frontend/utils/enums/CypressFields.ts), so they are maintained
 * upstream by the application team rather than scraped from the DOM.
 */

const BASE_URL = process.env.ENVIRONMENT_URL ?? 'http://localhost:8080'
const CURRENCY = process.env.CURRENCY_CODE ?? 'USD'

type Locale = {
  email: string
  streetAddress: string
  zipCode: string
  city: string
  state: string
  country: string
}

const LOCALES: Record<string, Locale> = {
  USD: {
    email: 'synthetic-usd@checkly.example',
    streetAddress: '1600 Amphitheatre Parkway',
    zipCode: '94043',
    city: 'Mountain View',
    state: 'CA',
    country: 'United States',
  },
  EUR: {
    email: 'synthetic-eur@checkly.example',
    streetAddress: 'Friedrichstrasse 68',
    zipCode: '10117',
    city: 'Berlin',
    state: 'BE',
    country: 'Germany',
  },
  GBP: {
    email: 'synthetic-gbp@checkly.example',
    streetAddress: '10 Finsbury Square',
    zipCode: 'EC2A 1AF',
    city: 'London',
    state: 'LDN',
    country: 'United Kingdom',
  },
  JPY: {
    email: 'synthetic-jpy@checkly.example',
    streetAddress: '2-11-3 Meguro',
    zipCode: '153-0063',
    city: 'Tokyo',
    state: 'TK',
    country: 'Japan',
  },
}

const locale = LOCALES[CURRENCY] ?? LOCALES.USD

const sel = {
  productCard: '[data-cy="product-card"]',
  productPrice: '[data-cy="product-price"]',
  productDetail: '[data-cy="product-detail"]',
  productQuantity: '[data-cy="product-quantity"]',
  addToCart: '[data-cy="product-add-to-cart"]',
  currencySwitcher: '[data-cy="currency-switcher"]',
  placeOrder: '[data-cy="checkout-place-order"]',
}

test.describe.configure({ mode: 'serial' })

test(`checkout journey [${CURRENCY} / ${locale.country}]`, async ({ page }) => {
  await test.step('storefront loads', async () => {
    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    expect(response?.status(), 'storefront HTTP status').toBeLessThan(400)
    await expect(page.locator(sel.productCard).first()).toBeVisible({ timeout: 20_000 })
  })

  await test.step(`currency switches to ${CURRENCY}`, async () => {
    const switcher = page.locator(sel.currencySwitcher)
    await expect(switcher).toBeVisible()
    await switcher.selectOption(CURRENCY)
    await expect(switcher).toHaveValue(CURRENCY)

    // Prices are re-fetched through the currency service on switch. If that
    // service is degraded, it shows here, before any order is placed.
    await expect(page.locator(sel.productPrice).first()).toBeVisible({ timeout: 15_000 })
  })

  await test.step('product detail opens', async () => {
    await page.locator(sel.productCard).first().click()
    await expect(page.locator(sel.productDetail)).toBeVisible({ timeout: 15_000 })
    await expect(page.locator(sel.productPrice).first()).toBeVisible()
  })

  await test.step('item is added to cart', async () => {
    await page.locator(sel.productQuantity).selectOption('1')
    await page.locator(sel.addToCart).click()
    // The demo routes to /cart after a successful add.
    await page.waitForURL(/\/cart/, { timeout: 20_000 })
  })

  await test.step(`shipping details for ${locale.country}`, async () => {
    // The demo pre-fills a US address. Overwriting it with a locale that
    // matches the currency is what puts this journey on the international
    // shipping path instead of the domestic one.
    await page.fill('#email', locale.email)
    await page.fill('#street_address', locale.streetAddress)
    await page.fill('#zip_code', locale.zipCode)
    await page.fill('#city', locale.city)
    await page.fill('#state', locale.state)
    await page.fill('#country', locale.country)
  })

  await test.step('order is placed', async () => {
    const placeOrder = page.locator(sel.placeOrder)
    await expect(placeOrder).toBeVisible({ timeout: 15_000 })
    // Card details are left at the demo defaults, so this step measures the
    // checkout, shipping and payment path and nothing else.
    await placeOrder.click()
    await page.waitForURL(/\/cart\/checkout\//, { timeout: 30_000 })
  })

  await test.step('confirmation is rendered', async () => {
    await expect(page.getByText('Your order is complete!')).toBeVisible({ timeout: 15_000 })

    // An order ID that is present and non-empty is the difference between
    // "the page rendered" and "the order actually completed".
    const orderId = page.locator('text=Order ID:').locator('xpath=following-sibling::*[1]')
    await expect(orderId).not.toBeEmpty()

    await page.screenshot({ path: `confirmation-${CURRENCY}.png` })
  })
})
