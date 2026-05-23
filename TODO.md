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
- [x] `POST /families` ハンドラ実装
- [x] `POST /families/invites` ハンドラ実装
- [x] `POST /families/join` ハンドラ実装（`TransactWriteItems` で `FamilyInviteTable` と `FamilyAppTable` を跨ぐ）
- [x] ディスパッチ層に「`custom:family_id` クレーム不要エンドポイント」のホワイトリストを追加
- [x] Cognito `AdminUpdateUserAttributes` 呼び出しの実装

#### インフラ (`infra/`)
- [x] `FamilyInviteTable` を Terraform で定義
  - PK: `Token` (String)
  - TTL: `ExpiresAt` 属性で有効化
- [x] Lambda 実行ロールに `cognito-idp:AdminUpdateUserAttributes` 権限を追加
- [x] Lambda 実行ロールに `FamilyInviteTable` への読み書き権限を追加

#### フロントエンド (`frontend/`)
- [x] `/invite?token=xxx` で来た場合、localStorage にトークンを保存
- [x] サインアップ後の遷移先で JWT の `custom:family_id` 有無で分岐
  - 有り → ホーム
  - 無し + localStorage にトークン → DisplayName 入力 → `POST /families/join`
  - 無し + localStorage 空 → 「家族を作る」画面 → DisplayName 入力 → `POST /families`
- [x] `POST /families/{...}` 成功後に `Auth.currentSession({ forceRefresh: true })`
- [x] 設定画面の「家族を招待」で `POST /families/invites` を呼んで QR / URL 表示
- [x] オーファン状態（Cognito 登録済みだが `family_id` 未セット）の自動復旧フロー

---

## フロントエンド全体点検（2026-05-23 実施）

バックエンドとのAPIインターフェース整合性を中心に点検。エンドポイントのパス・メソッド・フィールド名・認証フローはすべて仕様と一致していた。以下は発見した問題点。

---

### 🔴 バグ（重要）

#### 家事カテゴリが永続化されず、リロード後にホーム画面の家事一覧が空になる

- **該当箇所**: `frontend/src/context.tsx:62`
- **原因**: バックエンドの `TaskMaster`（家事）に `categoryId` 属性が存在しないため、`/family/init` レスポンスから家事を受け取る際に `categoryId: 'other'` をハードコードしている。ページをリロードすると全家事が `'other'` 扱いになる。
- **影響**: `Home.tsx` はカテゴリで家事をフィルタリングしているため（`tasks.filter(t => t.categoryId === selectedCategory)`）、「料理」「掃除」などを選択しても家事が0件表示になり、ホーム画面のコア機能が機能しない。

#### 確定方針（2026-05-23 決定）

**バックエンドスキーマ拡張**で対応する。localStorage への保存は、家族間で複数デバイスを跨ぐマルチユーザーアプリでは構造的に不適切（招待で参加した家族メンバーが過去の家事のカテゴリを共有できない、再インストールで消失する等）のため不採用。

- DynamoDB `TASK#` レコードに `Category` 属性（任意・文字列）を追加する。SK 形式 `TASK#{TaskID}` は変更しない。
- `PUT /tasks` のリクエストボディと `GET /family/init` のレスポンスに `categoryId` を含める。
- カテゴリの有効値はフロントエンドの `CATEGORIES` 定数が単一の正と見なし、バックエンドは値の妥当性検証を行わない（カテゴリ追加・変更時の Lambda デプロイを不要にするため）。
- 既存の `Category` 属性を持たない家事レコードはマイグレーション不要 — フロントエンドの既存フォールバック（`CATEGORIES.find(...) ?? CATEGORIES[5]` = `'other'`）に任せる。

仕様の最終形は `docs/api_spec.md` §2.1 / §2.5、`docs/dynamodb_spec.md` §2 ② を参照。

#### 実装タスク

##### ドキュメント
- [x] `CLAUDE.md` にドメイン用語表を追加（家事 / 家事実績 / 家事カテゴリ）
- [x] `docs/readme.md` に用語セクションを追加
- [x] `docs/api_spec.md` §2.1（GET /family/init）レスポンスに `categoryId` 追記
- [x] `docs/api_spec.md` §2.5（PUT /tasks）リクエストボディに `categoryId` 追記
- [x] `docs/dynamodb_spec.md` §2 ② に `Category` 属性追記

##### バックエンド (`backend/`)
- [x] `src/types/domain.ts` の `TaskMaster` に `categoryId?: string` を追加
- [x] `src/repositories/IFamilyRepository.ts` の `UpsertTaskInput` に `categoryId?: string` を追加
- [x] `src/handlers/taskUpsert.ts` でリクエストボディから `categoryId` を取り出してリポジトリへ渡す（必須項目ではないので欠落時はそのまま `undefined` を渡す）
- [x] `src/repositories/dynamodb/FamilyRepository.ts`:
  - [x] `parseTaskMaster` で `Category` 属性を読み込み、`categoryId` として返す（属性が無ければプロパティ自体を含めない）
  - [x] `upsertTaskMaster` で `input.categoryId` が定義されている場合のみ `Category` 属性として書き込む（未定義時に空文字を書き込まない）
- [x] `src/__tests__/handlers/taskUpsert.test.ts` に「`categoryId` 付きで保存できる」「`categoryId` 省略時は属性なしで保存される」のテストを追加
- [x] `src/__tests__/handlers/familyInit.test.ts` に「家事のレスポンスに `categoryId` が含まれる」「旧データ（`categoryId` なし）も問題なく返る」のテストを追加
- [x] `src/__tests__/mocks/MockFamilyRepository.ts` は `UpsertTaskInput` の型変更のみで対応完了（追加実装不要）

##### フロントエンド (`frontend/`)
- [x] `src/context.tsx` の `InitResponse` 型に `categoryId?: string` を追加
- [x] `src/context.tsx` のハードコード `categoryId: 'other'` を撤去し、レスポンスの `categoryId ?? 'other'` を使う
- [x] `src/context.tsx`（`addTask`）で `PUT /tasks` に `categoryId` を含めて送信する
- [x] `src/types.ts` の `Task` 型の `categoryId` コメントを更新（バックエンドにも保存される旨）

---

### 🟡 バグ（軽微）

#### タスク実行後に累計ポイント（`totalPoints`）が更新されない

- **該当箇所**: `frontend/src/context.tsx:86-90`
- **原因**: `executeTask` 成功後に `GET /summary/daily` と `GET /histories` は再取得するが、`GET /family/init` を再取得しない。`UserScore` コンポーネントが表示する「累計 XX pt」は初回ロード値のまま固まる。
- **影響**: タスクを完了してもダッシュボードの「累計ポイント」がリロードするまで更新されない（日次ポイントは更新される）。

- [x] `executeTask` 成功後に `members` も再取得する。`/family/init` を叩き直すか、ローカル state で `ADD totalPoints += task.points` を楽観的に加算する（楽観更新の方がUX上好ましい）。

---

### 🟡 未実装

#### 履歴の取り消し機能がフロントエンドにない

- [x] `context.tsx` に `cancelTask(item: HistoryItem): Promise<void>` を追加し、`apiDelete('/tasks/execute', ...)` を呼ぶ
- [x] `History.tsx` の自分の家事実績にのみ取り消しボタン（Undo2 アイコン）を追加（バックエンドが `ctx.cognitoSub` でSKを組み立てるため他人の実績は取り消せない設計）
- [x] 成功後に `summary/daily` と `histories` を再取得してローカル状態を更新

---

### 🟢 型の不整合（軽微）

#### `HistoryItem` 型に `expiresAt` フィールドがない

- **該当箇所**: `frontend/src/types.ts:23`
- **状況**: バックエンドの `TaskHistory`（`backend/src/types/domain.ts:24`）は `expiresAt: number` を返すが、フロントの `HistoryItem` にこのフィールドが定義されていない。現時点で `expiresAt` を表示・利用していないため実害はないが、型が実際のAPIレスポンスと乖離している。

- [x] `HistoryItem` に `expiresAt: number` を追加して型を実態に合わせる。

---

### 🟢 UXの問題

#### 初期化失敗時にスピナーが永続表示されエラーを伝える手段がない

- **該当箇所**: `frontend/src/context.tsx:67`
- **現状**: `init().catch(console.error)` でエラーを握り潰しているため、ネットワークエラーや認証エラーが発生した場合に `initialized` が `false` のまま変化せず、アプリが無限ローディング状態になる。

- [x] `context.tsx` にエラー状態（`const [initError, setInitError] = useState<string | null>(null)`）を追加する。
- [x] `init().catch(err => { setInitError(...); setInitialized(true) })` に変更する。
- [x] `AppProvider` 内でエラー状態を検知した場合、スピナーの代わりに「読み込みに失敗しました。再読み込みしてください」などのエラー画面を表示する。
