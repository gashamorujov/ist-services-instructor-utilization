import { describe, expect, it } from 'vitest'
import { daysInMonth, isLeapYear, monthLabel, nextMonth, dateKey } from '../utils/dates'

describe('dates', () => {
  it('TEST 1: September 2026 has 30 days', () => {
    expect(daysInMonth(2026, 9)).toBe(30)
  })
  it('TEST 14: October 2026 has 31 days', () => {
    expect(daysInMonth(2026, 10)).toBe(31)
  })
  it('TEST 15: February 2027 has 28 days (non-leap)', () => {
    expect(daysInMonth(2027, 2)).toBe(28)
  })
  it('leap year: February 2028 has 29 days', () => {
    expect(isLeapYear(2028)).toBe(true)
    expect(daysInMonth(2028, 2)).toBe(29)
  })
  it('month labels are in Azerbaijani', () => {
    expect(monthLabel(2026, 9)).toBe('Sentyabr 2026')
    expect(monthLabel(2027, 1)).toBe('Yanvar 2027')
  })
  it('nextMonth rolls over years', () => {
    expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 })
    expect(nextMonth(2026, 9)).toEqual({ year: 2026, month: 10 })
  })
  it('dateKey pads values', () => {
    expect(dateKey(2026, 10, 2)).toBe('2026-10-02')
  })
})
