import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
}

export async function neguraiListHandler(
  ctx: RequestContext,
  _req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const negurai = await deps.familyRepo.listNegurai(ctx.familyId)
  return { statusCode: 200, body: { negurai } }
}
