# DynamoDB テーブル仕様書 (ieziプロジェクト)

## 0. テーブル一覧

本プロジェクトでは以下の **2つのテーブル** を使用します。

| テーブル名 | 用途 | キャパシティ |
|---|---|---|
| `iezi-{env}-FamilyAppTable` | 家族データ（ユーザー、家事、日次サマリ、家事実績）のシングルテーブル | オンデマンド |
| `iezi-{env}-FamilyInviteTable` | 招待トークン専用テーブル（家族未所属の状態でトークンから引く必要があるため別テーブル化） | オンデマンド |

招待データだけテーブルを分けるのは、招待は「`FamilyID` を持たない状態でトークン単独から引く」という性質を持ち、`FamilyID` を PK とする `FamilyAppTable` の設計思想と噛み合わないためです。オンデマンド課金のため、テーブル数の増加によるコスト増はありません（無料枠の範囲内）。

---

## 1. `FamilyAppTable` 基本設計 (シングルテーブルデザイン)
本プロジェクトでは、AWSのコストを極限まで抑えつつ、柔軟なアクセスパターンを実現するために「シングルテーブルデザイン」を採用します。家族スコープのエンティティ（ユーザー、家事、日次サマリ、家事実績）を1つのテーブルに格納します。

> 📖 **用語**: 本ドキュメントでは「家事 = 家事マスター（種類定義）」「家事実績 = 実際にやった記録」を使い分けます。詳細は `CLAUDE.md` のドメイン用語表を参照。

- **テーブル名**: `iezi-{env}-FamilyAppTable`（例: `iezi-prod-FamilyAppTable`）
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
  - `Icon` (String, optional): ユーザーアイコン（絵文字1文字、最大8バイト）。属性が存在しない既存レコードは未設定として扱う。
  - `TotalPoints` (Number): 家事ポイントの累積合計（★トランザクションで同期加算）
  - `NeguraiPoints` (Number): ねぎらいポイントの累積合計（★トランザクションで同期加算）。属性が存在しない既存レコードは 0 相当として扱う。

### ② 家事 (`TASK`)
家族で定義した「家事の種類・獲得ポイント・カテゴリ」の設定データ（家事マスター）です。
- **SK形式**: `TASK#{TaskID}` (※`TaskID` はフロントで発行した UUID)
- **主要属性**:
  - `TaskName` (String): 家事名（例：「お風呂掃除」）
  - `Points` (Number): 獲得ポイント（例：10）
  - `Category` (String, optional): 家事カテゴリのID（例：`"water"`）。フロントエンドの `CATEGORIES` 定数（`cooking` / `cleaning` / `laundry` / `water` / `shopping` / `other`）が単一の正と見なし、バックエンドは値を検証せず文字列として保存する。属性が存在しない既存レコードは `'other'` 相当として扱う。

### ③ 日次サマリ (`DAILY`)
「今日誰が何ポイント稼いだか」を即座に表示するためのホットデータです。
- **SK形式**: `DAILY#{YYYY-MM-DD}#{CognitoSub}`
- **主要属性**:
  - `DailyPoints` (Number): その日の獲得ポイント合計（★トランザクションで同期加算）
- **備考**: 日付の境界を厳密にするため、Lambda（TypeScript）側で必ず `Asia/Tokyo` タイムゾーンで生成します。週次・月次のサマリは現状のUI要件にないためYAGNIの原則に従い作成しません。

### ④ 家事実績 (`HISTORY`)
「誰が・いつ・何の家事をしたか」の明細ログ（コールドデータ）です。家事実績の直接編集は禁止 — 「削除して再登録」の2ステップで扱います（API 仕様書 §2.10 参照）。
- **SK形式**: `HISTORY#{RFC3339Timestamp}#{CognitoSub}#{TaskExecutionID}`
  - ※ `TaskExecutionID` は冪等性担保のためフロントエンドで発行した UUID（= 家事実績ID）。
- **主要属性**:
  - `TaskID` (String): 実行した家事のID
  - `Points` (Number): 獲得したポイント（当時のポイントスナップショット）
  - `ExpiresAt` (Number): TTL用UNIXタイムスタンプ（例：1年後）

### ⑤ ねぎらい (`NEGURAI`)
「誰が・誰に・何をしてもらったか」を記録するログです。家事以外の行為（贈り物、食事、マッサージ等）で相手への感謝を表明した記録で、**ねぎらった側**がポイントを獲得します。記録するのは**ねぎらわれた側**（受け取った人）です。
- **SK形式**: `NEGURAI#{RFC3339Timestamp}#{NeguraiID}`
  - `RFC3339Timestamp`: サーバー受信時刻（バックデート不可）。
  - `NeguraiID`: 冪等性担保のためフロントエンドで発行した UUID。
- **主要属性**:
  - `GiverSub` (String): ねぎらった側の CognitoSub（ポイント獲得者）
  - `ReceiverSub` (String): ねぎらわれた側の CognitoSub（記録者）
  - `Description` (String): 自由テキスト（何をしてもらったか）
  - `Points` (Number): 付与ポイント数
  - `ExpiresAt` (Number): TTL用UNIXタイムスタンプ（1年後）

---

## 3. アクセスパターンとコアロジック

本アプリの最重要機能である「ポイント加算・減算」は、DynamoDB Streamsによる非同期処理ではなく、**`TransactWriteItems` を用いた同期処理（トランザクション）**で実装し、UX（即時反映）とデータ整合性を両立します。

### A. アプリ起動時のデータ一括取得 (`GET /family/init`)
- **操作**: `Query`
- **条件**: `PK = FamilyID`
- **目的**: 家族の `USER`（累積ポイント含む）と `TASK`（家事マスター）を爆速で一括取得します。

### B. 家事の完了（ポイント加算） (`POST /tasks/execute`)
ボタン連打によるポイント増殖を防ぎつつ、3つのデータを同時に更新します。
- **操作**: `TransactWriteItems` (以下の3つを完全同時に処理)
  1. `PutItem`: `HISTORY#...` の作成
     - ※条件付き書き込み `attribute_not_exists(DataSortKey)` を指定し、同一ExecutionIDの重複（二重加算）を絶対にはじく。
  2. `UpdateItem`: `DAILY#...` の更新 (`ADD DailyPoints :points`)
  3. `UpdateItem`: `USER#...` の更新 (`ADD TotalPoints :points`)

### C. 家事実績の取り消し（ポイント減算） (`DELETE /tasks/execute`)
誤って記録した家事実績を取り消す際も、トランザクションで完全にロールバックします（家事実績の直接編集は禁止）。
- **操作**: `TransactWriteItems` (以下の3つを完全同時に処理)
  1. `DeleteItem`: `HISTORY#...` の削除
  2. `UpdateItem`: `DAILY#...` の更新 (`ADD DailyPoints :-points` ※マイナス値を渡して減算)
  3. `UpdateItem`: `USER#...` の更新 (`ADD TotalPoints :-points` ※マイナス値を渡して減算)

### D. ねぎらいの記録（ねぎらいポイント加算） (`POST /negurai`)
記録者（ねぎらわれた側）がねぎらった側のポイントを加算します。ポイントは家事ポイントと分離して `NeguraiPoints` に加算します。
- **操作**: `TransactWriteItems` (以下の2つを完全同時に処理)
  1. `PutItem`: `NEGURAI#...` の作成 (`attribute_not_exists(DataSortKey)` 条件で冪等性を担保)
  2. `UpdateItem`: `USER#{GiverSub}` の更新 (`ADD NeguraiPoints :points`)

### E. ねぎらいの取り消し（ねぎらいポイント減算） (`DELETE /negurai`)
- **操作**: `TransactWriteItems` (以下の2つを完全同時に処理)
  1. `DeleteItem`: `NEGURAI#...` の削除 (`attribute_exists(DataSortKey) AND ReceiverSub = :receiverSub` 条件 — 存在チェック兼・記録者本人のみ削除可能)
  2. `UpdateItem`: `USER#{GiverSub}` の更新 (`ADD NeguraiPoints :-points` ※マイナス値を渡して減算)

---

## 4. インフラ・運用要件

- **TTL (Time to Live) の有効化**
  - テーブルの `ExpiresAt` 属性をTTL属性として有効化します。
  - これにより、`HISTORY` レコードは指定期間（例：1年）経過後にAWSのバックグラウンド処理により**自動かつ無料**で削除され、特定パーティションの肥大化（ホットパーティション）を永続的に防ぎます。
- **LSI / GSI**
  - 現在のアクセスパターンではソートキーの前方一致（begins_with）で十分に要件を満たせるため、コストと容量制限(10GBルール)の懸念となる LSI/GSI は利用しません。

---

## 5. `FamilyInviteTable` 招待専用テーブル

家族メンバー招待のための短命トークンを管理する、独立したテーブルです。

- **テーブル名**: `iezi-{env}-FamilyInviteTable`（例: `iezi-prod-FamilyInviteTable`）
- **キャパシティモード**: オンデマンド (On-Demand)
- **パーティションキー (PK)**: `Token` (String) — UUIDv4
- **ソートキー**: なし（単一PK構成）
- **TTL属性**: `ExpiresAt`

### 属性

| 属性 | 型 | 説明 |
|---|---|---|
| `Token` (PK) | String | UUIDv4。招待URLに含まれるトークン |
| `FamilyID` | String | 招待元の家族ID |
| `ExpiresAt` | Number | TTL用UNIXタイムスタンプ（発行から24時間後） |
| `UsedAt` | Number? | 消費時刻のUNIXタイムスタンプ。未消費なら属性自体が存在しない |
| `UsedBy` | String? | 消費したユーザーの CognitoSub。冪等リトライ判定に使用 |

### アクセスパターン

#### A. 招待発行 (`POST /families/invites`)
- **操作**: `PutItem`
- **キー**: `Token = {新規UUID}`
- **属性**: `FamilyID`, `ExpiresAt = now + 86400`

#### B. 招待消費 (`POST /families/join`)
- **操作**: `TransactWriteItems`（`FamilyAppTable` と横断）
- **キー**: `Token = {リクエストボディから取得}`
- **更新**: `SET UsedAt = :now, UsedBy = :sub`
- **条件**: `attribute_not_exists(UsedAt) OR UsedBy = :sub`
  - 未消費なら通る
  - 既に同じユーザーが消費済みなら冪等リトライとして通る
  - 別ユーザーが消費済みなら失敗（409 Conflict）

### 設計上の判断（MVP）

以下は将来追加可能なため MVP では落とします:
- **招待プレビュー** (`GET /invites/{token}`): サインアップ前に招待者名を表示する用途。 MVP では Welcome 画面を静的に。
- **招待取消** (`DELETE /families/invites/{token}`): TTL（24h）で自然消滅するため不要。
- **招待一覧**: 都度発行運用のため不要。
- **`InviterName` / `InvitedBy` 属性**: プレビュー無し・監査ログ不要のため省略。

これらは後から属性追加・エンドポイント追加のみで実装可能で、既存データへの破壊的変更は不要です。
