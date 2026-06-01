# 月別カレンダー画面 実装プラン

## 1. 機能概要

家族メンバーが「いつ家事をしたか」を月単位で俯瞰できるカレンダー画面を新規追加する。

- 画面イメージ:
  - 月のカレンダーをグリッド表示（日〜土 × 5〜6 行）
  - 各セル（= 1日）に、その日に家事実績（`DAILY` レコード）があったメンバーの **ユーザーカラーの小さなバッジ** を並べる
  - 2 人とも家事をしている日は、バッジが 2 つ並ぶ（メンバー数が増えても自然に並ぶ）
  - 月送り（前月／次月）ボタン付き
- ボトムナビから遷移可能にする
- ルート: `/calendar`

## 2. UI 仕様

### 2.1 画面構成

```
┌─────────────────────────────┐
│  ← 2026年6月 →             │  ヘッダー（月送り）
├─────────────────────────────┤
│ 日 月 火 水 木 金 土          │
│                              │
│  1  2  3  4  5  6  7         │
│ ●  ●●          ●            │  バッジは色付きの小円
│                              │
│  8  9 10 11 12 13 14         │
│ ●●  ●  ●●  ●●  ●●            │
│ ...                          │
└─────────────────────────────┘
```

- バッジは「カラーで塗った直径 8〜10px の円」をセル下部に横並びで表示
- メンバー順は `context.tsx` の `members` 配列順（= 表示順を固定）で並べる
- 今日は背景色を薄く強調（例: `bg-amber-100`）
- 当月外の日付（先月末／翌月頭の補完セル）はグレーアウト
- 6 週入る月（例: 2026/05）は 6 行、それ以外は 5 行になるので、`grid-rows-[auto]` で動的に組む
- バッジが多すぎてもセルからはみ出さないよう、最大 4 個まで表示してそれ以上は `+N` テキストで折りたたむ（将来 5 人以上対応）

### 2.2 セルをタップしたときの挙動

**何もしない**（純粋なビジュアル俯瞰画面）。セルは `<div>` でレンダリングし、`onClick` も `role="button"` も付与しない。

### 2.3 ボトムナビへの追加

現在のナビ 5 項目（ホーム／メモ／履歴／ねぎらい／設定）の「履歴」と「ねぎらい」の間にカレンダーを差し込み、**6 項目** で並べる。`NavButton` はアイコンのみで横並びにしているので 6 個でも収まる想定（375px 端末で 1 ボタン ≒ 62px）。

アイコン: `lucide-react` の `CalendarDays` を採用（`Calendar` は Home / History で使用中なので別バリアントで区別）。

## 3. データソース設計

### 3.1 既存リソースで足りるか

- フロント `AppProvider` には現状 `weeklySummaries`（14 日分）しかない → **月単位の DAILY サマリは未取得**。
- バックエンドの `getWeeklySummaries(familyId, from, to)` は実装上は任意の範囲を取れる汎用 Range Query。
- API としては `GET /summary/weekly?endDate=...` という名前で 14 日固定になっている（`summaryWeekly.ts` の `WINDOW_DAYS = 14`）。

→ **月分のサマリ取得 API を新設するのが綺麗**。バックエンドの repository は既に範囲取得をサポートしているので、ハンドラだけ追加すれば OK。

### 3.2 新規 API: `GET /summary/monthly`

| 項目 | 内容 |
|---|---|
| Method / Path | `GET /summary/monthly` |
| 認証 | 既存と同じ Cognito JWT。`custom:family_id` 必須 |
| クエリパラメータ | `month` (optional, `YYYY-MM`)。省略時は `Asia/Tokyo` の今月 |
| レスポンス | `{ "month": "2026-06", "from": "2026-06-01", "to": "2026-06-30", "summaries": [DailySummary[]] }` |
| エラー | `400` `month` の形式不正（`YYYY-MM` 以外） |
| DynamoDB | `Query` PK=`FamilyID`, SK `BETWEEN 'DAILY#{from}' AND 'DAILY#{to}~'`（`getWeeklySummaries` と同じパターン） |

実装ノート:

- `from` = `YYYY-MM-01`、`to` = JST 基準でその月の末日（28〜31）。月末日数計算は `new Date(Date.UTC(y, m, 0)).getUTCDate()` で素直に求める。
- 既存の `getWeeklySummaries` を呼び出すだけで済む（メソッドは既に汎用範囲取得）。リポジトリ層への新規メソッドは不要。
- ハンドラは `handlers/summaryMonthly.ts` として新規作成。
- ルーターに `if (seg1 === 'monthly') return summaryMonthlyHandler(...)` を追加（`router.ts:50` 付近）。

### 3.3 共有スキーマ追加（`shared/src/index.ts`）

```ts
export const SummaryMonthlyResponseSchema = z.object({
  month: z.string(),
  from: z.string(),
  to: z.string(),
  summaries: z.array(DailySummarySchema),
});
export type SummaryMonthlyResponse = z.infer<typeof SummaryMonthlyResponseSchema>;
```

### 3.4 API ドキュメント更新

`docs/api_spec.md` に `2.4` 直後で `2.4.1 月次サマリ取得API`（または `2.4` を「期間サマリ」に再編成）を追加。

## 4. フロントエンド実装方針

### 4.1 ファイル構成

```
frontend/src/
├── pages/
│   └── Calendar.tsx              ← 新規（メインのカレンダー画面）
├── components/
│   ├── MonthGrid.tsx             ← 新規（カレンダーグリッドを純粋関数的に表示）
│   └── DayCell.tsx               ← 新規（1 日のセル。バッジ表示）
├── lib/
│   └── calendar.ts               ← 新規（カレンダー用日付ユーティリティ）
└── main.tsx                      ← `/calendar` ルートを追加
└── components/Layout.tsx         ← ボトムナビに項目追加
```

### 4.2 `context.tsx` の変更

月次サマリの取得関数 `fetchMonthlySummaries(month)` を `AppContext` に追加する。

- **キャッシュ戦略**: `monthlySummaries: Record<string, DailySummary[]>` を state で持ち、月キーで参照。月切替時に未取得ならフェッチ、取得済みなら即表示。
- 家事実績の登録／取り消し／日付変更で `refreshAllData()` を呼んでいる箇所は、`monthlySummaries` のキャッシュもクリア（または該当月だけ再フェッチ）する必要あり。簡単のため初版は **`refreshAllData` で `monthlySummaries` を `{}` に空にして lazy 再取得** とする。

シグネチャ例:

```ts
fetchMonthlySummaries: (monthKey: string) => Promise<void>
monthlySummaries: Record<string, DailySummary[]>  // key = "YYYY-MM"
```

### 4.3 `lib/calendar.ts`

純粋関数を集約:

```ts
// JST 基準で「カレンダーグリッドに並べる 35 or 42 日分」の dateKey 配列を返す
// 月の初日を含む週の日曜から、月末を含む週の土曜まで
function buildMonthGrid(monthKey: string): string[]

// "YYYY-MM" の前月・次月を返す
function prevMonth(monthKey: string): string
function nextMonth(monthKey: string): string

// "YYYY-MM-DD" が "YYYY-MM" に属するか
function isInMonth(dateKey: string, monthKey: string): boolean
```

ロジックは UTC 正午基準で計算（`summaryWeekly.ts` の `subtractDaysJST` と同じパターン）して DST 影響を排除。

### 4.4 `Calendar.tsx`（ページ本体）

責務:

1. `useState` で「表示中の月キー」を保持（初期値: JST の今月）
2. `useEffect` で `fetchMonthlySummaries(monthKey)` を呼ぶ
3. ヘッダーに月送りボタン（`ChevronLeft` / `ChevronRight`）と「YYYY年M月」表示
4. `MonthGrid` に `monthKey` と `summaries`（その月分）を渡す
5. **遡及範囲は今月と先月の 2 ヶ月のみ**。
   - 未来月 → 「次月」ボタンを `disabled`
   - 先月より前 → 「前月」ボタンを `disabled`
   - TTL（DAILY = 90 日）はこの範囲内なら必ず生きているので、ユーザーへの注意書きは不要

### 4.5 `MonthGrid.tsx`

`grid grid-cols-7 gap-1` で 7 列のグリッドを描く。

- 入力: `monthKey`, `summaries: DailySummary[]`, `members: User[]`
- 各セルへ渡すバッジは `summaries` を `dateKey` → `cognitoSub[]` のマップに前処理
- 列ヘッダー（日〜土）も同じグリッドの 1 行目として表示
- 当月外のセルは `opacity-40`

### 4.6 `DayCell.tsx`

- 入力: `dateKey`, `dayNumber`, `isCurrentMonth`, `isToday`, `memberSubsWithActivity: string[]`, `members: User[]`
- 表示: 上部に日数字、下部にバッジ列
- バッジ: `<span className={`w-2 h-2 rounded-full ${member.color} border border-stone-800`} />`（既存の `member.color` は `bg-brand-*` 系のクラス名なので流用可能）
- バッジが 5 個以上のときの折りたたみ:
  - `members.length <= 4` のうちは折りたたみ発火しないが、念のため `>4` で `+N` テキスト表示

### 4.7 ルーティングとナビ

`main.tsx`:
```diff
+ import Calendar from './pages/Calendar'
  ...
  children: [
    { index: true, element: <Home /> },
    { path: 'memo', element: <Memo /> },
+   { path: 'calendar', element: <Calendar /> },
    { path: 'history', element: <History /> },
    { path: 'negurai', element: <Negurai /> },
    { path: 'settings', element: <Settings /> },
  ],
```

`Layout.tsx`:
- `activeTab` 判定に `calendar` を追加
- ボトムナビに `<NavButton icon={CalendarDays} label="カレンダー" ... />` を「履歴」と「ねぎらい」の間に挿入

## 5. テスト方針

### 5.1 バックエンド（Vitest）

`backend/src/__tests__/handlers/summaryMonthly.test.ts` を新規追加:

- `month` 省略時は JST の今月を返す
- `month=2026-02` のときは閏年判定で `to=2026-02-28`、`month=2024-02` のときは `2024-02-29`
- `month` の形式不正（`2026-13`, `abc`, `2026-6`）は 400
- `summaries` がリポジトリ返却値そのまま透過することを確認（モック差し替え）

### 5.2 フロントエンド（Vitest + Testing Library）

`frontend/src/__tests__/Calendar.test.tsx`:

- 月初／月末／週またぎの境界が正しく描画されることを確認（35 セル or 42 セル）
- ある日の `summaries` に 2 メンバーぶん入っているとき、2 つのバッジが描画される
- 月送りボタンで `fetchMonthlySummaries` が呼ばれる
- 未来月ボタンが disabled になる

`frontend/src/__tests__/lib/calendar.test.ts`:

- `buildMonthGrid('2026-06')` の長さと両端
- `prevMonth('2026-01')` = `'2025-12'`, `nextMonth('2026-12')` = `'2027-01'`

## 6. 段階的なリリース手順

1. **共有スキーマ**: `shared/src/index.ts` に `SummaryMonthlyResponseSchema` を追加 → `npm run build -w shared`
2. **バックエンド**: `handlers/summaryMonthly.ts` 追加 → `router.ts` 更新 → `__tests__` 追加 → `npm run build -w backend`
3. **API ドキュメント**: `docs/api_spec.md` に 2.4.1 を追記
4. **フロントエンド**:
   - `lib/calendar.ts` + 単体テスト
   - `context.tsx` に `monthlySummaries` / `fetchMonthlySummaries` 追加
   - `components/DayCell.tsx`, `components/MonthGrid.tsx`
   - `pages/Calendar.tsx`
   - `components/Layout.tsx` のナビ追加、`main.tsx` のルート追加
   - 画面テスト
5. **手動 QA**:
   - 月送り（今月→前月→2 ヶ月前 → 戻る）
   - 家事完了直後にカレンダーへ移動するとバッジが反映される
   - 履歴の日付変更（`updateTaskHistoryDate`）後にバッジが移動する
   - メンバーが 1 人だけの家族で表示崩れがない
6. **Terraform**: 既存 Lambda 1 本に統合されたままなので、`infra/` に変更不要。

## 7. 決定事項

1. **タップ時の挙動**: 何もしない（純粋なビジュアル俯瞰）
2. **ボトムナビ**: 6 項目（履歴とねぎらいの間に挿入）
3. **遡及範囲**: 今月＋先月の 2 ヶ月のみ。TTL 注意書きは不要
4. **ねぎらい／累計ポイントのセル併載**: なし

## 8. 影響範囲まとめ

| ファイル | 変更内容 |
|---|---|
| `shared/src/index.ts` | スキーマ追加 |
| `backend/src/handlers/summaryMonthly.ts` | 新規 |
| `backend/src/router.ts` | ルート追加 |
| `backend/src/__tests__/handlers/summaryMonthly.test.ts` | 新規 |
| `docs/api_spec.md` | エンドポイント仕様追記 |
| `frontend/src/lib/calendar.ts` | 新規 |
| `frontend/src/context.tsx` | 月次サマリのキャッシュ・取得関数追加 |
| `frontend/src/components/DayCell.tsx` | 新規 |
| `frontend/src/components/MonthGrid.tsx` | 新規 |
| `frontend/src/pages/Calendar.tsx` | 新規 |
| `frontend/src/components/Layout.tsx` | ボトムナビに項目追加 |
| `frontend/src/main.tsx` | `/calendar` ルート追加 |
| `frontend/src/__tests__/Calendar.test.tsx` 他 | 新規 |
| `infra/` | 変更なし |
