import { getJSTDateString } from './time'

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function parseMonth(monthKey: string): { year: number; month: number } {
  if (!MONTH_PATTERN.test(monthKey)) {
    throw new Error(`invalid month key: ${monthKey}`)
  }
  const [y, m] = monthKey.split('-')
  return { year: Number(y), month: Number(m) }
}

function formatMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function formatDate(year: number, month: number, day: number): string {
  return `${formatMonth(year, month)}-${String(day).padStart(2, '0')}`
}

/** JST の今月キー ("YYYY-MM") を返す */
export function currentMonthKey(): string {
  return getJSTDateString(new Date()).slice(0, 7)
}

/** "YYYY-MM" の前月キー */
export function prevMonth(monthKey: string): string {
  const { year, month } = parseMonth(monthKey)
  return month === 1 ? formatMonth(year - 1, 12) : formatMonth(year, month - 1)
}

/** "YYYY-MM" の次月キー */
export function nextMonth(monthKey: string): string {
  const { year, month } = parseMonth(monthKey)
  return month === 12 ? formatMonth(year + 1, 1) : formatMonth(year, month + 1)
}

/** "YYYY-MM-DD" が "YYYY-MM" に属するか */
export function isInMonth(dateKey: string, monthKey: string): boolean {
  return dateKey.startsWith(`${monthKey}-`)
}

/**
 * カレンダーグリッドに並べる dateKey 配列を返す。
 * 月初を含む週の日曜から、月末を含む週の土曜まで（5週=35 または 6週=42 要素）。
 */
export function buildMonthGrid(monthKey: string): string[] {
  const { year, month } = parseMonth(monthKey)
  // UTC 正午基準で計算して DST やローカルタイム影響を排除
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1, 12))
  const lastDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate()
  const firstWeekday = firstOfMonth.getUTCDay() // 0 = 日曜

  const start = new Date(firstOfMonth)
  start.setUTCDate(1 - firstWeekday)

  const totalDays = firstWeekday + lastDay
  const weeks = Math.ceil(totalDays / 7)
  const cells = weeks * 7

  const grid: string[] = []
  for (let i = 0; i < cells; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    grid.push(formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()))
  }
  return grid
}
