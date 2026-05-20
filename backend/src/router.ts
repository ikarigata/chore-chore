import { AppError } from './errors.js'
import { familyInitHandler } from './handlers/familyInit.js'
import { historiesHandler } from './handlers/histories.js'
import { summaryDailyHandler } from './handlers/summaryDaily.js'
import { taskDeleteHandler } from './handlers/taskDelete.js'
import { taskExecuteHandler } from './handlers/taskExecute.js'
import { taskExecuteCancelHandler } from './handlers/taskExecuteCancel.js'
import { taskUpsertHandler } from './handlers/taskUpsert.js'
import type { IFamilyRepository } from './repositories/IFamilyRepository.js'
import type { HandlerRequest, HandlerResponse, RequestContext } from './types/domain.js'

interface Deps {
  familyRepo: IFamilyRepository
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
    case 'GET /family':
      if (seg1 === 'init') return familyInitHandler(ctx, req, deps)
      break

    case 'GET /summary':
      if (seg1 === 'daily') return summaryDailyHandler(ctx, req, deps)
      break

    case 'GET /histories':
      return historiesHandler(ctx, req, deps)

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
