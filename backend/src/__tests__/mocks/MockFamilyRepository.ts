import type {
  DeleteTaskHistoryInput,
  CreateTaskHistoryInput,
  CreateNeguraiInput,
  DeleteNeguraiInput,
  IFamilyRepository,
  UpsertTaskMasterInput,
} from '../../repositories/IFamilyRepository.js'
import type {
  CognitoSub,
  DailySummary,
  FamilyID,
  Negurai,
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

  createTaskHistoryCalls: Array<[FamilyID, CognitoSub, CreateTaskHistoryInput]> = []
  deleteTaskHistoryCalls: Array<[FamilyID, CognitoSub, DeleteTaskHistoryInput]> = []
  upsertTaskMasterCalls: Array<[FamilyID, UpsertTaskMasterInput]> = []
  deleteTaskMasterCalls: Array<[FamilyID, TaskID]> = []

  createTaskHistoryError?: Error

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

  async getWeeklySummaries(_familyId: FamilyID, _from: string, _to: string): Promise<DailySummary[]> {
    return this.dailySummaries
  }

  async listTaskHistories(_familyId: FamilyID): Promise<TaskHistory[]> {
    return this.histories
  }

  async createTaskHistory(familyId: FamilyID, cognitoSub: CognitoSub, input: CreateTaskHistoryInput): Promise<void> {
    this.createTaskHistoryCalls.push([familyId, cognitoSub, input])
    if (this.createTaskHistoryError) throw this.createTaskHistoryError
  }

  async deleteTaskHistory(familyId: FamilyID, cognitoSub: CognitoSub, input: DeleteTaskHistoryInput): Promise<void> {
    this.deleteTaskHistoryCalls.push([familyId, cognitoSub, input])
  }

  async upsertTaskMaster(familyId: FamilyID, input: UpsertTaskMasterInput): Promise<void> {
    this.upsertTaskMasterCalls.push([familyId, input])
  }

  async deleteTaskMaster(familyId: FamilyID, taskId: TaskID): Promise<void> {
    this.deleteTaskMasterCalls.push([familyId, taskId])
  }

  async createFamily(_familyId: FamilyID, _cognitoSub: CognitoSub, _displayName: string): Promise<void> {}

  updateUserDisplayNameCalls: Array<[FamilyID, CognitoSub, string]> = []
  updateUserDisplayNameError?: Error

  async updateUserDisplayName(
    familyId: FamilyID,
    cognitoSub: CognitoSub,
    displayName: string,
  ): Promise<void> {
    this.updateUserDisplayNameCalls.push([familyId, cognitoSub, displayName])
    if (this.updateUserDisplayNameError) throw this.updateUserDisplayNameError
  }

  async createInvite(_familyId: FamilyID, _token: string, _expiresAt: number): Promise<void> {}

  async consumeInvite(_token: string, _cognitoSub: CognitoSub, _displayName: string): Promise<FamilyID> {
    return 'fam_mock'
  }

  neguraiList: Negurai[] = []
  createNeguraiCalls: Array<[FamilyID, CognitoSub, CreateNeguraiInput]> = []
  deleteNeguraiCalls: Array<[FamilyID, CognitoSub, DeleteNeguraiInput]> = []

  async listNegurai(_familyId: FamilyID): Promise<Negurai[]> {
    return this.neguraiList
  }

  async createNegurai(familyId: FamilyID, receiverSub: CognitoSub, input: CreateNeguraiInput): Promise<void> {
    this.createNeguraiCalls.push([familyId, receiverSub, input])
  }

  async deleteNegurai(familyId: FamilyID, receiverSub: CognitoSub, input: DeleteNeguraiInput): Promise<void> {
    this.deleteNeguraiCalls.push([familyId, receiverSub, input])
  }
}
