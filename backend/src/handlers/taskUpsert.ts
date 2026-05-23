import { TaskMasterUpsertRequestSchema } from '@iezi/shared'
import { AppError } from '../errors.js'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
}

export async function taskUpsertHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const result = TaskMasterUpsertRequestSchema.safeParse(req.body)
  if (!result.success) {
    throw new AppError(400, `入力形式が正しくありません: ${result.error.message}`)
  }

  const { taskId, taskName, points, categoryId } = result.data

  if (points < 0) {
    throw new AppError(400, 'points は0以上である必要があります')
  }

  const input = { taskId, taskName, points, ...(categoryId !== undefined && { categoryId }) }
  await deps.familyRepo.upsertTaskMaster(ctx.familyId, input)

  return { statusCode: 200, body: { message: '家事設定を保存しました' } }
}
