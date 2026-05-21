# ============================================================
# GitHub Actions OIDC プロバイダー
# ============================================================
# 長期アクセスキー（IAM ユーザー）を使わず、GitHub Actions が
# AssumeRoleWithWebIdentity でロールを引き受ける。
#
# NOTE: OIDC プロバイダーはアカウント内に1つあれば十分。
#       既に存在する場合は data ソースで参照するように変更すること。
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  # GitHub OIDC の thumbprint（2023年以降は AWS が自動管理）
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# ============================================================
# GitHub Actions デプロイロール
# ============================================================
resource "aws_iam_role" "github_deploy" {
  name = "${local.prefix}-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        # main ブランチのみに限定（PRのプレビュービルドには別途ロールを検討）
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:ref:refs/heads/main"
        }
      }
    }]
  })
}

# Lambda コード更新権限
resource "aws_iam_role_policy" "github_deploy_lambda" {
  name = "lambda-deploy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:UpdateFunctionCode"]
      Resource = aws_lambda_function.api.arn
    }]
  })
}

# フロントエンド静的アセットのアップロード権限
resource "aws_iam_role_policy" "github_deploy_s3" {
  name = "s3-frontend-deploy"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.frontend.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.frontend.arn
      },
    ]
  })
}

# CloudFront キャッシュ無効化（デプロイ後に index.html を即時反映）
resource "aws_iam_role_policy" "github_deploy_cloudfront" {
  name = "cloudfront-invalidation"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["cloudfront:CreateInvalidation"]
      Resource = aws_cloudfront_distribution.frontend.arn
    }]
  })
}
