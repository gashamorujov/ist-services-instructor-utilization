import { test, expect } from '@playwright/test'

test('full instructor-utilization flow', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto('/')

  // Log in as admin
  await page.selectOption('select', 'admin')
  await page.getByPlaceholder('Adınızı daxil edin').fill('Test Admin')
  await page.getByRole('button', { name: 'Daxil ol' }).click()

  // Wait for schedule to render
  await expect(page.getByText('Tədris cədvəli')).toBeVisible({ timeout: 20000 })

  // TEST 1: September 2026 has 30 day headers
  await expect(page.getByTestId('month-tab-2026-09')).toBeVisible()
  const header30 = page.locator('th').filter({ hasText: /^30$/ })
  await expect(header30).toHaveCount(1)
  // 30 numeric day headers
  const dayHeaders = page.locator('thead th').filter({ hasText: /^\d+$/ })
  expect(await dayHeaders.count()).toBe(30)

  // TEST 2/3: type SH into teacher1 day1 -> spreads to day2
  const cell = page.getByTestId('cell-t_1-1')
  await cell.click()
  await cell.press('s')
  await cell.locator('input').fill('SH')
  await cell.locator('input').press('Enter')
  await expect(page.getByTestId('cell-t_1-1')).toContainText('SH')
  await expect(page.getByTestId('cell-t_1-2')).toContainText('SH')
  // only 2 days, day3 empty
  await expect(page.getByTestId('cell-t_1-3')).not.toContainText('SH')

  // SL 4 days starting day 5
  const cell5 = page.getByTestId('cell-t_1-5')
  await cell5.click()
  await cell5.press('s')
  await cell5.locator('input').fill('SL')
  await cell5.locator('input').press('Enter')
  await expect(page.getByTestId('cell-t_1-5')).toContainText('SL')
  await expect(page.getByTestId('cell-t_1-6')).toContainText('SL')
  await expect(page.getByTestId('cell-t_1-7')).toContainText('SL')
  await expect(page.getByTestId('cell-t_1-8')).toContainText('SL')
  await expect(page.getByTestId('cell-t_1-9')).not.toContainText('SL')

  // Payments: Rəhimov Ehtiram Bəşir oğlu -> 2 courses, 48 hrs, 140 AZN
  const payRow = page.locator('tbody tr', { hasText: 'Rəhimov Ehtiram Bəşir oğlu' }).last()
  await expect(payRow).toContainText('2')
  await expect(payRow).toContainText('48')
  await expect(payRow).toContainText('140 AZN')

  // TEST 6: open SL panel via double click and set PAID
  await page.getByTestId('cell-t_1-5').dblclick()
  await expect(page.getByText('Kurs məlumatı')).toBeVisible()
  await page.selectOption('select', 'PAID')
  await page.getByRole('button', { name: 'Yadda saxla' }).click()
  await expect(page.getByTestId('cell-t_1-5').locator('div')).toHaveCSS('color', 'rgb(0, 128, 0)')
  await expect(page.getByTestId('cell-t_1-8').locator('div')).toHaveCSS('color', 'rgb(0, 128, 0)')

  // TEST 12: X — single click, press 'x' (begins edit), press Enter
  const xcell = page.getByTestId('cell-t_2-10')
  await xcell.click()
  await xcell.press('x')
  await xcell.locator('input').press('Enter')
  await page.waitForTimeout(500)
  await expect(page.getByTestId('cell-t_2-10')).toContainText('X')

  // TEST 14: add October -> 31 days
  await page.getByRole('button', { name: 'Ay əlavə et' }).click()
  await expect(page.getByTestId('month-tab-2026-10')).toBeVisible()
  await page.getByTestId('month-tab-2026-10').click()
  const octHeaders = page.locator('thead th').filter({ hasText: /^\d+$/ })
  expect(await octHeaders.count()).toBe(31)

  // TEST 16/17: export downloads
  const dl = page.waitForEvent('download')
  await page.getByTestId('export-month').click()
  const file = await dl
  expect(file.suggestedFilename()).toContain('.xlsx')

  expect(errors.filter((e) => !e.includes('favicon') && !e.includes('404') && !e.includes('400'))).toEqual([])
})
