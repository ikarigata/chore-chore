# ============================================================
# FamilyAppTable — 家族データのシングルテーブル
# ============================================================
# エンティティ別 SK プレフィックス:
#   USER#{CognitoSub}                                — ユーザー情報・累積ポイント
#   TASK#{TaskID}                                    — 家事マスター設定
#   DAILY#{YYYY-MM-DD}#{CognitoSub}                 — 日次サマリ (TTL: 90日)
#   HISTORY#{RFC3339}#{CognitoSub}#{TaskExecutionID} — タスク履歴 (TTL: 1年)

resource "aws_dynamodb_table" "family_app" {
  name         = local.family_app_table_name
  billing_mode = "PAY_PER_REQUEST" # オンデマンド: 2名利用なら無料枠内に収まる

  hash_key  = "FamilyID"
  range_key = "DataSortKey"

  attribute {
    name = "FamilyID"
    type = "S"
  }

  attribute {
    name = "DataSortKey"
    type = "S"
  }

  # DAILY / HISTORY レコードの自動削除（ストレージコスト抑制）
  ttl {
    attribute_name = "ExpiresAt"
    enabled        = true
  }

  # 誤操作・誤削除から 35 日以内の任意時点に復旧できる
  point_in_time_recovery {
    enabled = true
  }

  # GSI/LSI は使用しない — 全アクセスパターンは SK の begins_with で対応
}

# ============================================================
# FamilyInviteTable — 招待トークン専用テーブル
# ============================================================
# FamilyID を持たない状態でトークン単独から引く必要があるため別テーブル。
# TTL 24時間で自然消滅するため、ストレージコストは無視できる。
#
# PK: Token (UUIDv4)
# 属性:
#   FamilyID  — 招待元の家族ID
#   ExpiresAt — TTL (now + 86400)
#   UsedAt    — 消費時刻 (消費前は属性なし)
#   UsedBy    — 消費ユーザーの CognitoSub (冪等リトライ判定用)

resource "aws_dynamodb_table" "family_invite" {
  name         = local.family_invite_table_name
  billing_mode = "PAY_PER_REQUEST"

  hash_key = "Token"

  attribute {
    name = "Token"
    type = "S"
  }

  ttl {
    attribute_name = "ExpiresAt"
    enabled        = true
  }

  # 招待データは短命かつ軽量のため PITR は不要
}
