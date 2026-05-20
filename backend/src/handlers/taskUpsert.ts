import { AppError } from '../errors.js'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
}

interface UpsertBody {
  taskId?: string
  taskName?: string
  points?: number
  icon?: string
}

export async function taskUpsertHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const { taskId, taskName, points, icon } = req.body as UpsertBody

  if (!taskId || !taskName || points === undefined || !icon) {
    throw new AppError(400, 'taskId、taskName、points、icon は必須です')
  }
  if (points < 0) {
    throw new AppError(400, 'points は0以上である必要があります')
  }

  await deps.familyRepo.upsertTaskMaster(ctx.familyId, { taskId, taskName, points, icon })

  return { statusCode: 200, body: { message: '家事設定を保存しました' } }
}
