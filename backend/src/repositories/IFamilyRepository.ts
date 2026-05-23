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

export interface CreateTaskHistoryInput {
  taskExecutionId: TaskExecutionID
  taskId: TaskID
  timestamp: string
  points: number
  expiresAt: number
  dailyDate: string
  dailyExpiresAt: number
}

export interface DeleteTaskHistoryInput {
  taskExecutionId: TaskExecutionID
  timestamp: string
  points: number
  dailyDate: string
}

export interface UpsertTaskMasterInput {
  taskId: TaskID
  taskName: string
  points: number
  categoryId?: string
}

export interface IFamilyRepository {
  listFamilyMembers(familyId: FamilyID): Promise<User[]>
  listTaskMasters(familyId: FamilyID): Promise<TaskMaster[]>
  getTaskMaster(familyId: FamilyID, taskId: TaskID): Promise<TaskMaster | null>
  getDailySummaries(familyId: FamilyID, date: string): Promise<DailySummary[]>
  listTaskHistories(familyId: FamilyID): Promise<TaskHistory[]>
  createTaskHistory(familyId: FamilyID, cognitoSub: CognitoSub, input: CreateTaskHistoryInput): Promise<void>
  deleteTaskHistory(familyId: FamilyID, cognitoSub: CognitoSub, input: DeleteTaskHistoryInput): Promise<void>
  upsertTaskMaster(familyId: FamilyID, input: UpsertTaskMasterInput): Promise<void>
  deleteTaskMaster(familyId: FamilyID, taskId: TaskID): Promise<void>
  createFamily(familyId: FamilyID, cognitoSub: CognitoSub, displayName: string): Promise<void>
  createInvite(familyId: FamilyID, token: string, expiresAt: number): Promise<void>
  consumeInvite(token: string, cognitoSub: CognitoSub, displayName: string): Promise<FamilyID>
}
