# iezi API仕様書 (API Specification)

## 1. 基本仕様

* **アーキテクチャ**: API Gateway + AWS Lambda (Go言語ファットLambda) + Amazon DynamoDB。
* **ルーティング方式**: API Gatewayの `ANY /{proxy+}` により全てのリクエストを単一のLambda関数に集約し、内部の `switch` 文で各処理へ振り分けます。
* **認証・認可**: 全てのエンドポイントはAmazon API GatewayのCognito Authorizerによって保護されます。
    * フロントエンドからリクエストヘッダー (`Authorization`) に乗せて送られてくるJWTをAPI Gatewayの入り口で自動検証します。
    * 認証を通過した安全なリクエストには、ユーザーの一意な識別子 (`CognitoSub`) がコンテキストとして付与され、Lambdaへ安全に引き渡されます。
    * `CognitoSub` および `custom:family_id` クレームは `event.requestContext.authorizer.jwt.claims` 経由で取得します（HTTP API V2 イベント形式）。
    * **`custom:family_id` クレームが無くても通すエンドポイント**: `POST /families` と `POST /families/join` の2つだけ。これらはサインアップ直後で `custom:family_id` がまだセットされていない状態で呼ばれるためです。Lambda のディスパッチ層でホワイトリストとして明示的に扱います。

---

## 2. エンドポイント詳細

### 2.1. アプリ初期データ取得API

シングルテーブルデザインの「擬似的なJOIN」を活かし、アプリ起動に必要な初期データを一括取得します。

* **エンドポイント**: `GET /family/init`
* **目的**: アプリ起動時に必要な「家族のユーザー情報」と「家事のマスター設定」を一度に爆速で取得します。
* **DynamoDB操作**: Query
    * PK: `FamilyID` を完全一致で指定します。
    * SK: `begins_with("USER#")` と `begins_with("TASK#")` を指定します。
    * 実装のポイント: DynamoDBの1回のQueryでは1つの条件しか指定できないため、シンプルにPKを指定して全体を取得するか、ユーザー用とタスク用で2回並列でQueryを投げる（`Promise.all` などを活用する）処理を行います。

### 2.2. 家事完了API ⚠️最重要

通信エラーによる自動リトライや、連打によるポイント増殖バグを防ぐ「冪等性の担保」のロジックを詰め込んだコアAPIです。

* **エンドポイント**: `POST /tasks/execute`
* **目的**: ユーザーが家事を完了したことを記録し、ポイントを加算します。
* **リクエストボディ**: `TaskID` (どの家事か) および `TaskExecutionID` (フロントエンドで生成した一意のUUID)。
* **DynamoDB操作**: TransactWriteItems (トランザクション書き込み)。
    * **処理A（タスク履歴の作成）**:
        * PK: `FamilyID` を指定します。
        * SK: `HISTORY#{RFC3339Timestamp}#{CognitoSub}#{TaskExecutionID}` を指定します。
        * 重要な条件: `attribute_not_exists(SK)` を指定し、重複リクエストを確実にブロックします。
        * TTL: あわせて `ExpiresAt` に完了から1年後のUNIXタイムスタンプをセットします。
    * **処理B（日次サマリの更新）**:
        * PK: `FamilyID` を指定します。
        * SK: `DAILY#{YYYY-MM-DD}#{CognitoSub}` を指定します。
        * 重要な仕様: 必ず `Asia/Tokyo` タイムゾーンで日付文字列を生成します。
        * 重要な処理: `UpdateItem` の機能を使ってポイントを `ADD`（加算）しつつ、`ExpiresAt` に現在時刻から90日後のUNIXタイムスタンプをセットします。

### 2.3. 今日のサマリ取得API

* **エンドポイント**: `GET /summary/daily`
* **目的**: 今日の家族みんなのタスク完了状況や、獲得ポイントの合計を画面に表示します。
* **DynamoDB操作**: Query
    * PK: `FamilyID` を指定します。
    * SK: `begins_with("DAILY#{YYYY-MM-DD}")` を指定します。
    * 実装のポイント: これで「今日」の「家族全員分」のサマリデータが取得できます。特定のメンバーだけ欲しい場合は `DAILY#{YYYY-MM-DD}#{CognitoSub}` と完全一致で指定します。

### 2.4. タイムライン取得API

* **エンドポイント**: `GET /histories`
* **目的**: 家事が完了したタイムラインの表示などに使用します。
* **DynamoDB操作**: Query
    * PK: `FamilyID` を指定します。
    * SK: `begins_with("HISTORY#")` を指定します。
    * 実装のポイント: クエリ時に `ScanIndexForward = false`（降順）を指定することで、最新の履歴から上から順に表示されるよう、並び替えの処理をLambda側で行わずに取得できます。

### 2.5. 家事設定（マスター）の作成・更新 API

DynamoDBの `PutItem` は、データが存在しなければ「作成」、存在すれば「上書き（更新）」となるため、作成と更新を1つのエンドポイント（Upsert）としてまとめるのがサーバーレス開発の王道です。

* **エンドポイント**: `PUT /tasks`
* **目的**: 新しい家事（例：「ゴミ出し 10pt」）を作成する、または既存の家事の設定（ポイント数や名前）を更新します。
* **リクエストボディ**: `TaskID` (新規の場合はフロントエンドでUUIDを発行)、`TaskName`、`Points`。
* **DynamoDB操作**: PutItem
    * PK: `FamilyID` を指定します。
    * SK: `TASK#{TaskID}` を指定します。
    * 実装のポイント: 家事設定のデータには TTL（自動削除）は設定せず、永久保存として書き込みます。

### 2.6. 家事設定（マスター）の削除 API

* **エンドポイント**: `DELETE /tasks/{TaskID}`
* **目的**: 不要になった家事の設定を削除します。
* **DynamoDB操作**: DeleteItem
    * PK: `FamilyID` を指定します。
    * SK: `TASK#{TaskID}` を指定します。

### 2.7. 家族作成API（オンボーディング）

最初の1人（招待されていないユーザー）が家族を新規作成するAPIです。

* **エンドポイント**: `POST /families`
* **目的**: 新しい家族グループを作成し、呼び出し元ユーザーをそのオーナーとして登録します。
* **JWT 要件**: 必須。ただし `custom:family_id` クレームは **存在しないこと**（既に家族所属の場合は 409 Conflict を返す）。
* **リクエストボディ**: `{ "displayName": "パパ" }`
* **レスポンス**: `{ "familyId": "fam_xxx" }`
* **処理**:
    1. JWT クレームから `CognitoSub` を取得。`custom:family_id` が既に存在する場合は 409 Conflict。
    2. UUID で新しい `FamilyID` を発行。
    3. `FamilyAppTable` に `USER` レコードを `PutItem`（PK=`FamilyID`, SK=`USER#{CognitoSub}`, `DisplayName`, `TotalPoints=0`）。条件 `attribute_not_exists(SK)`。
    4. Cognito `AdminUpdateUserAttributes` で `custom:family_id` をセット。
    5. フロントは JWT 強制リフレッシュ（`Auth.currentSession({ forceRefresh: true })`）して新しいクレームを取り込む。

### 2.8. 招待トークン発行API

既存ユーザーが家族メンバーを招待するためのトークンを発行します。

* **エンドポイント**: `POST /families/invites`
* **目的**: 共有可能な招待リンク（QR / URL）を生成。
* **JWT 要件**: 必須。`custom:family_id` クレームが **必要**。
* **リクエストボディ**: なし
* **レスポンス**: `{ "token": "...", "url": "https://iezi.app/invite?token=...", "expiresAt": 1737000000 }`
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
* **DynamoDB操作**: `TransactWriteItems`（**2テーブル横断**）
    * **処理A（招待を消費）**: `FamilyInviteTable`
        * `UpdateItem` で `UsedAt`, `UsedBy` をセット
        * 条件: `attribute_not_exists(UsedAt) OR UsedBy = :sub`（冪等リトライを許容しつつ別ユーザーの消費は拒否）
    * **処理B（ユーザー登録）**: `FamilyAppTable`
        * `PutItem` で PK=`FamilyID`, SK=`USER#{CognitoSub}`, `DisplayName`, `TotalPoints=0`
        * 条件: `attribute_not_exists(SK)`
* **トランザクション後処理**:
    * Cognito `AdminUpdateUserAttributes` で `custom:family_id` を更新
    * Cognito 更新が失敗した場合、クライアントは同じトークンで再試行可能（条件式が冪等性を担保）
    * フロントは JWT 強制リフレッシュして新クレームを取り込む

### 2.10. 実績の取り消し（削除）API ⚠️要注意

間違えて「完了」を押してしまった場合など、実績を削除するAPIです。単に履歴を消すだけでなく、加算されたポイントも同時にマイナス（減算）する必要があるため、トランザクション処理が必須になります。

* **エンドポイント**: `DELETE /tasks/execute`
* **目的**: 誤って完了した家事の履歴を削除し、日次サマリのポイントを減算して元に戻します。
* **リクエストボディ**: `TaskExecutionID` (消したい履歴のUUID)、`Timestamp` (履歴の時刻)、`Points` (減算するポイント数)。
* **DynamoDB操作**: TransactWriteItems (トランザクション書き込み)
    * **処理A（タスク履歴の削除）**:
        * PK: `FamilyID` を指定します。
        * SK: `HISTORY#{RFC3339Timestamp}#{CognitoSub}#{TaskExecutionID}` を指定し、`Delete` 処理を行います。
    * **処理B（日次サマリの減算）**:
        * PK: `FamilyID` を指定します。
        * SK: `DAILY#{YYYY-MM-DD}#{CognitoSub}` を指定します。
        * 重要な処理: `UpdateItem` の `ADD` 機能に**マイナスの値（例: -10）**を渡すことで、ポイントを安全に減算します。

---

### 💡 「実績の更新」についてのベストプラクティス

モダンなシステム設計（特にポイントやお金が絡む履歴データ）においては、**「一度記録された履歴ログ（HISTORY）は直接編集（Update）させない」**のが鉄則です。

もしバックエンドに「実績更新用のPUT API」を作ってしまうと、差分ポイントの再計算など複雑なロジックが必要になり、バグの温床になります。
そのため、フロントエンドの仕様として以下の2ステップで処理を行うフローを採用します。

1. **削除APIを呼ぶ**：まず `DELETE /tasks/execute` をコールし、誤って登録した履歴データの削除と、加算されていたポイントのマイナス（減算）を行います。
2. **完了APIを呼ぶ**：次に `POST /tasks/execute` をコールし、正しい家事の内容で履歴を再登録し、正しいポイントをプラス（加算）します。

この「取り消して、やり直す」仕様にすることで、APIもDynamoDBの処理も極めてシンプルかつ堅牢に保つことができます。
