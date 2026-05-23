import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
}

export async function familyInitHandler(
  ctx: RequestContext,
  _req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const [users, taskMasters] = await Promise.all([
    deps.familyRepo.listFamilyMembers(ctx.familyId),
    deps.familyRepo.listTaskMasters(ctx.familyId),
  ])
  return { statusCode: 200, body: { users, taskMasters } }
}
