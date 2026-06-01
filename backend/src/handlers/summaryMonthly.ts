import { AppError } from '../errors.js'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'
import { getJSTDateString } from '../utils/time.js'

interface Deps {
  familyRepo: IFamilyRepository
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function currentMonthKey(): string {
  return getJSTDateString(new Date()).slice(0, 7)
}

function monthBounds(monthKey: string): { from: string; to: string } {
  const [yStr, mStr] = monthKey.split('-')
  const year = Number(yStr)
  const month = Number(mStr)
  const from = `${monthKey}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const to = `${monthKey}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

export async function summaryMonthlyHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const month = req.queryParams['month'] ?? currentMonthKey()
  if (!MONTH_PATTERN.test(month)) {
    throw new AppError(400, 'month は YYYY-MM 形式で指定してください')
  }
  const { from, to } = monthBounds(month)
  const summaries = await deps.familyRepo.getWeeklySummaries(ctx.familyId, from, to)
  return { statusCode: 200, body: { month, from, to, summaries } }
}
