variable "env" {
  description = "デプロイ環境名 (staging | prod)"
  type        = string

  validation {
    condition     = contains(["staging", "prod"], var.env)
    error_message = "env は 'staging' または 'prod' を指定してください。"
  }
}

variable "aws_region" {
  description = "AWS リージョン"
  type        = string
  default     = "ap-northeast-1" # 東京リージョン
}

variable "github_repo" {
  description = "GitHub Actions OIDC の信頼対象リポジトリ (例: myorg/iezi)"
  type        = string
}

# Lambda のビルド成果物パス（terraform apply 前に npm run build -w backend を実行しておくこと）
variable "lambda_dist_path" {
  description = "esbuild でバンドルした Lambda ファイルのパス"
  type        = string
  default     = "../backend/dist/index.js"
}
