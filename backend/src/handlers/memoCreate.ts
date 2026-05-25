import { MemoCreateRequestSchema } from '@iezi/shared'
import { AppError } from '../errors.js'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'
import { memoExpiresAt } from '../utils/time.js'

interface Deps {
  familyRepo: IFamilyRepository
}

export async function memoCreateHandler(
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const result = MemoCreateRequestSchema.safeParse(req.body)
  if (!result.success) {
    throw new AppError(400, `入力形式が正しくありません: ${result.error.message}`)
  }

  const { memoId, content } = result.data
  const timestamp = new Date().toISOString()

  await deps.familyRepo.createMemo(ctx.familyId, ctx.cognitoSub, {
    memoId,
    content,
    timestamp,
    expiresAt: memoExpiresAt(),
  })

  return { statusCode: 200, body: { message: 'メモを追加しました' } }
}
