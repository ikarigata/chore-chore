# インフラ構成仕様書 (Infrastructure Configuration Specification)

## 1. プロジェクト概要

- **プロジェクト名**: iezi
- **アーキテクチャ方針**: 完全オンデマンド型サーバーレスアーキテクチャ
- **運用コスト目標**: ユーザー2名による日常利用において、AWS無料枠を最大限活用し、月額ほぼ0円（かかっても数十円未満）での運用を目指す。

## 2. 全体システムアーキテクチャ

本プロジェクトは、フロントエンド、API、バックエンド、データベース、認証機能のすべてをAWSのマネージドサービスで構築し、インフラの維持費と運用負荷を極限まで抑える構成を採用します。

### 2.1. システム構造図（データフロー概略）

```
[User Browser]
     │ (HTTPS)
     ▼
[Amazon CloudFront] ──(OAC)──> [Amazon S3] (静的アセット配信)
     │ (API Request / JWT)
     ▼
[Amazon API Gateway (HTTP API)] (Cognito JWT Authorizerによる入口での認証検証)
     │ (安全なコンテキスト / CognitoSub の伝播)
     ▼
[AWS Lambda (メインAPI)] (TypeScript ファットLambdaによるビジネスロジック・同期トランザクション処理)
     │ (データ永続化 / 同時書き込みトランザクション)
     ▼
[Amazon DynamoDB] (シングルテーブル設計)
```

### 2.2. リポジトリ構成（モノレポ）

プロジェクトは1つのリポジトリでフロントからインフラまでを一元管理するモノレポ構成をとります。

- `frontend/`: ReactによるSPAプロジェクト
- `backend/`: TypeScriptによるLambdaソースコード
- `infra/`: TerraformによるHCLインフラストラクチャ定義

## 3. インフラコンポーネント仕様

### 3.1. フロントエンド配信層（Amazon CloudFront + Amazon S3）

- **役割**: Reactでビルドされた静的アセットの安全なHTTPS配信。
- **構成方針**: サーバーサイドレンダリングを行わない完全なSPA構成とし、CloudFront + S3の組み合わせで配信します。S3はパブリック公開せず、CloudFrontの **OAC (Origin Access Control)** 経由でのみアクセス可能とします。
- **SPAルーティング対応**: クライアントサイドルーティングを成立させるため、CloudFrontのカスタムエラーレスポンス設定により、403/404を `200 /index.html` へフォールバックします。
- **キャッシュ戦略**: 静的アセット（ハッシュ付きファイル）は長期キャッシュ、`index.html` は短期キャッシュ or キャッシュ無効化により、デプロイ後の即時反映を担保します。

### 3.2. API・ルーティング層（Amazon API Gateway HTTP API）

- **役割**: クライアントからのREST APIリクエストの受付とバックエンドへのプロキシ。
- **API種別**: **HTTP API** を採用。REST APIに対して約1/3のリクエスト単価で、本構成に必要な機能（Lambdaプロキシ統合、Cognito JWT Authorizer、CORS、カスタムドメイン）は全てネイティブにサポートされます。
- **構成方針**: `ANY /{proxy+}` 設定を用いたLambdaプロキシ統合を採用。エンドポイントのルーティングはコンピューティング層へ透過的に引き渡します。
- **アクセス保護**: **Cognito JWT Authorizer** を前面に配置し、APIの境界線で不正リクエストをシャットアウトします。
- **CORS設定**:
  - 許可Origin: フロントエンド配信用のCloudFrontドメイン（およびローカル開発用 `http://localhost:*`）のみ
  - 許可メソッド: `GET, POST, PUT, DELETE, OPTIONS`
  - 許可ヘッダー: `Authorization, Content-Type`
  - クレデンシャル送信: 不要（JWTはAuthorizationヘッダーで送信するため）

### 3.3. コンピューティング層（AWS Lambda）

- **役割**: アプリケーションのビジネスロジックの実行。
- **構成方針 (ファットLambda)**: 全てのエンドポイントの処理ロジックを単一の TypeScript Lambda 関数に集約します。esbuild による単一ファイルへのバンドルにより、インフラ定義のシンプル化と高速なコールドスタートを両立します。ランタイムは **Node.js 22.x** を使用します。
- **JWTクレーム取得**: HTTP API V2 イベントの `event.requestContext.authorizer?.jwt?.claims?.sub` から `CognitoSub` を抽出し、ユーザー識別子として利用します。

### 3.4. データベース層（Amazon DynamoDB）

- **役割**: アプリケーションデータの永続化。
- **構成方針**: 1つの物理テーブルにあらゆるエンティティを同居させる「シングルテーブルデザイン」を採用します。
- **キャパシティモード**: **オンデマンド (PAY_PER_REQUEST)** を採用。ユーザー2名の散発的アクセスに対し、無駄なプロビジョンドコストを発生させません。
- **主キー設計**: パーティションキー（PK）とソートキー（SK）を組み合わせた複合主キー。PKに家族（グループ）の一意なIDを据えることで、クエリを高速化します。
- **同期トランザクション処理**: 履歴の記録、日次サマリの更新、総累積ポイントの更新は、メインAPI内で `TransactWriteItems` を用いて完全に同時に書き込む同期処理を実行します。
- **データライフサイクル管理 (TTL)**: テーブルの属性に `ExpiresAt` (Number型) を追加し、日次サマリやログ履歴などのデータに対し自動削除（TTL）プロセスを適用してストレージコストを抑えます。
- **バックアップ**: **PITR (Point-in-Time Recovery)** を有効化し、誤操作・誤削除発生時に直近35日間の任意時点へ復旧可能とします。

### 3.5. 認証・認可層（Amazon Cognito）

- **役割**: ユーザー管理、認証、セキュリティトークン（JWT）の発行。
- **構成方針**: 完全に独立した認証プロバイダーとしてCognitoユーザープールを運用し、セッション管理までをフルマネージドで委ねます。

## 4. セキュリティ & データ整合性設計

### 4.1. 認証ガードによるコスト・セキュリティ防御

フロントエンドからHTTPヘッダーに乗せて送られてくるJWTをAPI GatewayのJWT Authorizerが入口で自動検証します。署名切れ等の不正リクエストは奥のLambdaを起動させる前に「401 Unauthorized」として門前払いするため、無駄なLambda課金を根本から防ぎます。安全なユーザー識別子（CognitoSub）のみがコンテキストとしてLambdaへ引き渡されます。

### 4.2. 個人情報（PII）の分離（セパレーション）

メールアドレス等の個人情報（PII）はすべて堅牢なAmazon Cognito側に安全に秘匿します。アプリケーションのDB（DynamoDB）側には、ランダムなUUID形式の識別子（CognitoSub）のみを背番号として持たせることで、強固なセキュリティ分離を実現します。

### 4.3. エンドツーエンドでの冪等性（ポイント増殖バグ防止）

通信エラー時の自動リトライやボタン連打による「ポイントの二重加算」をシステム全体で100%防ぎます。

- **フロントエンド**: ユーザーが完了ボタンをタップした初めての瞬間に一意なアクションID（UUID v4）を発行し状態に保持します。自動再送時も新しくIDを作らず使い回します。
- **バックエンド**: Lambdaは受け取ったIDをデータベースの主キー（SK）の末尾にそのまま組み込みます。
- **データベース**: DynamoDBへのトランザクション書き込み時に「対象キーがまだ存在しない場合のみ書き込みを許可する（`attribute_not_exists`）」条件式を適用。重複リクエストはインフラの制約によって安全に弾かれます。

## 5. IaC（インフラのコード化）& 環境管理仕様

### 5.1. Terraformによるリソース管理

すべてのAWSリソースはTerraform（HCL）を用いてコード化し、環境の再現性を確保します。

- `provider.tf`: AWSプロバイダー設定、共通環境変数
- `backend.tf`: Terraform stateのリモート管理設定（後述）
- `cloudfront.tf`: CloudFrontディストリビューション、OAC、SPAフォールバック設定
- `s3.tf`: 静的アセット用バケット（パブリックアクセス全ブロック、OACからのみ許可）
- `dynamodb.tf`: テーブル（FamilyAppTable）、オンデマンドモード、TTL属性、PITRの設定
- `cognito.tf`: ユーザープールおよびクライアント連携設定
- `lambda.tf`: TypeScript ファットLambda（API用、Node.js 22.x ランタイム）の定義
- `apigateway.tf`: HTTP API、プロキシ統合（ANY）、CORS、Cognito JWT Authorizer設定
- `iam_github_oidc.tf`: GitHub Actionsからのデプロイ用OIDC IDプロバイダーおよびデプロイロール定義

### 5.2. Terraform stateのリモート管理

Terraform stateは **S3バケット + DynamoDBテーブル（state lock用）** の組み合わせでリモート管理します。

- ローカルにstateを置かないことで、state紛失リスクおよび環境間の競合を防止。
- stateバケットはバージョニング有効化・パブリックアクセス全ブロック・暗号化（SSE-S3）を施します。
- stateロック用DynamoDBテーブルにより、同時 `terraform apply` を安全に排他制御します。

### 5.3. 環境分離方針

ステージング（Staging）環境と本番（Production）環境は、Terraformのワークスペース機能や環境変数ファイル（`.tfvars`）を用いて完全に隔離された独立インフラとして管理します。

### 5.4. シークレット管理とCI/CD認証

- **シークレット管理**: APIキーやクレデンシャルは、GitHub SecretsやAWS Systems Manager（Parameter Store）を活用して安全に注入します。
- **AWSへのデプロイ認証**: GitHub Actionsから **OIDC連携 (AssumeRoleWithWebIdentity)** によりIAMロールを引き受ける方式を採用します。長期アクセスキー（IAMユーザーのアクセスキー）はGitHub Secretsに保管しません。
  - 信頼ポリシーで対象リポジトリ・ブランチを限定し、最小権限のデプロイロールを定義します。

### 5.5. オブザーバビリティ

- **ログ管理**: デバッグ用の実行ログはCloudWatch Logsへ集約しますが、ストレージ料金の累積を防ぐため、すべてのロググループに対して保持期間（Retention）を14日〜30日程度に制限します。