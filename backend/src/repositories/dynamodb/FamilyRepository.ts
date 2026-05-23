import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb'
import { AppError } from '../../errors.js'
import type {
  DeleteTaskHistoryInput,
  CreateTaskHistoryInput,
  IFamilyRepository,
  UpsertTaskMasterInput,
} from '../IFamilyRepository.js'
import type {
  CognitoSub,
  DailySummary,
  FamilyID,
  TaskHistory,
  TaskID,
  TaskMaster,
  User,
} from '../../types/domain.js'

const TABLE_NAME = process.env.TABLE_NAME
const INVITE_TABLE_NAME = process.env.INVITE_TABLE_NAME
if (!TABLE_NAME || !INVITE_TABLE_NAME) {
  throw new Error('TABLE_NAME / INVITE_TABLE_NAME environment variables are required')
}

type DynamoItem = Record<string, unknown>

function parseUser(item: DynamoItem): User {
  const sk = item['DataSortKey'] as string
  return {
    cognitoSub: sk.slice('USER#'.length),
    displayName: item['DisplayName'] as string,
    totalPoints: (item['TotalPoints'] as number) ?? 0,
  }
}

function parseTaskMaster(item: DynamoItem): TaskMaster {
  const sk = item['DataSortKey'] as string
  const master: TaskMaster = {
    taskId: sk.slice('TASK#'.length),
    taskName: item['TaskName'] as string,
    points: item['Points'] as number,
  }
  if (item['Category'] !== undefined) master.categoryId = item['Category'] as string
  return master
}

function parseDailySummary(item: DynamoItem): DailySummary {
  // SK: DAILY#{YYYY-MM-DD}#{CognitoSub}
  const sk = item['DataSortKey'] as string
  const withoutPrefix = sk.slice('DAILY#'.length)
  const sep = withoutPrefix.indexOf('#')
  return {
    date: withoutPrefix.slice(0, sep),
    cognitoSub: withoutPrefix.slice(sep + 1),
    dailyPoints: (item['DailyPoints'] as number) ?? 0,
  }
}

function parseTaskHistory(item: DynamoItem): TaskHistory {
  // SK: HISTORY#{RFC3339Timestamp}#{CognitoSub}#{TaskExecutionID}
  const sk = item['DataSortKey'] as string
  const parts = sk.split('#')
  // parts[0]="HISTORY", parts[1]=timestamp, parts[2]=cognitoSub, parts[3]=taskExecutionId
  return {
    timestamp: parts[1]!,
    cognitoSub: parts[2]!,
    taskExecutionId: parts[3]!,
    taskId: item['TaskID'] as string,
    points: item['Points'] as number,
    expiresAt: item['ExpiresAt'] as number,
  }
}

export class DynamoFamilyRepository implements IFamilyRepository {
  constructor(private readonly client: DynamoDBDocumentClient) {}

  async listFamilyMembers(familyId: FamilyID): Promise<User[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'FamilyID = :pk AND begins_with(DataSortKey, :prefix)',
        ExpressionAttributeValues: { ':pk': familyId, ':prefix': 'USER#' },
      }),
    )
    return (result.Items ?? []).map((item) => parseUser(item as DynamoItem))
  }

  async listTaskMasters(familyId: FamilyID): Promise<TaskMaster[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'FamilyID = :pk AND begins_with(DataSortKey, :prefix)',
        ExpressionAttributeValues: { ':pk': familyId, ':prefix': 'TASK#' },
      }),
    )
    return (result.Items ?? []).map((item) => parseTaskMaster(item as DynamoItem))
  }

  async getTaskMaster(familyId: FamilyID, taskId: TaskID): Promise<TaskMaster | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { FamilyID: familyId, DataSortKey: `TASK#${taskId}` },
      }),
    )
    if (!result.Item) return null
    return parseTaskMaster(result.Item as DynamoItem)
  }

  async getDailySummaries(familyId: FamilyID, date: string): Promise<DailySummary[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'FamilyID = :pk AND begins_with(DataSortKey, :prefix)',
        ExpressionAttributeValues: { ':pk': familyId, ':prefix': `DAILY#${date}` },
      }),
    )
    return (result.Items ?? []).map((item) => parseDailySummary(item as DynamoItem))
  }

  async listTaskHistories(familyId: FamilyID): Promise<TaskHistory[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'FamilyID = :pk AND begins_with(DataSortKey, :prefix)',
        ExpressionAttributeValues: { ':pk': familyId, ':prefix': 'HISTORY#' },
        ScanIndexForward: false,
      }),
    )
    return (result.Items ?? []).map((item) => parseTaskHistory(item as DynamoItem))
  }

  async createTaskHistory(
    familyId: FamilyID,
    cognitoSub: CognitoSub,
    input: CreateTaskHistoryInput,
  ): Promise<void> {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLE_NAME,
                Item: {
                  FamilyID: familyId,
                  DataSortKey: `HISTORY#${input.timestamp}#${cognitoSub}#${input.taskExecutionId}`,
                  TaskID: input.taskId,
                  Points: input.points,
                  ExpiresAt: input.expiresAt,
                },
                // 同一 TaskExecutionID の二重加算を防ぐ
                ConditionExpression: 'attribute_not_exists(DataSortKey)',
              },
            },
            {
              Update: {
                TableName: TABLE_NAME,
                Key: {
                  FamilyID: familyId,
                  DataSortKey: `DAILY#${input.dailyDate}#${cognitoSub}`,
                },
                UpdateExpression: 'ADD DailyPoints :points SET ExpiresAt = :expiresAt',
                ExpressionAttributeValues: {
                  ':points': input.points,
                  ':expiresAt': input.dailyExpiresAt,
                },
              },
            },
            {
              Update: {
                TableName: TABLE_NAME,
                Key: { FamilyID: familyId, DataSortKey: `USER#${cognitoSub}` },
                UpdateExpression: 'ADD TotalPoints :points',
                ExpressionAttributeValues: { ':points': input.points },
              },
            },
          ],
        }),
      )
    } catch (err) {
      if (err instanceof TransactionCanceledException) {
        const hasDuplicate = err.CancellationReasons?.some(
          (r) => r.Code === 'ConditionalCheckFailed',
        )
        if (hasDuplicate) throw new AppError(409, 'この家事完了は既に記録されています')
      }
      throw err
    }
  }

  async deleteTaskHistory(
    familyId: FamilyID,
    cognitoSub: CognitoSub,
    input: DeleteTaskHistoryInput,
  ): Promise<void> {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: TABLE_NAME,
                Key: {
                  FamilyID: familyId,
                  DataSortKey: `HISTORY#${input.timestamp}#${cognitoSub}#${input.taskExecutionId}`,
                },
                ConditionExpression: 'attribute_exists(DataSortKey)',
              },
            },
            {
              Update: {
                TableName: TABLE_NAME,
                Key: {
                  FamilyID: familyId,
                  DataSortKey: `DAILY#${input.dailyDate}#${cognitoSub}`,
                },
                // DynamoDB の ADD にマイナス値を渡して減算
                UpdateExpression: 'ADD DailyPoints :points',
                ExpressionAttributeValues: { ':points': -input.points },
              },
            },
            {
              Update: {
                TableName: TABLE_NAME,
                Key: { FamilyID: familyId, DataSortKey: `USER#${cognitoSub}` },
                UpdateExpression: 'ADD TotalPoints :points',
                ExpressionAttributeValues: { ':points': -input.points },
              },
            },
          ],
        }),
      )
    } catch (err) {
      if (err instanceof TransactionCanceledException) {
        const notFound = err.CancellationReasons?.some(
          (r) => r.Code === 'ConditionalCheckFailed',
        )
        if (notFound) throw new AppError(404, '対象の家事履歴が見つかりません')
      }
      throw err
    }
  }

  async upsertTaskMaster(familyId: FamilyID, input: UpsertTaskMasterInput): Promise<void> {
    const item: Record<string, unknown> = {
      FamilyID: familyId,
      DataSortKey: `TASK#${input.taskId}`,
      TaskName: input.taskName,
      Points: input.points,
    }
    if (input.categoryId !== undefined) item['Category'] = input.categoryId
    await this.client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }))
  }

  async deleteTaskMaster(familyId: FamilyID, taskId: TaskID): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { FamilyID: familyId, DataSortKey: `TASK#${taskId}` },
      }),
    )
  }

  async createFamily(familyId: FamilyID, cognitoSub: CognitoSub, displayName: string): Promise<void> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            FamilyID: familyId,
            DataSortKey: `USER#${cognitoSub}`,
            DisplayName: displayName,
            TotalPoints: 0,
          },
          ConditionExpression: 'attribute_not_exists(DataSortKey)',
        }),
      )
    } catch (err) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        throw new AppError(409, '既に家族に所属しています')
      }
      throw err
    }
  }

  async createInvite(familyId: FamilyID, token: string, expiresAt: number): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: INVITE_TABLE_NAME,
        Item: { Token: token, FamilyID: familyId, ExpiresAt: expiresAt },
      }),
    )
  }

  async consumeInvite(token: string, cognitoSub: CognitoSub, displayName: string): Promise<FamilyID> {
    const getResult = await this.client.send(
      new GetCommand({ TableName: INVITE_TABLE_NAME, Key: { Token: token } }),
    )
    if (!getResult.Item) throw new AppError(410, '招待リンクが見つからないか、期限が切れています')

    const invite = getResult.Item as DynamoItem
    const expiresAt = invite['ExpiresAt'] as number
    if (expiresAt < Math.floor(Date.now() / 1000)) {
      throw new AppError(410, '招待リンクが見つからないか、期限が切れています')
    }

    const familyId = invite['FamilyID'] as FamilyID

    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: INVITE_TABLE_NAME,
                Key: { Token: token },
                UpdateExpression: 'SET UsedAt = :usedAt, UsedBy = :usedBy',
                // attribute_exists(Token) で TTL 削除との競合をブロック（不滅レコードの誤生成防止）
                ConditionExpression:
                  'attribute_exists(#tk) AND (attribute_not_exists(UsedAt) OR UsedBy = :usedBy)',
                ExpressionAttributeNames: { '#tk': 'Token' },
                ExpressionAttributeValues: {
                  ':usedAt': Math.floor(Date.now() / 1000),
                  ':usedBy': cognitoSub,
                },
              },
            },
            {
              Put: {
                TableName: TABLE_NAME,
                Item: {
                  FamilyID: familyId,
                  DataSortKey: `USER#${cognitoSub}`,
                  DisplayName: displayName,
                  TotalPoints: 0,
                },
                ConditionExpression: 'attribute_not_exists(DataSortKey)',
              },
            },
          ],
        }),
      )
    } catch (err) {
      if (err instanceof TransactionCanceledException) {
        const reasons = err.CancellationReasons ?? []
        if (reasons[0]?.Code === 'ConditionalCheckFailed') {
          throw new AppError(409, 'この招待は既に別のユーザーが使用しました')
        }
        // reason[1] 失敗 = 同ユーザーの冪等リトライ（USER レコード作成済み）
        if (reasons[1]?.Code === 'ConditionalCheckFailed') {
          return familyId
        }
      }
      throw err
    }

    return familyId
  }
}
