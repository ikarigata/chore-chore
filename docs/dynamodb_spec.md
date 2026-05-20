# DynamoDB テーブル仕様書 (ieziプロジェクト)

## 1. 基本設計 (シングルテーブルデザイン)
本プロジェクトでは、AWSのコストを極限まで抑えつつ、柔軟なアクセスパターンを実現するために「シングルテーブルデザイン」を採用します。すべてのエンティティ（ユーザー、家事設定、サマリ、履歴）を1つのテーブルに格納します。

- **テーブル名**: `FamilyAppTable`
- **キャパシティモード**: オンデマンド (On-Demand)
- **パーティションキー (PK)**: `FamilyID` (String)
  - 家族単位でデータを同じ物理パーティションにまとめ、一括取得のパフォーマンスを最大化します。
- **ソートキー (SK)**: `DataSortKey` (String)
  - プレフィックス（接頭辞）と `#`（ハッシュ）区切りを活用し、1つのテーブル内で異なる種類のデータを安全かつ効率的に同居・検索させます。

---

## 2. データモデル（エンティティ別プレフィックス設計）

### ① ユーザー情報・総累積ポイント (`USER`)
ユーザーの基本情報と、これまでの「全期間の累計ポイント」を保持します。
- **SK形式**: `USER#{CognitoSub}`
- **主要属性**:
  - `DisplayName` (String): ユーザーの表示名
  - `TotalPoints` (Number): これまでの獲得総ポイント（★トランザクションで同期加算）

### ② 家事マスター設定 (`TASK`)
家族で定義した「家事の種類と獲得ポイント」の設定データです。
- **SK形式**: `TASK#{TaskID}` (※TaskIDはフロントで発行したUUID)
- **主要属性**:
  - `TaskName` (String): 家事名（例：「お風呂掃除」）
  - `Points` (Number): 獲得ポイント（例：10）

### ③ 日次サマリ (`DAILY`)
「今日誰が何ポイント稼いだか」を即座に表示するためのホットデータです。
- **SK形式**: `DAILY#{YYYY-MM-DD}#{CognitoSub}`
- **主要属性**:
  - `DailyPoints` (Number): その日の獲得ポイント合計（★トランザクションで同期加算）
- **備考**: 日付の境界を厳密にするため、Lambda（TypeScript）側で必ず `Asia/Tokyo` タイムゾーンで生成します。週次・月次のサマリは現状のUI要件にないためYAGNIの原則に従い作成しません。

### ④ タスク履歴 (`HISTORY`)
「誰が・いつ・何の家事をしたか」の明細（コールドデータ）です。
- **SK形式**: `HISTORY#{RFC3339Timestamp}#{CognitoSub}#{TaskExecutionID}`
  - ※ `TaskExecutionID` は冪等性担保のためフロントエンドで発行したUUID。
- **主要属性**:
  - `TaskID` (String): 実行した家事のID
  - `Points` (Number): 獲得したポイント（当時のポイントスナップショット）
  - `ExpiresAt` (Number): TTL用UNIXタイムスタンプ（例：1年後）

---

## 3. アクセスパターンとコアロジック

本アプリの最重要機能である「ポイント加算・減算」は、DynamoDB Streamsによる非同期処理ではなく、**`TransactWriteItems` を用いた同期処理（トランザクション）**で実装し、UX（即時反映）とデータ整合性を両立します。

### A. アプリ起動時のデータ一括取得 (`GET /family/init`)
- **操作**: `Query`
- **条件**: `PK = FamilyID`
- **目的**: 家族の `USER`（累積ポイント含む）と `TASK`（家事設定）を爆速で一括取得します。

### B. 家事の完了（ポイント加算） (`POST /tasks/execute`)
ボタン連打によるポイント増殖を防ぎつつ、3つのデータを同時に更新します。
- **操作**: `TransactWriteItems` (以下の3つを完全同時に処理)
  1. `PutItem`: `HISTORY#...` の作成
     - ※条件付き書き込み `attribute_not_exists(DataSortKey)` を指定し、同一ExecutionIDの重複（二重加算）を絶対にはじく。
  2. `UpdateItem`: `DAILY#...` の更新 (`ADD DailyPoints :points`)
  3. `UpdateItem`: `USER#...` の更新 (`ADD TotalPoints :points`)

### C. 実績の取り消し（ポイント減算） (`DELETE /tasks/execute`)
誤って完了したタスクを取り消す際も、トランザクションで完全にロールバックします（履歴の直接編集は禁止）。
- **操作**: `TransactWriteItems` (以下の3つを完全同時に処理)
  1. `DeleteItem`: `HISTORY#...` の削除
  2. `UpdateItem`: `DAILY#...` の更新 (`ADD DailyPoints :-points` ※マイナス値を渡して減算)
  3. `UpdateItem`: `USER#...` の更新 (`ADD TotalPoints :-points` ※マイナス値を渡して減算)

---

## 4. インフラ・運用要件

- **TTL (Time to Live) の有効化**
  - テーブルの `ExpiresAt` 属性をTTL属性として有効化します。
  - これにより、`HISTORY` レコードは指定期間（例：1年）経過後にAWSのバックグラウンド処理により**自動かつ無料**で削除され、特定パーティションの肥大化（ホットパーティション）を永続的に防ぎます。
- **LSI / GSI**
  - 現在のアクセスパターンではソートキーの前方一致（begins_with）で十分に要件を満たせるため、コストと容量制限(10GBルール)の懸念となる LSI/GSI は利用しません。
