const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60
const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60

// sv-SE ロケールは YYYY-MM-DD 形式を返す
export function getJSTDateString(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

export function unixSecondsFromNow(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds
}

export function historyExpiresAt(): number {
  return unixSecondsFromNow(ONE_YEAR_SECONDS)
}

export function dailySummaryExpiresAt(): number {
  return unixSecondsFromNow(NINETY_DAYS_SECONDS)
}
