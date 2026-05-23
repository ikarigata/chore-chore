import { TaskHistoryCreateRequestSchema } from '@iezi/shared'
import { AppError } from '../errors.js'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'
import { dailySummaryExpiresAt, getJSTDateString, historyExpiresAt } from '../utils/time.js'

interface Deps {
  familyRepo: IFamilyRepository
}

export async function taskExecuteHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const result = TaskHistoryCreateRequestSchema.safeParse(req.body)
  if (!result.success) {
    throw new AppError(400, `入力形式が正しくありません: ${result.error.message}`)
  }

  const { taskId, taskExecutionId } = result.data

  const task = await deps.familyRepo.getTaskMaster(ctx.familyId, taskId)
  if (!task) {
    throw new AppError(404, '指定された家事が見つかりません')
  }

  const now = new Date()
  await deps.familyRepo.createTaskHistory(ctx.familyId, ctx.cognitoSub, {
    taskExecutionId,
    taskId,
    timestamp: now.toISOString(),
    points: task.points,
    expiresAt: historyExpiresAt(),
    dailyDate: getJSTDateString(now),
    dailyExpiresAt: dailySummaryExpiresAt(),
  })

  return { statusCode: 200, body: { message: '家事を記録しました' } }
}
