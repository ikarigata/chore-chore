# ============================================================
# Lambda 実行ロール
# ============================================================
resource "aws_iam_role" "lambda_exec" {
  name = "${local.prefix}-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# CloudWatch Logs への書き込み権限（マネージドポリシー）
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB アクセス権限
resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # FamilyAppTable: CRUD + トランザクション
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:TransactWriteItems",
        ]
        Resource = aws_dynamodb_table.family_app.arn
      },
      # FamilyInviteTable: 招待トークンの読み書き（POST /families/invites, POST /families/join）
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:TransactWriteItems",
        ]
        Resource = aws_dynamodb_table.family_invite.arn
      },
    ]
  })
}

# Cognito: AdminUpdateUserAttributes（POST /families, POST /families/join で family_id をセット）
resource "aws_iam_role_policy" "lambda_cognito" {
  name = "cognito-update-user-attributes"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["cognito-idp:AdminUpdateUserAttributes"]
      Resource = aws_cognito_user_pool.main.arn
    }]
  })
}

# ============================================================
# CloudWatch ロググループ（Lambda 出力先）
# ============================================================
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.prefix}-api"
  retention_in_days = local.log_retention_days
}

# ============================================================
# Lambda ZIP（esbuild バンドル成果物をパッケージ化）
# ============================================================
# 事前に `npm run build -w backend` を実行しておくこと
#
# 重要: ここは必ず `source_file`（単一ファイル）を指定すること。
#   backend/package.json には `"type": "module"` が設定されており、
#   esbuild は `--format=cjs` で CJS バンドルを出力する。両者が同居すると
#   Node.js は `.js` を ESM 解釈しようとして起動に失敗する。
#   `source_file` で index.js だけを ZIP に入れることで package.json を
#   含めず、Lambda のランタイムが `.js` を CJS として扱う既定動作に乗せる。
#   `source_dir` への変更や、dist/ 配下に package.json を出力する変更は禁止。
data "archive_file" "lambda" {
  type        = "zip"
  source_file = var.lambda_dist_path
  output_path = "${path.module}/../backend/dist/lambda.zip"
}

# ============================================================
# Lambda 関数
# ============================================================
resource "aws_lambda_function" "api" {
  function_name = "${local.prefix}-api"
  role          = aws_iam_role.lambda_exec.arn

  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  handler          = "index.handler" # esbuild CJS バンドルのエントリーポイント
  runtime          = "nodejs22.x"

  # コールドスタート許容（2名利用ではウォームインスタンスにこだわらない）
  timeout     = 29 # API Gateway の統合タイムアウト 29秒に合わせる
  memory_size = 256

  environment {
    variables = {
      TABLE_NAME           = local.family_app_table_name
      INVITE_TABLE_NAME    = local.family_invite_table_name
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
      FRONTEND_URL         = "https://${aws_cloudfront_distribution.frontend.domain_name}"
      # AWS SDK の HTTP Keep-Alive を有効化してレイテンシ改善
      AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
    }
  }

  # ロগগループを先に作成してから Lambda を作る
  depends_on = [aws_cloudwatch_log_group.lambda]
}
