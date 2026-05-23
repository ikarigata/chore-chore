// sv-SE ロケールは YYYY-MM-DD 形式を返す（backend/src/utils/time.ts と同じロジック）
export function getJSTDateString(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}
