# 全リソースで使う命名プレフィックスと共通値を一元管理
locals {
  prefix = "iezi-${var.env}" # 例: iezi-prod, iezi-staging

  # DynamoDB テーブル名（バックエンドの環境変数と一致させること）
  family_app_table_name    = "FamilyAppTable"
  family_invite_table_name = "FamilyInviteTable"

  # CloudWatch ログ保持期間（仕様書 §5.5 に従い 14 日）
  log_retention_days = 14
}
