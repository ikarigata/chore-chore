import { AppError } from '../errors.js'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { ICognitoService } from '../services/ICognitoService.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
  cognitoService: ICognitoService
}

export async function familyJoinHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  if (ctx.familyId) throw new AppError(409, '既に家族に所属しています')

  const body = req.body as { token?: unknown; displayName?: unknown }
  const token = typeof body.token === 'string' ? body.token : ''
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  if (!token || !displayName) throw new AppError(400, 'token と displayName は必須です')

  const familyId = await deps.familyRepo.consumeInvite(token, ctx.cognitoSub, displayName)
  await deps.cognitoService.setFamilyId(ctx.cognitoSub, familyId)

  return { statusCode: 200, body: { familyId } }
}
