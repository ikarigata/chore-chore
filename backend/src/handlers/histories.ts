import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
}

export async function historiesHandler(
  ctx: RequestContext,
  _req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const taskHistories = await deps.familyRepo.listTaskHistories(ctx.familyId)
  return { statusCode: 200, body: { taskHistories } }
}
