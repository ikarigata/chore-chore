# ============================================================
# フロントエンド設定（Amplify などに渡す値）
# ============================================================
output "cloudfront_url" {
  description = "フロントエンド SPA の URL"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "frontend_bucket_name" {
  description = "フロントエンド資材をアップロードする S3 バケット名"
  value       = aws_s3_bucket.frontend.bucket
}

output "cloudfront_distribution_id" {
  description = "デプロイ後のキャッシュ無効化に使用"
  value       = aws_cloudfront_distribution.frontend.id
}

# ============================================================
# バックエンド / API
# ============================================================
output "api_endpoint" {
  description = "API Gateway エンドポイント URL"
  value       = trimsuffix(aws_apigatewayv2_stage.default.invoke_url, "/")
}

output "lambda_function_name" {
  description = "Lambda 関数名（GitHub Actions でコード更新に使用）"
  value       = aws_lambda_function.api.function_name
}

# ============================================================
# 認証（フロントエンドの Amplify 設定ファイルに貼り付ける）
# ============================================================
output "cognito_user_pool_id" {
  description = "Cognito ユーザープール ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_client_id" {
  description = "Cognito アプリクライアント ID"
  value       = aws_cognito_user_pool_client.app.id
}

output "cognito_region" {
  description = "Cognito リージョン"
  value       = var.aws_region
}

# ============================================================
# CI/CD
# ============================================================
output "github_deploy_role_arn" {
  description = "GitHub Actions が AssumeRole する IAM ロール ARN"
  value       = aws_iam_role.github_deploy.arn
}
