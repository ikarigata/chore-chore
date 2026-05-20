import type {
  CancelTaskInput,
  ExecuteTaskInput,
  IFamilyRepository,
  UpsertTaskInput,
} from '../../repositories/IFamilyRepository.js'
import type {
  CognitoSub,
  DailySummary,
  FamilyID,
  TaskHistory,
  TaskID,
  TaskMaster,
  User,
} from '../../types/domain.js'

export class MockFamilyRepository implements IFamilyRepository {
  users: User[] = []
  taskMasters: TaskMaster[] = []
  taskMasterMap = new Map<string, TaskMaster>()
  dailySummaries: DailySummary[] = []
  histories: TaskHistory[] = []

  executeTaskCalls: Array<[FamilyID, CognitoSub, ExecuteTaskInput]> = []
  cancelTaskCalls: Array<[FamilyID, CognitoSub, CancelTaskInput]> = []
  upsertTaskMasterCalls: Array<[FamilyID, UpsertTaskInput]> = []
  deleteTaskMasterCalls: Array<[FamilyID, TaskID]> = []

  executeTaskError?: Error

  async listFamilyMembers(_familyId: FamilyID): Promise<User[]> {
    return this.users
  }

  async listTaskMasters(_familyId: FamilyID): Promise<TaskMaster[]> {
    return this.taskMasters
  }

  async getTaskMaster(_familyId: FamilyID, taskId: TaskID): Promise<TaskMaster | null> {
    return this.taskMasterMap.get(taskId) ?? null
  }

  async getDailySummaries(_familyId: FamilyID, _date: string): Promise<DailySummary[]> {
    return this.dailySummaries
  }

  async listHistories(_familyId: FamilyID): Promise<TaskHistory[]> {
    return this.histories
  }

  async executeTask(familyId: FamilyID, cognitoSub: CognitoSub, input: ExecuteTaskInput): Promise<void> {
    this.executeTaskCalls.push([familyId, cognitoSub, input])
    if (this.executeTaskError) throw this.executeTaskError
  }

  async cancelTask(familyId: FamilyID, cognitoSub: CognitoSub, input: CancelTaskInput): Promise<void> {
    this.cancelTaskCalls.push([familyId, cognitoSub, input])
  }

  async upsertTaskMaster(familyId: FamilyID, input: UpsertTaskInput): Promise<void> {
    this.upsertTaskMasterCalls.push([familyId, input])
  }

  async deleteTaskMaster(familyId: FamilyID, taskId: TaskID): Promise<void> {
    this.deleteTaskMasterCalls.push([familyId, taskId])
  }
}
