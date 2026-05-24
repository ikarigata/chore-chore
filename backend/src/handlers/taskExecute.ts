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

  const { taskId, taskExecutionId, timestamp } = result.data

  const task = await deps.familyRepo.getTaskMaster(ctx.familyId, taskId)
  if (!task) {
    throw new AppError(404, '指定された家事が見つかりません')
  }

  const now = new Date()
  const eventDate = timestamp ? new Date(timestamp) : now

  if (timestamp) {
    if (eventDate.getTime() > now.getTime()) {
      throw new AppError(400, '未来日は指定できません')
    }
    // 7日より前 = 8日以上前を拒否（今日含む直近8日のみ許容）
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000
    if (eventDate.getTime() < sevenDaysAgo) {
      throw new AppError(400, '7日より前の日付は指定できません')
    }
  }

  await deps.familyRepo.createTaskHistory(ctx.familyId, ctx.cognitoSub, {
    taskExecutionId,
    taskId,
    timestamp: eventDate.toISOString(),
    points: task.points,
    expiresAt: historyExpiresAt(),
    dailyDate: getJSTDateString(eventDate),
    dailyExpiresAt: dailySummaryExpiresAt(),
  })

  return { statusCode: 200, body: { message: '家事を記録しました' } }
}
