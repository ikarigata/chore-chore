import { randomUUID } from 'node:crypto'
import type { IFamilyRepository } from '../repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from '../types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
}

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

export async function familyInviteHandler(
  ctx: RequestContext,
  _req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const token = randomUUID()
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60

  await deps.familyRepo.createInvite(ctx.familyId, token, expiresAt)

  return {
    statusCode: 200,
    body: {
      token,
      url: `${FRONTEND_URL}/invite?token=${token}`,
      expiresAt,
    },
  }
}
