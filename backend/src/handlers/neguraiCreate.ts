import { NeguraiCreateRequestSchema } from '@iezi/shared'
import { AppError } from '../errors.js'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'
import { historyExpiresAt } from '../utils/time.js'

interface Deps {
  familyRepo: IFamilyRepository
}

export async function neguraiCreateHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const result = NeguraiCreateRequestSchema.safeParse(req.body)
  if (!result.success) {
    throw new AppError(400, `入力形式が正しくありません: ${result.error.message}`)
  }

  const { neguraiId, giverSub, description, points } = result.data

  // ねぎらいを受け取った側（記録者自身）がねぎらった側（giverSub）へ送る
  // 記録者 = receiverSub = ctx.cognitoSub
  if (giverSub === ctx.cognitoSub) {
    throw new AppError(400, '自分自身へのねぎらいは登録できません')
  }

  const timestamp = new Date().toISOString()

  await deps.familyRepo.createNegurai(ctx.familyId, ctx.cognitoSub, {
    neguraiId,
    giverSub,
    description,
    points,
    timestamp,
    expiresAt: historyExpiresAt(),
  })

  return { statusCode: 200, body: { message: 'ねぎらいを記録しました' } }
}
