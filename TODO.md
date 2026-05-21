# TODO

## 家族ID払い出し・家族参加フロー

### 背景
`FamilyID` は JWT クレーム (`custom:family_id`) で取得するが、それを最初にセットする仕組みが未実装。新規ユーザーがアプリを使い始められない状態。

### 確定方針（2026-05-21 決定）

- **`FamilyID` の格納場所**: Cognito カスタム属性 `custom:family_id`
  - 一度セットすれば以降の JWT に自動で含まれる
  - Lambda の IAM ロールに `cognito-idp:AdminUpdateUserAttributes` 権限が必要
  - サインアップ直後は未設定の JWT が発行されるため、API 側で `family_id` クレーム必須でないエンドポイントを2つ用意する（`POST /families` と `POST /families/join`）
  - フロントは API 呼び出し後に `Auth.currentSession({ forceRefresh: true })` で JWT 強制リフレッシュ

- **招待方式**: 専用 `FamilyInviteTable` で UUID トークンを管理（生 `FamilyID` は URL に晒さない）
  - 詳細は `docs/dynamodb_spec.md` の §5 を参照
  - TTL 24時間、単回利用、冪等性は `attribute_not_exists(UsedAt) OR UsedBy = :sub` 条件で担保

- **トークンの受け渡し**: 招待される側は localStorage に保存して Cognito Hosted UI のリダイレクトを跨ぐ
  - 将来的にセキュリティ強化が必要なら OAuth `state` パラメータへの移行を検討（後付け可能）

### MVP 実装エンドポイント（3つ）

| メソッド | パス | 用途 | JWT `family_id` クレーム |
|---|---|---|---|
| `POST` | `/families` | 家族新規作成（最初の1人） | **無いこと** |
| `POST` | `/families/invites` | 招待トークン発行 | **必要** |
| `POST` | `/families/join` | 招待で家族に参加 | **無いこと** |

詳細仕様は `docs/api_spec.md` の §2.7〜§2.9 を参照。

### MVP でスコープアウトする項目（後付け可能）

| 機能 | 落とす理由 | 復活時の追加コスト |
|---|---|---|
| `GET /invites/{token}` 招待プレビュー | サインアップ後の `/families/join` で検証で足りる | エンドポイント追加のみ |
| `DELETE /families/invites/{token}` 取消 | TTL 24h で自然消滅 | エンドポイント追加のみ |
| `GET /families/invites` 一覧 | 都度発行運用 | エンドポイント追加のみ |
| `PUT /users/me` プロフィール更新 | 家族作成/参加時の `displayName` で十分 | エンドポイント追加のみ |
| `InviterName` / `InvitedBy` 招待属性 | プレビュー無し・監査ログ不要 | 属性追加のみ（既存データへの破壊的変更不要） |

### 実装残タスク

#### バックエンド (`backend/`)
- [ ] `POST /families` ハンドラ実装
- [ ] `POST /families/invites` ハンドラ実装
- [ ] `POST /families/join` ハンドラ実装（`TransactWriteItems` で `FamilyInviteTable` と `FamilyAppTable` を跨ぐ）
- [ ] ディスパッチ層に「`custom:family_id` クレーム不要エンドポイント」のホワイトリストを追加
- [ ] Cognito `AdminUpdateUserAttributes` 呼び出しの実装

#### インフラ (`infra/`)
- [ ] `FamilyInviteTable` を Terraform で定義
  - PK: `Token` (String)
  - TTL: `ExpiresAt` 属性で有効化
- [ ] Lambda 実行ロールに `cognito-idp:AdminUpdateUserAttributes` 権限を追加
- [ ] Lambda 実行ロールに `FamilyInviteTable` への読み書き権限を追加

#### フロントエンド (`frontend/`)
- [ ] `/invite?token=xxx` で来た場合、localStorage にトークンを保存
- [ ] サインアップ後の遷移先で JWT の `custom:family_id` 有無で分岐
  - 有り → ホーム
  - 無し + localStorage にトークン → DisplayName 入力 → `POST /families/join`
  - 無し + localStorage 空 → 「家族を作る」画面 → DisplayName 入力 → `POST /families`
- [ ] `POST /families/{...}` 成功後に `Auth.currentSession({ forceRefresh: true })`
- [ ] 設定画面の「家族を招待」で `POST /families/invites` を呼んで QR / URL 表示
- [ ] オーファン状態（Cognito 登録済みだが `family_id` 未セット）の自動復旧フロー
