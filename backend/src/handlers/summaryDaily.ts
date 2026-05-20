import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'
import { getJSTDateString } from '../utils/time.js'

interface Deps {
  familyRepo: IFamilyRepository
}

export async function summaryDailyHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const date = req.queryParams['date'] ?? getJSTDateString(new Date())
  const summaries = await deps.familyRepo.getDailySummaries(ctx.familyId, date)
  return { statusCode: 200, body: { date, summaries } }
}
