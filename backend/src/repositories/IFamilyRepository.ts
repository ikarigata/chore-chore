import type {
  CognitoSub,
  DailySummary,
  FamilyID,
  Negurai,
  NeguraiID,
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

export interface CreateNeguraiInput {
  neguraiId: NeguraiID
  giverSub: CognitoSub
  description: string
  points: number
  timestamp: string
  expiresAt: number
}

export interface DeleteNeguraiInput {
  neguraiId: NeguraiID
  giverSub: CognitoSub
  timestamp: string
  points: number
}

export interface IFamilyRepository {
  listFamilyMembers(familyId: FamilyID): Promise<User[]>
  listTaskMasters(familyId: FamilyID): Promise<TaskMaster[]>
  getTaskMaster(familyId: FamilyID, taskId: TaskID): Promise<TaskMaster | null>
  getDailySummaries(familyId: FamilyID, date: string): Promise<DailySummary[]>
  getWeeklySummaries(familyId: FamilyID, from: string, to: string): Promise<DailySummary[]>
  listTaskHistories(familyId: FamilyID): Promise<TaskHistory[]>
  createTaskHistory(familyId: FamilyID, cognitoSub: CognitoSub, input: CreateTaskHistoryInput): Promise<void>
  deleteTaskHistory(familyId: FamilyID, cognitoSub: CognitoSub, input: DeleteTaskHistoryInput): Promise<void>
  upsertTaskMaster(familyId: FamilyID, input: UpsertTaskMasterInput): Promise<void>
  deleteTaskMaster(familyId: FamilyID, taskId: TaskID): Promise<void>
  createFamily(familyId: FamilyID, cognitoSub: CognitoSub, displayName: string): Promise<void>
  updateUserProfile(familyId: FamilyID, cognitoSub: CognitoSub, patch: { displayName?: string; icon?: string }): Promise<void>
  createInvite(familyId: FamilyID, token: string, expiresAt: number): Promise<void>
  consumeInvite(token: string, cognitoSub: CognitoSub, displayName: string): Promise<FamilyID>
  listNegurai(familyId: FamilyID): Promise<Negurai[]>
  createNegurai(familyId: FamilyID, receiverSub: CognitoSub, input: CreateNeguraiInput): Promise<void>
  deleteNegurai(familyId: FamilyID, receiverSub: CognitoSub, input: DeleteNeguraiInput): Promise<void>
}
