# TODO

## 既知のフロントエンドバグ（いずれも機能停止には至らないUX系）

### 1. 家事マスターを編集すると一覧の先頭に移動してしまう

- **症状**: Settings 画面で N 番目の家事を編集して保存すると、その家事が一覧の先頭にジャンプする
- **原因**: `frontend/src/context.tsx` の `upsertTaskMaster` がオプティミスティック更新で常に `[task, ...filter(others)]` の形で先頭に挿入している。新規追加では妥当だが編集では位置を維持すべき
- **修正方針**: 既存 ID があれば同位置で置換、なければ先頭に挿入する分岐に変える

### 2. 編集フォームのエラーが新規追加フォーム側に表示される

- **症状**: Settings の編集フォームで保存が失敗すると、編集行ではなく上の「新しい家事を作る」セクション内にエラーメッセージが出る。編集中のユーザーには何も起きていないように見える
- **原因**: `frontend/src/pages/Settings.tsx` で `error` state を新規追加と編集で共有しつつ、`{error && ...}` の描画位置が新規追加フォーム内（129 行目）にしかない
- **修正方針**: 編集用のエラー state を分離するか、編集フォーム内にも表示箇所を追加する

### 3. 棒グラフ下の日付ラベルが UTC より西のタイムゾーンで1日ずれる（latent）

- **症状**: ホーム画面の週次棒グラフの下に出る日付（"17", "18", ...）が、UTC-X のタイムゾーンのブラウザでは1日前の数字になる
- **原因**: `frontend/src/pages/Home.tsx:48` の `new Date('2026-05-23').getDate()` が、`new Date(YYYY-MM-DD)` を UTC 真夜中として解釈→ `getDate()` がローカル日付を返す、というJSの仕様にハマっている
- **影響範囲**: JST(=UTC+9)ユーザーには発生しないため、想定ユーザー（日本の家族）には実害なし
- **修正方針**: `Number(date.slice(8, 10))` のように文字列から直接日付部分を取り出す

---

## 新機能: 家事実績の実績日（日付）変更

「やった日を昨日／一昨日に指定して登録」「履歴から実績日を後から修正」を可能にする。時間（時:分）の管理はせず、**日付単位**のみ扱う。

### 設計の確定事項

- **「削除して再登録」厳守**: HISTORY レコードの直接 Update は禁止（`docs/api_spec.md` の鉄則）。編集は `DELETE /tasks/execute` → `POST /tasks/execute`（新 `taskExecutionId`）の2段で行う
- **日付選択範囲**: 今日 〜 7日前（合計8日分）。DAILY サマリのTTL(90日)を絶対に超えないため、バックデート先の DAILY レコードが消えている事故を防げる
- **時刻の合成ルール**（フロントエンドで決定的に生成）:
  - 「今日」選択時: `new Date().toISOString()`（受信時刻そのまま）
  - 過去日選択時: `{YYYY-MM-DD}T12:00:00+09:00` を ISO 化した値（**JST正午固定**）
  - 理由: 時間入力を求めない以上、再現性のある決定的な値が必要。正午固定なら SK の lex 順序が安定し、`History.tsx` の `timeLabel` も `12:00` と表示されるだけで誤解されにくい
- **`taskExecutionId` の扱い**: 編集時の再登録では**新しい UUID** を発行する。理由: spec の「削除→再登録」の趣旨に合致し、delete の失敗→再試行時に旧 ID が復活する事故も防げる
- **アトミック性**: delete → create の順で実行。create 失敗時は `refreshAllData()` で実状態を再取得し、エラー文言を出す（完全なアトミック性は元仕様どおり諦める）
- **`HISTORY.ExpiresAt`**: 「現在から1年」のまま（最大7日のバックデート程度なら影響無視可）

### 実装順序

#### バックエンド

- [ ] **`shared/src/index.ts`**: `TaskHistoryCreateRequestSchema` に `timestamp: z.string().datetime().optional()` を追加
- [ ] **`backend/src/handlers/taskExecute.ts`**: `req.body.timestamp` を受け取り、未指定なら `new Date()`、指定時は `new Date(timestamp)` を採用。バリデーション:
  - 未来日（`> now`）→ `AppError(400, '未来日は指定できません')`
  - 8日以上前（`< now - 7d`）→ `AppError(400, '7日より前の日付は指定できません')`
  - `getJSTDateString(eventDate)` で DAILY 日付を導出する点は変更なし
- [ ] **`backend/src/__tests__/handlers/taskExecute.test.ts`**: ケース追加
  - `timestamp` 指定時にその値で HISTORY SK / DAILY SK が組み立てられる
  - 未来日リクエスト → 400
  - 8日以上前リクエスト → 400
  - `timestamp` 省略時は従来通り `now` を使う（既存テストの維持）
- [ ] **`docs/api_spec.md` §2.2**: `timestamp` (optional, RFC3339) を追記。範囲制約と用途（バックデート登録 / 編集時の再登録）も明記

#### フロントエンド

- [ ] **`frontend/src/lib/time.ts`** 新規作成: 以下を提供
  - `getJstDateKey(date?: Date): string` — JST の `YYYY-MM-DD`（既存 `History.tsx` / `Home.tsx` 内の `Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' })` を集約）
  - `dateKeyToTimestamp(dateKey: string): string` — 今日なら `new Date().toISOString()`、それ以外は `{dateKey}T12:00:00+09:00` を `new Date(...).toISOString()` で UTC ISO に正規化
  - `getRecentDateKeys(daysBack: number = 7): string[]` — 今日から N 日前までの JST 日付配列（新しい順）
- [ ] **`frontend/src/components/DateChipSheet.tsx`** 新規作成
  - props: `value: string`（現在の dateKey）, `onSelect(dateKey: string): void`, `onClose(): void`
  - 「今日／昨日／2日前／…／6日前」の 8 個のチップを縦並びで表示するボトムシート
  - 既存の `flatBorder` / `bounceClass` / `springStyle` を流用して既存のデザインに統一
  - 各チップは「ラベル + 曜日 (M/D 火)」も併記
- [ ] **`frontend/src/context.tsx`**: API の拡張
  - `createTaskHistory(task: TaskMaster, opts?: { timestamp?: string })` に変更し、`timestamp` がある場合は `apiPost('/tasks/execute', { taskId, taskExecutionId, timestamp })` で送信
  - 新メソッド `updateTaskHistoryDate(item: TaskHistory, newDateKey: string): Promise<void>` を追加
    - 内部で `dateKeyToTimestamp(newDateKey)` → `apiDelete('/tasks/execute', {...旧})` → `apiPost('/tasks/execute', { taskId, taskExecutionId: crypto.randomUUID(), timestamp })` の順に実行
    - `processingId` でロック、終了で必ず `refreshAllData()`
    - エラー時は `refreshAllData()` 後に throw（呼び出し側でエラー表示）
  - `AppContextType` の型定義も更新
- [ ] **`frontend/src/pages/Home.tsx`**: 登録時の日付選択
  - state `selectedDateKey` を追加（初期値: 今日の JST 日付）
  - カテゴリ詳細画面のヘッダー（戻るボタン + 「{カテゴリ名}の家事」の行）に「📅 {ラベル} ▼」バッジボタンを追加
  - バッジ押下で `DateChipSheet` を開く
  - 各カードの「やった！」が `createTaskHistory(task, { timestamp: dateKeyToTimestamp(selectedDateKey) })` を呼ぶ
  - 今日選択時は `timestamp` を渡さず従来挙動（バックエンドに今日判定を任せない）
  - カテゴリ選択前の上段（カテゴリ一覧）ではバッジを出さない
- [ ] **`frontend/src/pages/History.tsx`**: 編集ボタン追加
  - 自分の実績カードの「取り消し」の左に「📅 日付変更」ボタンを追加（既存スタイル `bg-blue-50` / `border-blue-200` あたりで色分け）
  - 押下で `DateChipSheet` を開く（初期値 = `toJstDateKey(item.timestamp)`）
  - 日付確定時に `updateTaskHistoryDate(item, newDateKey)` を呼ぶ
  - エラー時は既存の `cancelError` と同じパターンで上部に表示（state 名は `editError` にリネームか共通化）
  - 内部で使ってる `toJstDateKey` / `formatDateLabel` は `lib/time.ts` に統合してもよい（任意）
- [ ] **`frontend/src/__tests__/Home.test.tsx`**: ケース追加
  - 日付バッジから昨日を選択 →「やった！」で `apiPost('/tasks/execute', ...)` の body に `timestamp` が含まれることを検証
  - 今日選択時は `timestamp` を送らないことを検証
- [ ] **`frontend/src/__tests__/History.test.tsx`**: ケース追加
  - 自分の実績で「日付変更」→ 昨日を選択 → `apiDelete('/tasks/execute', ...)` → `apiPost('/tasks/execute', ...)` の順で呼ばれ、`apiPost` の `taskExecutionId` が元と**異なる新UUID**で、`timestamp` も新日付であることを検証
  - 他人の実績には「日付変更」ボタンが出ないことを検証

### 受け入れ条件（最終確認用）

- ホーム画面で「📅 昨日」を選んでお風呂掃除を完了 → 履歴で**昨日のグループ**に表示され、累積ポイントと**昨日の**日次サマリに加算されている
- 履歴で月曜の実績を「日付変更」→ 日曜にすると、月曜の DAILY が減算され、日曜の DAILY が加算され、累積ポイントは変わらない
- 8日以上前を選ぼうとしても UI 上選択肢に出ない（バックエンドでも 400 で防御）
- 未来日のリクエストはバックエンドが 400 を返す（フロントは UI 上から発生し得ない）
- 連打・通信エラーリトライで二重加算が発生しない（既存の冪等性が維持されている）
