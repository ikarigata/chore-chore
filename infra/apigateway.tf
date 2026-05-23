# ============================================================
# API Gateway HTTP API
# ============================================================
resource "aws_apigatewayv2_api" "main" {
  name          = "${local.prefix}-api"
  protocol_type = "HTTP"
  description   = "iezi ファットLambda API"

  # CORS はここで一括設定（Lambda レスポンスヘッダーではなく API Gateway が付与）
  cors_configuration {
    # 本番では CloudFront ドメインのみを許可; ローカル開発用に localhost も追加
    allow_origins = [
      "https://${aws_cloudfront_distribution.frontend.domain_name}",
      "http://localhost:5173", # Vite デフォルトポート
    ]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Authorization", "Content-Type"]
    max_age       = 86400
  }
}

# ============================================================
# Cognito JWT Authorizer
# ============================================================
# API Gateway の入口で JWT 署名・有効期限を検証し、不正リクエストを Lambda 起動前に弾く。
# クレームの細粒度チェック（custom:family_id の有無など）は Lambda 内部で行う。
#
# NOTE: フロントエンドは Cognito の ID トークンを Authorization ヘッダーに乗せて送る。
#       ID トークンの audience はアプリクライアント ID になる。
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.app.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

# ============================================================
# Lambda 統合
# ============================================================
resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0" # HTTP API V2 イベント形式（index.ts の型定義と一致）
}

# ANY /{proxy+} — 全リクエストを Lambda に集約
resource "aws_apigatewayv2_route" "proxy" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "ANY /{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# プリフライト (OPTIONS) リクエストは認証なしで通過させる（CORS対応）
resource "aws_apigatewayv2_route" "options_proxy" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "OPTIONS /{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "NONE"
}

# ============================================================
# ステージ（自動デプロイ）
# ============================================================
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  # アクセスログを CloudWatch に送信
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/apigateway/${local.prefix}"
  retention_in_days = local.log_retention_days
}

# ============================================================
# Lambda リソースベースポリシー（API Gateway からの呼び出し許可）
# ============================================================
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
