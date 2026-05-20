# TODO

## 家族ID払い出し・家族参加フロー

### 背景
現在、`FamilyID` は JWT クレーム (`custom:family_id`) / クエリパラメータ / リクエストボディのいずれかから取得しているが、それを最初にセットする仕組みが未実装。新規ユーザーがアプリを使い始められない状態。

### 設計案（検討中）

- **FamilyID の格納場所**: Cognito カスタム属性 `custom:family_id`
  - 一度セットすれば以降の JWT に自動で含まれる（既存の `backend/src/index.ts` の実装と一致）
  - Lambda の IAM ロールに `cognito-idp:AdminUpdateUserAttributes` 権限が必要

- **必要なエンドポイント**（未実装）:
  - `POST /families` — 家族を新規作成（FamilyID を UUID で払い出し、Cognito に書き込み）
  - `POST /families/join` — 既存の家族に参加（FamilyID を body で受け取り、Cognito に書き込み）
  - `PUT /users/me` — ユーザープロフィール（DisplayName）の登録・更新

- **ユーザー登録フロー案**:
  ```
  User A: POST /families  { displayName }  → { familyId }
  User B: POST /families/join  { familyId, displayName }
  ```

### 決めること
- [ ] 家族への参加方法: FamilyID（UUID）をそのまま共有する形でよいか、招待コードを別途発行するか
- [ ] `PUT /users/me` は家族作成・参加時にまとめて行うか、独立したエンドポイントとして残すか
- [ ] Terraform で Lambda 実行ロールに Cognito 権限を追加する対応
