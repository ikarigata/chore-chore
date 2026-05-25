import { MemoDeleteRequestSchema } from '@iezi/shared'
import { AppError } from '../errors.js'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
}

export async function memoDeleteHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const result = MemoDeleteRequestSchema.safeParse(req.body)
  if (!result.success) {
    throw new AppError(400, `入力形式が正しくありません: ${result.error.message}`)
  }

  const { memoId, timestamp } = result.data

  await deps.familyRepo.deleteMemo(ctx.familyId, { memoId, timestamp })

  return { statusCode: 200, body: { message: 'メモを削除しました' } }
}
