import type {
  CognitoSub,
  DailySummary,
  FamilyID,
  TaskExecutionID,
  TaskHistory,
  TaskID,
  TaskMaster,
  User,
} from '../types/domain.js'

export interface ExecuteTaskInput {
  taskExecutionId: TaskExecutionID
  taskId: TaskID
  timestamp: string
  points: number
  expiresAt: number
  dailyDate: string
  dailyExpiresAt: number
}

export interface CancelTaskInput {
  taskExecutionId: TaskExecutionID
  timestamp: string
  points: number
  dailyDate: string
}

export interface UpsertTaskInput {
  taskId: TaskID
  taskName: string
  points: number
}

export interface IFamilyRepository {
  listFamilyMembers(familyId: FamilyID): Promise<User[]>
  listTaskMasters(familyId: FamilyID): Promise<TaskMaster[]>
  getTaskMaster(familyId: FamilyID, taskId: TaskID): Promise<TaskMaster | null>
  getDailySummaries(familyId: FamilyID, date: string): Promise<DailySummary[]>
  listHistories(familyId: FamilyID): Promise<TaskHistory[]>
  executeTask(familyId: FamilyID, cognitoSub: CognitoSub, input: ExecuteTaskInput): Promise<void>
  cancelTask(familyId: FamilyID, cognitoSub: CognitoSub, input: CancelTaskInput): Promise<void>
  upsertTaskMaster(familyId: FamilyID, input: UpsertTaskInput): Promise<void>
  deleteTaskMaster(familyId: FamilyID, taskId: TaskID): Promise<void>
}
