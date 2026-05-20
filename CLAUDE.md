# CLAUDE.md

このファイルは、リポジトリ内のコードを扱う Claude Code (claude.ai/code) へのガイダンスを提供します。

## プロジェクト概要

**iezi** は、家族間で家事タスクを共有・記録し、獲得ポイントを管理するアプリです。AWS のマネージドサービスのみで構成された完全サーバーレスアーキテクチャを採用しており、2名利用の場合は AWS 無料枠内でほぼ0円での運用を目指します。

## 技術スタック（変更禁止）

- **バックエンド**: TypeScript (Node.js) によるファットLambda（全エンドポイントを esbuild で単一ファイルにバンドルして集約）
- **フロントエンド**: React SPA（SSRなし）
- **データベース**: Amazon DynamoDB（シングルテーブルデザイン、テーブル名: `FamilyAppTable`）
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

テーブル: `FamilyAppTable` — シングルテーブルデザイン、オンデマンドキャパシティ。

| エンティティ | PK | SK |
|---|---|---|
| ユーザー情報・累積ポイント | `FamilyID` | `USER#{CognitoSub}` |
| 家事マスター設定 | `FamilyID` | `TASK#{TaskID}` |
| 日次サマリ | `FamilyID` | `DAILY#{YYYY-MM-DD}#{CognitoSub}` |
| タスク履歴 | `FamilyID` | `HISTORY#{RFC3339Timestamp}#{CognitoSub}#{TaskExecutionID}` |

- GSI/LSI は使用しない — 全アクセスパターンは SK の `begins_with` で対応。
- `DAILY` SK の日付文字列は **必ず** `Asia/Tokyo` タイムゾーンで生成する。
- `ExpiresAt`（Number 型、UNIX タイムスタンプ）が TTL 属性 — `HISTORY` は1年後、`DAILY` は90日後を設定する。

## 冪等性（絶対厳守）

ポイント操作は **必ず** `TransactWriteItems` で以下の3つを同時に書き込む:

1. `HISTORY` レコード — `PutItem` に `attribute_not_exists(DataSortKey)` 条件を付与（重複リクエストをブロック）
2. `DAILY` サマリ — `UpdateItem` で `ADD DailyPoints :points`
3. `USER` レコード — `UpdateItem` で `ADD TotalPoints :points`

`TaskExecutionID` はユーザーが完了ボタンをタップした瞬間にフロントエンドで発行する UUID。リトライ時も再発行せず同じ UUID を使い回すことで、`attribute_not_exists` 条件が重複書き込みを防ぐ。

実績の取り消しは「削除してから再登録」の2ステップで行う（`HISTORY` レコードの直接編集は禁止）。

## API ルーティング

API Gateway の `ANY /{proxy+}` で全リクエストを単一の Lambda に集約し、Lambda 内部でメソッドとパスの `switch` 文によりルーティングする。全エンドポイントは Gateway レベルの Cognito JWT Authorizer で保護されており、`CognitoSub` は `event.requestContext.authorizer?.jwt?.claims?.sub`（HTTP API V2 イベント形式）から取得する。

## 共有パッケージ（`@iezi/shared`）

フロントエンドとバックエンドの TypeScript コードで共有するリクエスト/レスポンスの型定義は Zod スキーマとしてここに集約する。バックエンドの `tsconfig.json` はローカル開発用に `@iezi/shared` を `../shared/src` にパスマッピングしている。
