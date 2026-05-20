import { AppError } from '../errors.js'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
}

export async function taskDeleteHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const { taskId } = req.pathParams

  if (!taskId) {
    throw new AppError(400, 'taskId は必須です')
  }

  await deps.familyRepo.deleteTaskMaster(ctx.familyId, taskId)

  return { statusCode: 200, body: { message: '家事設定を削除しました' } }
}
