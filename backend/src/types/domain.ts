import type { User, TaskMaster, DailySummary, TaskHistory, Negurai, Memo } from '@iezi/shared'

export type FamilyID = string
export type CognitoSub = string
export type TaskID = string
export type TaskExecutionID = string
export type NeguraiID = string
export type MemoID = string

export { User, TaskMaster, DailySummary, TaskHistory, Negurai, Memo }

export interface RequestContext {
  familyId: FamilyID
  cognitoSub: CognitoSub
}

export interface HandlerRequest {
  pathParams: Record<string, string>
  queryParams: Record<string, string>
  body: unknown
}

export interface HandlerResponse {
  statusCode: number
  body: unknown
}
