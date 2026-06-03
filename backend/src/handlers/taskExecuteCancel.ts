import { TaskHistoryDeleteRequestSchema } from '@iezi/shared'
import { AppError } from '../errors.js'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'
import { getJSTDateString } from '../utils/time.js'

interface Deps {
  familyRepo: IFamilyRepository
}

export async function taskExecuteCancelHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const result = TaskHistoryDeleteRequestSchema.safeParse(req.body)
  if (!result.success) {
    throw new AppError(400, `入力形式が正しくありません: ${result.error.message}`)
  }

  const { taskExecutionId, timestamp } = result.data

  const history = await deps.familyRepo.getTaskHistory(
    ctx.familyId,
    ctx.cognitoSub,
    taskExecutionId,
    timestamp,
  )
  if (!history) {
    throw new AppError(404, '対象の家事履歴が見つかりません')
  }

  const dailyDate = getJSTDateString(new Date(timestamp))

  await deps.familyRepo.deleteTaskHistory(ctx.familyId, ctx.cognitoSub, {
    taskExecutionId,
    timestamp,
    points: history.points,
    dailyDate,
  })

  return { statusCode: 200, body: { message: '家事の記録を取り消しました' } }
}
