import { TransactionCanceledException } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { AppError } from '../../errors.js'
import type {
  DeleteTaskHistoryInput,
  CreateTaskHistoryInput,
  CreateNeguraiInput,
  DeleteNeguraiInput,
  CreateMemoInput,
  DeleteMemoInput,
  GetNeguraiResult,
  GetTaskHistoryResult,
  IFamilyRepository,
  UpsertTaskMasterInput,
} from '../IFamilyRepository.js'
import type {
  CognitoSub,
  DailySummary,
  FamilyID,
  Memo,
  Negurai,
  NeguraiID,
  TaskExecutionID,
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
  const user: User = {
    cognitoSub: sk.slice('USER#'.length),
    displayName: item['DisplayName'] as string,
    totalPoints: (item['TotalPoints'] as number) ?? 0,
    neguraiPoints: (item['NeguraiPoints'] as number) ?? 0,
  }
  if (item['Icon'] !== undefined) user.icon = item['Icon'] as string
  return user
}

function parseNegurai(item: DynamoItem): Negurai {
  // SK: NEGURAI#{RFC3339Timestamp}#{NeguraiID}
  const sk = item['DataSortKey'] as string
  const withoutPrefix = sk.slice('NEGURAI#'.length)
  const sep = withoutPrefix.indexOf('#')
  return {
    neguraiId: withoutPrefix.slice(sep + 1),
    timestamp: withoutPrefix.slice(0, sep),
    giverSub: item['GiverSub'] as string,
    receiverSub: item['ReceiverSub'] as string,
    description: item['Description'] as string,
    points: item['Points'] as number,
    expiresAt: item['ExpiresAt'] as number,
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

function parseMemo(item: DynamoItem): Memo {
  // SK: MEMO#{RFC3339Timestamp}#{MemoID}
  const sk = item['DataSortKey'] as string
  const withoutPrefix = sk.slice('MEMO#'.length)
  const sep = withoutPrefix.indexOf('#')
  return {
    memoId: withoutPrefix.slice(sep + 1),
    timestamp: withoutPrefix.slice(0, sep),
    authorSub: item['AuthorSub'] as string,
    content: item['Content'] as string,
    expiresAt: item['ExpiresAt'] as number,
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

  async getTaskHistory(
    familyId: FamilyID,
    cognitoSub: CognitoSub,
    taskExecutionId: TaskExecutionID,
    timestamp: string,
  ): Promise<GetTaskHistoryResult | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          FamilyID: familyId,
          DataSortKey: `HISTORY#${timestamp}#${cognitoSub}#${taskExecutionId}`,
        },
      }),
    )
    if (!result.Item) return null
    return { points: result.Item['Points'] as number }
  }

  async getNegurai(
    familyId: FamilyID,
    neguraiId: NeguraiID,
    timestamp: string,
  ): Promise<GetNeguraiResult | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          FamilyID: familyId,
          DataSortKey: `NEGURAI#${timestamp}#${neguraiId}`,
        },
      }),
    )
    if (!result.Item) return null
    return {
      points: result.Item['Points'] as number,
      giverSub: result.Item['GiverSub'] as string,
    }
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

  async getWeeklySummaries(familyId: FamilyID, from: string, to: string): Promise<DailySummary[]> {
    // SK 形式: DAILY#{YYYY-MM-DD}#{CognitoSub}
    // BETWEEN は両端含む。終端は `DAILY#{to}~` とすることで `DAILY#{to}#<任意cognitoSub>` を網羅しつつ
    // 翌日 (`DAILY#{to+1日}...`) を取り込まないようにする（`~` (0x7E) は cognitoSub に含まれる 0-9/a-f/-より大）
    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'FamilyID = :pk AND DataSortKey BETWEEN :start AND :end',
        ExpressionAttributeValues: {
          ':pk': familyId,
          ':start': `DAILY#${from}`,
          ':end': `DAILY#${to}~`,
        },
      }),
    )
    return (result.Items ?? []).map((item) => parseDailySummary(item as DynamoItem))
  }

  async listTaskHistories(familyId: FamilyID): Promise<TaskHistory[]> {
    // 直近3ヶ月分のみ取得
    // SK 形式: HISTORY#{RFC3339Timestamp}#{CognitoSub}#{TaskExecutionID}
    // 終端の `~` (0x7E) はタイムスタンプ・UUID に含まれる文字より大きいため、
    // HISTORY# で始まる全レコードの上限として機能する（getWeeklySummaries と同じ手法）
    const since = new Date()
    since.setMonth(since.getMonth() - 3)
    since.setHours(0, 0, 0, 0)

    const items: DynamoItem[] = []
    let lastKey: Record<string, unknown> | undefined

    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'FamilyID = :pk AND DataSortKey BETWEEN :start AND :end',
          ExpressionAttributeValues: {
            ':pk': familyId,
            ':start': `HISTORY#${since.toISOString()}`,
            ':end': 'HISTORY#~',
          },
          ScanIndexForward: false,
          ExclusiveStartKey: lastKey,
        }),
      )
      items.push(...((result.Items ?? []) as DynamoItem[]))
      lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (lastKey)

    return items.map((item) => parseTaskHistory(item))
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

  async updateUserProfile(
    familyId: FamilyID,
    cognitoSub: CognitoSub,
    patch: { displayName?: string; icon?: string },
  ): Promise<void> {
    const sets: string[] = []
    const values: Record<string, unknown> = {}
    if (patch.displayName !== undefined) {
      sets.push('DisplayName = :displayName')
      values[':displayName'] = patch.displayName
    }
    if (patch.icon !== undefined) {
      sets.push('Icon = :icon')
      values[':icon'] = patch.icon
    }
    if (sets.length === 0) return
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { FamilyID: familyId, DataSortKey: `USER#${cognitoSub}` },
          UpdateExpression: `SET ${sets.join(', ')}`,
          ConditionExpression: 'attribute_exists(DataSortKey)',
          ExpressionAttributeValues: values,
        }),
      )
    } catch (err) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        throw new AppError(404, 'ユーザーが見つかりません')
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

  async listNegurai(familyId: FamilyID): Promise<Negurai[]> {
    const since = new Date()
    since.setMonth(since.getMonth() - 3)
    since.setHours(0, 0, 0, 0)

    const items: DynamoItem[] = []
    let lastKey: Record<string, unknown> | undefined

    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'FamilyID = :pk AND DataSortKey BETWEEN :start AND :end',
          ExpressionAttributeValues: {
            ':pk': familyId,
            ':start': `NEGURAI#${since.toISOString()}`,
            ':end': 'NEGURAI#~',
          },
          ScanIndexForward: false,
          ExclusiveStartKey: lastKey,
        }),
      )
      items.push(...((result.Items ?? []) as DynamoItem[]))
      lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (lastKey)

    return items.map((item) => parseNegurai(item))
  }

  async createNegurai(
    familyId: FamilyID,
    receiverSub: CognitoSub,
    input: CreateNeguraiInput,
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
                  DataSortKey: `NEGURAI#${input.timestamp}#${input.neguraiId}`,
                  GiverSub: input.giverSub,
                  ReceiverSub: receiverSub,
                  Description: input.description,
                  Points: input.points,
                  ExpiresAt: input.expiresAt,
                },
                // 同一 NeguraiID の二重加算を防ぐ
                ConditionExpression: 'attribute_not_exists(DataSortKey)',
              },
            },
            {
              Update: {
                TableName: TABLE_NAME,
                Key: { FamilyID: familyId, DataSortKey: `USER#${input.giverSub}` },
                UpdateExpression: 'ADD NeguraiPoints :points',
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
        if (hasDuplicate) throw new AppError(409, 'このねぎらいは既に記録されています')
      }
      throw err
    }
  }

  async listMemos(familyId: FamilyID): Promise<Memo[]> {
    const items: DynamoItem[] = []
    let lastKey: Record<string, unknown> | undefined

    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'FamilyID = :pk AND begins_with(DataSortKey, :prefix)',
          ExpressionAttributeValues: { ':pk': familyId, ':prefix': 'MEMO#' },
          ScanIndexForward: false,
          ExclusiveStartKey: lastKey,
        }),
      )
      items.push(...((result.Items ?? []) as DynamoItem[]))
      lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined
    } while (lastKey)

    return items.map((item) => parseMemo(item))
  }

  async createMemo(familyId: FamilyID, authorSub: CognitoSub, input: CreateMemoInput): Promise<void> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            FamilyID: familyId,
            DataSortKey: `MEMO#${input.timestamp}#${input.memoId}`,
            AuthorSub: authorSub,
            Content: input.content,
            ExpiresAt: input.expiresAt,
          },
          ConditionExpression: 'attribute_not_exists(DataSortKey)',
        }),
      )
    } catch (err) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        throw new AppError(409, 'このメモは既に記録されています')
      }
      throw err
    }
  }

  async deleteMemo(familyId: FamilyID, input: DeleteMemoInput): Promise<void> {
    try {
      await this.client.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            FamilyID: familyId,
            DataSortKey: `MEMO#${input.timestamp}#${input.memoId}`,
          },
          ConditionExpression: 'attribute_exists(DataSortKey)',
        }),
      )
    } catch (err) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        throw new AppError(404, '対象のメモが見つかりません')
      }
      throw err
    }
  }

  async deleteNegurai(
    familyId: FamilyID,
    receiverSub: CognitoSub,
    input: DeleteNeguraiInput,
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
                  DataSortKey: `NEGURAI#${input.timestamp}#${input.neguraiId}`,
                },
                // 存在チェック + 記録者本人のみ削除可能
                ConditionExpression: 'attribute_exists(DataSortKey) AND ReceiverSub = :receiverSub',
                ExpressionAttributeValues: { ':receiverSub': receiverSub },
              },
            },
            {
              Update: {
                TableName: TABLE_NAME,
                Key: { FamilyID: familyId, DataSortKey: `USER#${input.giverSub}` },
                UpdateExpression: 'ADD NeguraiPoints :points',
                ExpressionAttributeValues: { ':points': -input.points },
              },
            },
          ],
        }),
      )
    } catch (err) {
      if (err instanceof TransactionCanceledException) {
        const reasons = err.CancellationReasons ?? []
        if (reasons[0]?.Code === 'ConditionalCheckFailed') {
          throw new AppError(404, '対象のねぎらいが見つからないか、取り消す権限がありません')
        }
      }
      throw err
    }
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
