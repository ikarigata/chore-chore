# ============================================================
# Cognito ユーザープール
# ============================================================
resource "aws_cognito_user_pool" "main" {
  name = local.prefix

  # パスワードポリシー（デフォルトより緩めて UX を改善）
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = false
    temporary_password_validity_days = 7
  }

  # メールアドレスでサインイン
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # カスタム属性: family_id
  # → JWT クレームでは custom:family_id として参照する
  # → Lambda が AdminUpdateUserAttributes で書き込む（mutable 必須）
  schema {
    name                = "family_id"
    attribute_data_type = "String"
    mutable             = true

    string_attribute_constraints {
      min_length = 0
      max_length = 256
    }
  }

  # サインアップ後の確認メール
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_message        = "iezi の確認コードは {####} です。"
    email_subject        = "【iezi】メールアドレスの確認"
  }

  user_attribute_update_settings {
    # メールアドレス変更時に再確認を要求
    attributes_require_verification_before_update = ["email"]
  }
}

# ============================================================
# アプリクライアント（SPA 用）
# ============================================================
resource "aws_cognito_user_pool_client" "app" {
  name         = "${local.prefix}-app"
  user_pool_id = aws_cognito_user_pool.main.id

  # SPA はクライアントシークレット不要
  generate_secret = false

  # Amplify が使う標準的な認証フロー
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",      # SRP プロトコル（推奨）
    "ALLOW_REFRESH_TOKEN_AUTH", # リフレッシュトークン
  ]

  # custom:family_id を JWT に含めるために読み書き属性として明示
  read_attributes  = ["email", "custom:family_id"]
  write_attributes = ["email", "custom:family_id"]

  # 存在しないユーザーかどうかをクライアントに知らせない（ユーザー列挙攻撃対策）
  prevent_user_existence_errors = "ENABLED"

  # ID トークンの有効期限（デフォルト: 60分）
  id_token_validity      = 60
  refresh_token_validity = 30 # 日

  token_validity_units {
    id_token      = "minutes"
    refresh_token = "days"
  }
}
