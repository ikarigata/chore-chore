import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { AppError } from './errors.js'
import { createDocumentClient } from './repositories/dynamodb/client.js'
import { DynamoFamilyRepository } from './repositories/dynamodb/FamilyRepository.js'
import { route } from './router.js'

// Lambda コールドスタート時に一度だけ生成
const docClient = createDocumentClient()
const familyRepo = new DynamoFamilyRepository(docClient)
const deps = { familyRepo }

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method
  const path = event.requestContext.http.path

  // リクエストボディのパース（GET 等で body が無い場合も考慮）
  let bodyObj: Record<string, unknown> = {}
  if (event.body) {
    try {
      bodyObj = JSON.parse(event.body) as Record<string, unknown>
    } catch {
      return jsonResponse(400, { message: 'リクエストボディが不正なJSONです' })
    }
  }

  // CognitoSub は Cognito JWT Authorizer が必ず付与する
  const cognitoSub = event.requestContext.authorizer?.jwt?.claims?.['sub'] as string | undefined
  // FamilyID は Cognito カスタム属性 → クエリパラメータ → ボディの順で取得
  const familyId =
    (event.requestContext.authorizer?.jwt?.claims?.['custom:family_id'] as string | undefined) ??
    event.queryStringParameters?.['familyId'] ??
    (bodyObj['familyId'] as string | undefined)

  if (!cognitoSub || !familyId) {
    return jsonResponse(401, { message: '認証情報が不正です' })
  }

  const ctx = { familyId, cognitoSub }
  const req = {
    pathParams: {} as Record<string, string>,
    queryParams: (event.queryStringParameters ?? {}) as Record<string, string>,
    body: bodyObj,
  }

  try {
    const res = await route(method, path, ctx, req, deps)
    return jsonResponse(res.statusCode, res.body)
  } catch (err) {
    if (err instanceof AppError) {
      return jsonResponse(err.statusCode, { message: err.message })
    }
    console.error('Unexpected error:', err)
    return jsonResponse(500, { message: 'サーバーエラーが発生しました' })
  }
}

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
