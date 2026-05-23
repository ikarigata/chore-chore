import { randomUUID } from 'node:crypto'
import { FamilyCreateRequestSchema } from '@iezi/shared'
import { AppError } from '../errors.js'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { ICognitoService } from '../services/ICognitoService.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
  cognitoService: ICognitoService
}

export async function familyCreateHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  if (ctx.familyId) throw new AppError(409, '既に家族に所属しています')

  const result = FamilyCreateRequestSchema.safeParse(req.body)
  if (!result.success) {
    throw new AppError(400, `入力形式が正しくありません: ${result.error.message}`)
  }
  const { displayName } = result.data

  const familyId = `fam_${randomUUID()}`
  await deps.familyRepo.createFamily(familyId, ctx.cognitoSub, displayName.trim())
  await deps.cognitoService.setFamilyId(ctx.cognitoSub, familyId)

  return { statusCode: 200, body: { familyId } }
}
