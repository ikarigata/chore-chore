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
  CancelTaskInput,
  ExecuteTaskInput,
  IFamilyRepository,
  UpsertTaskInput,
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

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME ?? 'FamilyAppTable'

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
  return {
    taskId: sk.slice('TASK#'.length),
    taskName: item['TaskName'] as string,
    points: item['Points'] as number,
  }
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

  async listHistories(familyId: FamilyID): Promise<TaskHistory[]> {
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

  async executeTask(
    familyId: FamilyID,
    cognitoSub: CognitoSub,
    input: ExecuteTaskInput,
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

  async cancelTask(
    familyId: FamilyID,
    cognitoSub: CognitoSub,
    input: CancelTaskInput,
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

  async upsertTaskMaster(familyId: FamilyID, input: UpsertTaskInput): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          FamilyID: familyId,
          DataSortKey: `TASK#${input.taskId}`,
          TaskName: input.taskName,
          Points: input.points,
        },
      }),
    )
  }

  async deleteTaskMaster(familyId: FamilyID, taskId: TaskID): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { FamilyID: familyId, DataSortKey: `TASK#${taskId}` },
      }),
    )
  }
}
