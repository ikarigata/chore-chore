import { AppError } from '../errors.js'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'
import { getJSTDateString } from '../utils/time.js'

interface Deps {
  familyRepo: IFamilyRepository
}

interface CancelBody {
  taskExecutionId?: string
  timestamp?: string
  points?: number
}

export async function taskExecuteCancelHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const { taskExecutionId, timestamp, points } = req.body as CancelBody

  if (!taskExecutionId || !timestamp || points === undefined) {
    throw new AppError(400, 'taskExecutionId、timestamp、points は必須です')
  }
  if (points <= 0) {
    throw new AppError(400, 'points は正の値である必要があります')
  }

  // 元の履歴のタイムスタンプから JST 日付を復元して DAILY SK を構築する
  const dailyDate = getJSTDateString(new Date(timestamp))

  await deps.familyRepo.cancelTask(ctx.familyId, ctx.cognitoSub, {
    taskExecutionId,
    timestamp,
    points,
    dailyDate,
  })

  return { statusCode: 200, body: { message: '家事の記録を取り消しました' } }
}
