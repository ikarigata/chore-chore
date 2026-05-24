// sv-SE ロケールは YYYY-MM-DD 形式を返す（backend/src/utils/time.ts と同じロジック）
export function getJSTDateString(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

/**
 * 日付選択UIで選ばれた YYYY-MM-DD を、API に渡す RFC3339 文字列に変換する。
 * - 今日 → 現在時刻（受信側で並びが自然になる）
 * - 過去日 → JST 正午固定。時刻入力を求めない設計なので決定的な値を採用し、SK 順序を安定させる
 */
export function dateKeyToTimestamp(dateKey: string): string {
  if (dateKey === getJSTDateString(new Date())) {
    return new Date().toISOString()
  }
  return new Date(`${dateKey}T12:00:00+09:00`).toISOString()
}

/** 今日から daysBack 日前までの JST 日付キー（新しい順）。daysBack=7 なら 8 要素 */
export function getRecentDateKeys(daysBack = 7): string[] {
  const now = Date.now()
  const keys: string[] = []
  for (let i = 0; i <= daysBack; i++) {
    keys.push(getJSTDateString(new Date(now - i * 86_400_000)))
  }
  return keys
}
