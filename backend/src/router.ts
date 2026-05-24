import { AppError } from './errors.js'
import { familyCreateHandler } from './handlers/familyCreate.js'
import { familyInitHandler } from './handlers/familyInit.js'
import { familyInviteHandler } from './handlers/familyInvite.js'
import { familyJoinHandler } from './handlers/familyJoin.js'
import { historiesHandler } from './handlers/histories.js'
import { neguraiCreateHandler } from './handlers/neguraiCreate.js'
import { neguraiDeleteHandler } from './handlers/neguraiDelete.js'
import { neguraiListHandler } from './handlers/neguraiList.js'
import { summaryDailyHandler } from './handlers/summaryDaily.js'
import { summaryWeeklyHandler } from './handlers/summaryWeekly.js'
import { taskDeleteHandler } from './handlers/taskDelete.js'
import { taskExecuteHandler } from './handlers/taskExecute.js'
import { taskExecuteCancelHandler } from './handlers/taskExecuteCancel.js'
import { taskUpsertHandler } from './handlers/taskUpsert.js'
import type { IFamilyRepository } from './repositories/IFamilyRepository.js'
import type { ICognitoService } from './services/ICognitoService.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from './types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
  cognitoService: ICognitoService
}

export async function route(
  method: string,
  path: string,
  ctx: RequestContext,
  req: HandlerRequest,
  deps: Deps,
): Promise<HandlerResponse> {
  const segments = path.split('/').filter(Boolean)
  const [seg0, seg1] = segments

  switch (`${method} /${seg0 ?? ''}`) {
    case 'POST /families':
      if (!seg1) return familyCreateHandler(ctx, req, deps)
      if (seg1 === 'invites') return familyInviteHandler(ctx, req, deps)
      if (seg1 === 'join') return familyJoinHandler(ctx, req, deps)
      break

    case 'GET /family':
      if (seg1 === 'init') return familyInitHandler(ctx, req, deps)
      break

    case 'GET /summary':
      if (seg1 === 'daily') return summaryDailyHandler(ctx, req, deps)
      if (seg1 === 'weekly') return summaryWeeklyHandler(ctx, req, deps)
      break

    case 'GET /histories':
      return historiesHandler(ctx, req, deps)

    case 'GET /negurai':
      return neguraiListHandler(ctx, req, deps)

    case 'POST /negurai':
      return neguraiCreateHandler(ctx, req, deps)

    case 'DELETE /negurai':
      return neguraiDeleteHandler(ctx, req, deps)

    case 'PUT /tasks':
      return taskUpsertHandler(ctx, req, deps)

    case 'POST /tasks':
      if (seg1 === 'execute') return taskExecuteHandler(ctx, req, deps)
      break

    case 'DELETE /tasks':
      if (seg1 === 'execute') return taskExecuteCancelHandler(ctx, req, deps)
      // TaskID は UUID のため 'execute' と衝突しない
      if (seg1) {
        req.pathParams['taskId'] = seg1
        return taskDeleteHandler(ctx, req, deps)
      }
      break
  }

  throw new AppError(404, 'エンドポイントが見つかりません')
}
