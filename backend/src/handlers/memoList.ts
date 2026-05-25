import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
}

export async function memoListHandler(
  ctx: RequestContext,
  _req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const memos = await deps.familyRepo.listMemos(ctx.familyId)
  return { statusCode: 200, body: { memos } }
}
