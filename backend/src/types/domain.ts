export type FamilyID = string
export type CognitoSub = string
export type TaskID = string
export type TaskExecutionID = string

export interface User {
  cognitoSub: CognitoSub
  displayName: string
  icon: string
  totalPoints: number
}

export interface TaskMaster {
  taskId: TaskID
  taskName: string
  points: number
  icon: string
}

export interface DailySummary {
  cognitoSub: CognitoSub
  date: string
  dailyPoints: number
}

export interface TaskHistory {
  taskExecutionId: TaskExecutionID
  cognitoSub: CognitoSub
  taskId: TaskID
  points: number
  timestamp: string
  expiresAt: number
}

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
