# iezi API仕様書 (API Specification)

> 📖 **用語**: 本ドキュメントでは「家事 = 家事マスター（種類・名前・ポイント・カテゴリの定義）」「家事実績 = 家事を実際に実行したログ」を明確に使い分けます。「タスク」は使いません。詳細は `CLAUDE.md` のドメイン用語表を参照。
>
> API パスやコードでは `task` / `Task` という英語が混在します：
> - `PUT /tasks`, `DELETE /tasks/{taskId}` → **家事（マスター）** の操作
> - `POST /tasks/execute`, `DELETE /tasks/execute` → **家事実績** の操作

## 1. 基本仕様

* **アーキテクチャ**: API Gateway + AWS Lambda (TypeScript ファットLambda) + Amazon DynamoDB。
* **ルーティング方式**: API Gatewayの `ANY /{proxy+}` により全てのリクエストを単一のLambda関数に集約し、内部の `switch` 文で各処理へ振り分けます。
* **認証・認可**: 全てのエンドポイントはAmazon API GatewayのCognito Authorizerによって保護されます。
    * フロントエンドからリクエストヘッダー (`Authorization`) に乗せて送られてくるJWTをAPI Gatewayの入り口で自動検証します。
    * 認証を通過した安全なリクエストには、ユーザーの一意な識別子 (`CognitoSub`) がコンテキストとして付与され、Lambdaへ安全に引き渡されます。
    * `CognitoSub` および `custom:family_id` クレームは `event.requestContext.authorizer.jwt.claims` 経由で取得します（HTTP API V2 イベント形式）。
    * **`custom:family_id` クレームが無くても通すエンドポイント**: `POST /families` と `POST /families/join` の2つだけ。これらはサインアップ直後で `custom:family_id` がまだセットされていない状態で呼ばれるためです。Lambda のディスパッチ層でホワイトリストとして明示的に扱います。
* **リクエスト/レスポンスボディ**: JSON。フィールド名は **camelCase** に統一します（例: `taskId`, `taskExecutionId`, `displayName`）。DynamoDB の属性名（`TaskID`, `DataSortKey` 等の PascalCase）はあくまでテーブル内部の表現であり、API I/F には露出させません。
* **エラーレスポンス**: ステータスコード + `{ "message": "<人間可読のメッセージ>" }` を返します。主なステータスコード:
    * `400` バリデーション不備（必須項目欠落、型不正、`points` 範囲外など）
    * `401` JWT 不正・`CognitoSub` 欠落
    * `404` 対象リソース未発見（家事、家事実績）
    * `409` 状態の衝突（既に家族所属、招待が別ユーザーに消費済、`TaskExecutionID` 重複）
    * `410` 招待トークンが未発見または期限切れ
    * `500` 想定外サーバーエラー

---

## 2. エンドポイント詳細

### 2.1. アプリ初期データ取得API

シングルテーブルデザインの「擬似的なJOIN」を活かし、アプリ起動に必要な初期データを一括取得します。

* **エンドポイント**: `GET /family/init`
* **目的**: アプリ起動時に必要な「家族のユーザー情報」と「家事（マスター）」を一度に爆速で取得します。
* **リクエストボディ**: なし
* **レスポンス**:
    ```json
    {
      "users": [
        { "cognitoSub": "...", "displayName": "パパ", "totalPoints": 120 }
      ],
      "taskMasters": [
        { "taskId": "...", "taskName": "お風呂掃除", "points": 10, "categoryId": "water" }
      ]
    }
    ```
    * `taskMasters[].categoryId` は家事カテゴリのID（フロントエンドの `CATEGORIES` 定数に対応）。`Category` 属性を持たない旧データはレスポンスから省略されるため、フロントエンドは未指定時 `"other"` にフォールバックする。
* **DynamoDB操作**: Query
    * PK: `FamilyID` を完全一致で指定します。
    * SK: `begins_with("USER#")` と `begins_with("TASK#")` を指定します。
    * 実装のポイント: DynamoDBの1回のQueryでは1つの条件しか指定できないため、ユーザー用と家事用で2回並列でQueryを投げる（`Promise.all` を活用）処理を行います。

### 2.2. 家事完了API（家事実績の作成） ⚠️最重要

通信エラーによる自動リトライや、連打によるポイント増殖バグを防ぐ「冪等性の担保」のロジックを詰め込んだコアAPIです。

* **エンドポイント**: `POST /tasks/execute`
* **目的**: ユーザーが家事を完了したことを **家事実績** として記録し、ポイントを加算します。
* **リクエストボディ**:
    ```json
    { "taskId": "<家事 UUID>", "taskExecutionId": "<フロントで発行した家事実績 UUID>" }
    ```
* **レスポンス**: `200 { "message": "家事を記録しました" }`
* **エラー**:
    * `400` `taskId` または `taskExecutionId` が欠落
    * `404` 指定された `taskId` の家事が存在しない
    * `409` 同一 `taskExecutionId` で既に記録済み（冪等リトライの安全な弾き）
* **DynamoDB操作**: TransactWriteItems。**3つを完全同時に書き込みます**（1つでも失敗すれば全件ロールバック）。
    * **処理A（家事実績の作成）**:
        * PK: `FamilyID`、SK: `HISTORY#{RFC3339Timestamp}#{CognitoSub}#{TaskExecutionID}`
        * 重要な条件: `attribute_not_exists(DataSortKey)` を指定し、重複リクエストを確実にブロックします。
        * TTL: `ExpiresAt` に完了から1年後のUNIXタイムスタンプをセット。
    * **処理B（日次サマリの更新）**:
        * PK: `FamilyID`、SK: `DAILY#{YYYY-MM-DD}#{CognitoSub}`
        * 重要な仕様: 必ず `Asia/Tokyo` タイムゾーンで日付文字列を生成します。
        * 処理: `UpdateItem` で `ADD DailyPoints :points` しつつ、`SET ExpiresAt = :expiresAt`（現在時刻から90日後）。
    * **処理C（累積ポイントの更新）**:
        * PK: `FamilyID`、SK: `USER#{CognitoSub}`
        * 処理: `UpdateItem` で `ADD TotalPoints :points`。家事完了の度に全期間累計を同期加算します。

### 2.3. 日次サマリ取得API

* **エンドポイント**: `GET /summary/daily`
* **目的**: 指定日（既定は JST の今日）の家族みんなの家事実績や、獲得ポイントの合計を画面に表示します。
* **クエリパラメータ**:
    * `date` (optional, `YYYY-MM-DD` 形式): 取得したい日付。省略時は `Asia/Tokyo` 基準の今日。
* **レスポンス**:
    ```json
    {
      "date": "2026-05-23",
      "summaries": [
        { "cognitoSub": "...", "date": "2026-05-23", "dailyPoints": 30 }
      ]
    }
    ```
* **DynamoDB操作**: Query
    * PK: `FamilyID` を指定します。
    * SK: `begins_with("DAILY#{YYYY-MM-DD}")` を指定します。
    * 実装のポイント: これで指定日の「家族全員分」のサマリデータが取得できます。特定のメンバーだけ欲しい場合は `DAILY#{YYYY-MM-DD}#{CognitoSub}` と完全一致で指定します。

### 2.4. 家事実績タイムライン取得API

* **エンドポイント**: `GET /histories`
* **目的**: 家族の家事実績タイムラインの表示などに使用します。
* **リクエストボディ**: なし
* **レスポンス**:
    ```json
    {
      "histories": [
        {
          "taskExecutionId": "...",
          "cognitoSub": "...",
          "taskId": "...",
          "points": 10,
          "timestamp": "2026-05-23T08:15:00.000Z",
          "expiresAt": 1779763200
        }
      ]
    }
    ```
* **DynamoDB操作**: Query
    * PK: `FamilyID` を指定します。
    * SK: `begins_with("HISTORY#")` を指定します。
    * 実装のポイント: クエリ時に `ScanIndexForward = false`（降順）を指定することで、最新の家事実績から上から順に表示されるよう、並び替えの処理をLambda側で行わずに取得できます。

### 2.5. 家事の作成・更新 API（家事マスターの Upsert）

DynamoDBの `PutItem` は、データが存在しなければ「作成」、存在すれば「上書き（更新）」となるため、作成と更新を1つのエンドポイント（Upsert）としてまとめるのがサーバーレス開発の王道です。

* **エンドポイント**: `PUT /tasks`
* **目的**: 新しい家事（例：「ゴミ出し 10pt」）を作成する、または既存の家事の設定（ポイント数・名前・カテゴリ）を更新します。
* **リクエストボディ**:
    ```json
    { "taskId": "<新規時はフロントで発行した UUID / 更新時は既存 ID>", "taskName": "ゴミ出し", "points": 10, "categoryId": "other" }
    ```
    * `categoryId` は任意フィールド。省略時は `Category` 属性を書き込まない（DynamoDB に属性自体が存在しない状態 = フロントエンドで `"other"` 相当）。
    * `categoryId` の有効値はフロントエンドの `CATEGORIES` 定数（`cooking` / `cleaning` / `laundry` / `water` / `shopping` / `other`）が単一の正。バックエンドは値の妥当性検証を行わず、文字列として保存する（カテゴリ追加・変更時に Lambda デプロイを不要にするため）。
* **レスポンス**: `200 { "message": "家事設定を保存しました" }`
* **エラー**:
    * `400` `taskId` / `taskName` / `points` が欠落、もしくは `points < 0`
* **DynamoDB操作**: PutItem
    * PK: `FamilyID` を指定します。
    * SK: `TASK#{TaskID}` を指定します。
    * 属性: `TaskName`, `Points`, `Category`（任意）。
    * 実装のポイント: 家事のデータには TTL（自動削除）は設定せず、永久保存として書き込みます。

### 2.6. 家事の削除 API

* **エンドポイント**: `DELETE /tasks/{taskId}`
* **目的**: 不要になった家事（マスター）を削除します。既存の家事実績（`HISTORY` レコード）は削除しません。
* **パスパラメータ**: `taskId` (UUID)。`execute` という値はルーターが `DELETE /tasks/execute`（§2.10）に振り分けるため衝突しません。
* **リクエストボディ**: なし
* **レスポンス**: `200 { "message": "家事設定を削除しました" }`
* **DynamoDB操作**: DeleteItem
    * PK: `FamilyID` を指定します。
    * SK: `TASK#{TaskID}` を指定します。

### 2.7. 家族作成API（オンボーディング）

最初の1人（招待されていないユーザー）が家族を新規作成するAPIです。

* **エンドポイント**: `POST /families`
* **目的**: 新しい家族グループを作成し、呼び出し元ユーザーをそのオーナーとして登録します。
* **JWT 要件**: 必須。ただし `custom:family_id` クレームは **存在しないこと**（既に家族所属の場合は 409 Conflict を返す）。
* **リクエストボディ**: `{ "displayName": "パパ" }`
* **レスポンス**: `200 { "familyId": "fam_<UUID>" }`
* **エラー**:
    * `400` `displayName` が欠落・空文字
    * `409` 既に `custom:family_id` を持つ（= 家族所属済み）、もしくは同 `CognitoSub` の USER レコードが既存
* **処理**:
    1. JWT クレームから `CognitoSub` を取得。`custom:family_id` が既に存在する場合は 409 Conflict。
    2. `fam_{UUIDv4}` 形式で新しい `FamilyID` を発行。
    3. `FamilyAppTable` に `USER` レコードを `PutItem`（PK=`FamilyID`, SK=`USER#{CognitoSub}`, `DisplayName`, `TotalPoints=0`）。条件 `attribute_not_exists(DataSortKey)`。
    4. Cognito `AdminUpdateUserAttributes` で `custom:family_id` をセット。
    5. フロントは JWT 強制リフレッシュ（`Auth.currentSession({ forceRefresh: true })`）して新しいクレームを取り込む。

### 2.8. 招待トークン発行API

既存ユーザーが家族メンバーを招待するためのトークンを発行します。

* **エンドポイント**: `POST /families/invites`
* **目的**: 共有可能な招待リンク（QR / URL）を生成。
* **JWT 要件**: 必須。`custom:family_id` クレームが **必要**。
* **リクエストボディ**: なし
* **レスポンス**:
    ```json
    { "token": "550e8400-...", "url": "https://<frontend-domain>/invite?token=550e8400-...", "expiresAt": 1737000000 }
    ```
    * `url` のドメイン部は Lambda の環境変数 `FRONTEND_URL` を起点に組み立てます。現状の本番は CloudFront のデフォルトドメイン（`https://dXXX.cloudfront.net`）、ローカル開発は `http://localhost:5173`。カスタムドメイン（例: `https://iezi.app`）を当てる際は Terraform の `FRONTEND_URL` を差し替えるだけで切り替わります。
* **DynamoDB操作**: `PutItem`（**別テーブル** `FamilyInviteTable`）
    * PK: `Token`（UUIDv4 を生成）
    * 属性: `FamilyID`, `ExpiresAt`（現在時刻 + 24時間のUNIX秒）
    * TTL: `ExpiresAt` を TTL 属性として有効化（自然消滅）

### 2.9. 招待で家族に参加API ⚠️冪等性必須

招待リンク経由でサインアップした新規ユーザーが家族に参加するAPIです。

* **エンドポイント**: `POST /families/join`
* **目的**: 招待トークンを消費して新規ユーザーを既存家族に登録する。
* **JWT 要件**: 必須。ただし `custom:family_id` クレームは **存在しないこと**。
* **リクエストボディ**: `{ "token": "550e8400-...", "displayName": "ママ" }`
* **レスポンス**: `{ "familyId": "fam_xxx" }`
* **エラー**:
    * 招待が見つからない or 期限切れ → 410 Gone
    * 既に別ユーザーが消費済み → 409 Conflict
    * 既に同ユーザーが消費済み → **冪等処理として続行**（リトライ許容）
    * 呼び出しユーザーが既に家族所属 → 409 Conflict
* **DynamoDB操作**: 招待トークンのプリチェック（GetItem）→ `TransactWriteItems`（**2テーブル横断**）の2段構え
    * **プリチェック**: `FamilyInviteTable` を `GetItem`
        * 招待が見つからない、もしくは `ExpiresAt < now` の場合は 410 Gone を即返却。
    * **処理A（招待を消費）**: `FamilyInviteTable`
        * `UpdateItem` で `UsedAt`, `UsedBy` をセット
        * 条件: `attribute_exists(Token) AND (attribute_not_exists(UsedAt) OR UsedBy = :sub)`
            * `attribute_exists(Token)`: プリチェック後の TTL 削除との競合で「ExpiresAt のない不滅レコード」が生成されることを防ぐ防御線。
            * `attribute_not_exists(UsedAt) OR UsedBy = :sub`: 未消費なら通し、同ユーザーの冪等リトライも通す。別ユーザー消費済みは拒否（409）。
    * **処理B（ユーザー登録）**: `FamilyAppTable`
        * `PutItem` で PK=`FamilyID`, SK=`USER#{CognitoSub}`, `DisplayName`, `TotalPoints=0`
        * 条件: `attribute_not_exists(DataSortKey)`
* **トランザクション後処理**:
    * Cognito `AdminUpdateUserAttributes` で `custom:family_id` を更新
    * Cognito 更新が失敗した場合、クライアントは同じトークンで再試行可能（条件式が冪等性を担保）
    * フロントは JWT 強制リフレッシュして新クレームを取り込む

### 2.10. 家事実績の取り消し（削除）API ⚠️要注意

間違えて「完了」を押してしまった場合など、家事実績を削除するAPIです。単に家事実績を消すだけでなく、加算されたポイントも同時にマイナス（減算）する必要があるため、トランザクション処理が必須になります。

* **エンドポイント**: `DELETE /tasks/execute`
* **目的**: 誤って記録した家事実績を削除し、日次サマリと累積ポイントを減算して元に戻します。
* **リクエストボディ**:
    ```json
    { "taskExecutionId": "<消したい家事実績の UUID>", "timestamp": "<家事実績の RFC3339 時刻>", "points": 10 }
    ```
* **レスポンス**: `200 { "message": "家事の記録を取り消しました" }`
* **エラー**:
    * `400` `taskExecutionId` / `timestamp` / `points` が欠落、もしくは `points <= 0`
    * `404` 対象の家事実績レコードが見つからない（既に削除済み等）
* **DynamoDB操作**: TransactWriteItems。**3つを完全同時に処理**（1つでも失敗すれば全件ロールバック）。
    * **処理A（家事実績の削除）**:
        * PK: `FamilyID`、SK: `HISTORY#{RFC3339Timestamp}#{CognitoSub}#{TaskExecutionID}`
        * `DeleteItem` を指定し、条件 `attribute_exists(DataSortKey)` で存在チェックを伴って削除。
    * **処理B（日次サマリの減算）**:
        * PK: `FamilyID`、SK: `DAILY#{YYYY-MM-DD}#{CognitoSub}`
        * `Asia/Tokyo` 基準で `timestamp` から日付文字列を復元し SK を組み立てます。
        * `UpdateItem` の `ADD DailyPoints :points` に **マイナス値**（`-points`）を渡して減算します。
    * **処理C（累積ポイントの減算）**:
        * PK: `FamilyID`、SK: `USER#{CognitoSub}`
        * `UpdateItem` で `ADD TotalPoints :points`（同じく `-points`）。家事完了と対称な3点同時減算で総計を整合させます。

---

### 💡 「家事実績の更新」についてのベストプラクティス

モダンなシステム設計（特にポイントやお金が絡む履歴データ）においては、**「一度記録された家事実績（HISTORY）は直接編集（Update）させない」**のが鉄則です。

もしバックエンドに「家事実績更新用のPUT API」を作ってしまうと、差分ポイントの再計算など複雑なロジックが必要になり、バグの温床になります。
そのため、フロントエンドの仕様として以下の2ステップで処理を行うフローを採用します。

1. **削除APIを呼ぶ**：まず `DELETE /tasks/execute` をコールし、誤って登録した家事実績の削除と、加算されていたポイントのマイナス（減算）を行います。
2. **完了APIを呼ぶ**：次に `POST /tasks/execute` をコールし、正しい家事の内容で家事実績を再登録し、正しいポイントをプラス（加算）します。

この「取り消して、やり直す」仕様にすることで、APIもDynamoDBの処理も極めてシンプルかつ堅牢に保つことができます。
