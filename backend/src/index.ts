import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda'
import { AppError } from './errors.js'
import { createDocumentClient } from './repositories/dynamodb/client.js'
import { DynamoFamilyRepository } from './repositories/dynamodb/FamilyRepository.js'
import { CognitoService } from './services/cognito/CognitoService.js'
import { route } from './router.js'

// family_id クレームなしで通過させるエンドポイント
const FAMILY_ID_FREE = new Set(['POST /families', 'POST /families/join'])

// Lambda コールドスタート時に一度だけ生成
const docClient = createDocumentClient()
const familyRepo = new DynamoFamilyRepository(docClient)
const cognitoService = new CognitoService(new CognitoIdentityProviderClient({}))
const deps = { familyRepo, cognitoService }

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method
  const path = event.requestContext.http.path

  if (method === "OPTIONS") {
    return jsonResponse(200, {})
  }

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
  // FamilyID は Cognito カスタム属性から取得（POST /families と POST /families/join は未設定でも許可）
  const familyId =
    (event.requestContext.authorizer?.jwt?.claims?.['custom:family_id'] as string | undefined) ?? ''

  const endpoint = `${method} ${path}`
  if (!cognitoSub || (!familyId && !FAMILY_ID_FREE.has(endpoint))) {
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
