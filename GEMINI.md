# GEMINI.md

このファイルは、リポジトリ内のコードを扱う Gemini CLI へのガイダンスを提供します。

## プロジェクト概要

**iezi** は、家族間で **家事** と **家事実績** を共有・記録し、獲得ポイントを管理するアプリです。AWS のマネージドサービスのみで構成された完全サーバーレスアーキテクチャを採用しており、2名利用の場合は AWS 無料枠内でほぼ0円での運用を目指します。

## ドメイン用語（重要 — 用語を曖昧に使わないこと）

ドキュメント・コミット・PR・口頭コミュニケーションでは以下の日本語に統一する。「タスク」という曖昧な語は **使わない**。

| 日本語 | 意味 | コード上の名称（英語） | DynamoDB SK / 属性 | API フィールド |
|---|---|---|---|---|
| **家事** | 家事マスター。家族で定義する「家事の種類・名前・獲得ポイント・カテゴリ」の定義データ. 例:「お風呂掃除 10pt」 | `TaskMaster`（backend） / `Task`（frontend） | SK: `TASK#{TaskID}` | `taskId`, `taskName`, `points`, `categoryId` |
| **家事実績** | 家事を実際に実行したという履歴ログ。誰がいつどの家事をして何ポイント獲得したか。 | `TaskHistory` | SK: `HISTORY#{RFC3339Timestamp}#{CognitoSub}#{TaskExecutionID}` | `taskExecutionId`, `taskId`, `points`, `timestamp` |
| **家事カテゴリ** | 「料理」「掃除」「洗濯」など、家事を分類するためのタグ。家事の属性。 | `categoryId` | `TASK#` レコードの `Category` 属性 | `categoryId` |
| **日次サマリ** | 「今日誰が何ポイント稼いだか」を即座に表示するためのホットデータ。 | `DailySummary` | SK: `DAILY#{YYYY-MM-DD}#{CognitoSub}` | `date`, `cognitoSub`, `dailyPoints` |

- 「家事を完了する」=「家事実績を作成する」（= `POST /tasks/execute`）
- 「家事実績を取り消す」=「誤って記録した家事実績を削除し、加算ポイントを減算する」（= `DELETE /tasks/execute`）
- コード上の `TaskID` は **家事** の ID（家事マスターを一意に識別）。`TaskExecutionID` は **家事実績** の ID（個々の実行を一意に識別）。
- API パスやコード識別子で `task` / `Task` が出てきた場合、文脈で「家事」を指すか「家事実績」を指すかを判別する：
  - `PUT /tasks`, `DELETE /tasks/{taskId}` → **家事**（マスター）の操作
  - `POST /tasks/execute`, `DELETE /tasks/execute` → **家事実績** の操作

## 技術スタック（変更禁止）

- **バックエンド**: TypeScript (Node.js) によるファットLambda（全エンドポイントを esbuild で単一ファイルにバンドルして集約）
- **フロントエンド**: React SPA（SSRなし）
- **データベース**: Amazon DynamoDB（シングルテーブルデザイン、テーブル名: `iezi-{env}-FamilyAppTable`）
- **認証**: Amazon Cognito — ユーザー識別子は必ず `CognitoSub` を使用。PII（個人情報）は Cognito 側に留め、DynamoDB には保存しない
- **インフラ**: Terraform (HCL)、`infra/` ディレクトリ

## リポジトリ構成（モノレポ）

- `frontend/` — React SPA（npm workspace）
- `backend/` — Lambda ソースコード（npm workspace、esbuild でバンドル）
- `shared/` — Zod で型検証した共有 TypeScript 型定義（`@iezi/shared`）
- `infra/` — Terraform HCL（注意: ドキュメント内では `infrastructure/` と記載されているが、実際のディレクトリ名は `infra/`）
- `docs/` — 各種仕様書（実装前に必ず参照）

## コマンド

```bash
# ルートから全ワークスペースの依存関係をインストール
npm install

# shared の型定義をビルド
npm run build -w shared

# バックエンドをビルド（esbuild）
npm run build -w backend
```

Terraform（`infra/` から実行）:
```bash
terraform init
terraform plan -var-file=<env>.tfvars
terraform apply -var-file=<env>.tfvars
```

## 仕様書 — 実装前に必ず参照すること

スキーマや API の挙動を推測で実装してはいけません。必ず以下のファイルを確認してください。

| トピック | ファイル |
|---|---|
| AWS リソース、Terraform ファイル構成、セキュリティ設計 | `docs/infrastructure.md` |
| DynamoDB テーブルスキーマ、SK プレフィックス、TTL ルール | `docs/dynamodb_spec.md` |
| API エンドポイント、リクエスト/レスポンス仕様、冪等性 | `docs/api_spec.md` |

## DynamoDB キー設計（重要）

テーブル: `iezi-{env}-FamilyAppTable`（例: `iezi-prod-FamilyAppTable`）— シングルテーブルデザイン、オンデマンドキャパシティ。

| エンティティ | PK | SK |
|---|---|---|
| ユーザー情報・累積ポイント | `FamilyID` | `USER#{CognitoSub}` |
| 家事（家事マスター） | `FamilyID` | `TASK#{TaskID}` |
| 日次サマリ | `FamilyID` | `DAILY#{YYYY-MM-DD}#{CognitoSub}` |
| 家事実績 | `FamilyID` | `HISTORY#{RFC3339Timestamp}#{CognitoSub}#{TaskExecutionID}` |

- GSI/LSI は使用しない — 全アクセスパターンは SK の `begins_with` で対応。
- `DAILY` SK の日付文字列は **必ず** `Asia/Tokyo` タイムゾーンで生成する。
- `ExpiresAt`（Number 型、UNIX タイムスタンプ）が TTL 属性 — `HISTORY` は1年後、`DAILY` は90日後を設定する。

## 冪等性（絶対厳守）

ポイント操作は **必ず** `TransactWriteItems` で以下の3つを同時に書き込む:

1. `HISTORY` レコード — `PutItem` に `attribute_not_exists(DataSortKey)` 条件を付与（重複リクエストをブロック）
2. `DAILY` サマリ — `UpdateItem` で `ADD DailyPoints :points`
3. `USER` レコード — `UpdateItem` で `ADD TotalPoints :points`

`TaskExecutionID`（= 家事実績ID）はユーザーが完了ボタンをタップした瞬間にフロントエンドで発行する UUID。リトライ時も再発行せず同じ UUID を使い回すことで、`attribute_not_exists` 条件が重複書き込みを防ぐ。

家事実績の更新は「削除してから再登録」の2ステップで行う（`HISTORY` レコードの直接編集は禁止）。

## API ルーティング

API Gateway の `ANY /{proxy+}` で全リクエストを単一の Lambda に集約し、Lambda 内部でメソッドとパスの `switch` 文によりルーティングする。全エンドポイントは Gateway レベルの Cognito JWT Authorizer で保護されており、`CognitoSub` は `event.requestContext.authorizer?.jwt?.claims?.sub`（HTTP API V2 イベント形式）から取得する。

## 共有パッケージ（`@iezi/shared`）

フロントエンドとバックエンドの TypeScript コードで共有するリクエスト/レスポンスの型定義は Zod スキーマとしてここに集約する。バックエンドの `tsconfig.json` はローカル開発用に `@iezi/shared` を `../shared/src` にパスマッピングしている。
