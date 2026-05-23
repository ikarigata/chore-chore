import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'
import { getJSTDateString } from '../utils/time.js'

interface Deps {
  familyRepo: IFamilyRepository
}

const WINDOW_DAYS = 7

// YYYY-MM-DD の日付文字列から N 日引いた日付を JST で返す
function subtractDaysJST(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  // UTC 正午基準で計算することで DST やローカルタイム影響を回避
  const base = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0))
  base.setUTCDate(base.getUTCDate() - days)
  return getJSTDateString(base)
}

export async function summaryWeeklyHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const to = req.queryParams['endDate'] ?? getJSTDateString(new Date())
  const from = subtractDaysJST(to, WINDOW_DAYS - 1)
  const summaries = await deps.familyRepo.getWeeklySummaries(ctx.familyId, from, to)
  return { statusCode: 200, body: { from, to, summaries } }
}
