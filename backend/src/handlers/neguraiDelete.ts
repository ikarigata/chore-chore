import { NeguraiDeleteRequestSchema } from '@iezi/shared'
import { AppError } from '../errors.js'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
}

export async function neguraiDeleteHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const result = NeguraiDeleteRequestSchema.safeParse(req.body)
  if (!result.success) {
    throw new AppError(400, `入力形式が正しくありません: ${result.error.message}`)
  }

  const { neguraiId, timestamp } = result.data

  const negurai = await deps.familyRepo.getNegurai(ctx.familyId, neguraiId, timestamp)
  if (!negurai) {
    throw new AppError(404, '対象のねぎらいが見つかりません')
  }

  // 記録者（receiverSub = ctx.cognitoSub）のみ削除可能
  // ConditionExpression で ReceiverSub チェックを行う
  await deps.familyRepo.deleteNegurai(ctx.familyId, ctx.cognitoSub, {
    neguraiId,
    timestamp,
    points: negurai.points,
    giverSub: negurai.giverSub,
  })

  return { statusCode: 200, body: { message: 'ねぎらいの記録を取り消しました' } }
}
