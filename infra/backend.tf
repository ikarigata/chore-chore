# Terraform リモートステート（S3 ネイティブロック）
#
# 【初回セットアップ手順】
# terraform backend は変数展開が使えないため、バケット名を直接記述する。
#
#   1. AWS コンソールまたは CLI で以下を手動作成:
#      - S3 バケット: iezi-tfstate-{env}
#          - バージョニング有効
#          - パブリックアクセス全ブロック
#          - SSE-S3 暗号化
#   2. 下記 backend ブロックの bucket を実際のバケット名に変更して有効化
#   3. `terraform init` を実行してステートをリモートに移行

terraform {
  backend "s3" {
    bucket       = "iezi-tfstate-prod" # 環境に応じて変更: iezi-tfstate-staging など
    key          = "iezi/terraform.tfstate"
    region       = "ap-northeast-1"
    encrypt      = true
    use_lockfile = true
  }
}
