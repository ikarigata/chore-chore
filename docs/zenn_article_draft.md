# 家族で家事ポイントを共有するPWAを、AWSフルサーバーレスで0円運用する

## はじめに

「家事の不公平感」は、共同生活における永遠のテーマです。誰がどれだけ家事をしているか可視化し、お互いの努力を認め合う仕組みを作れないか——そんな動機から生まれたのが **iezi**（いえじ）です。

家族間で家事とポイントを共有・記録するスマホ向けPWAで、**AWS無料枠を最大限に活用し、2名利用なら月額ほぼ0円で運用できる**完全サーバーレス構成で作りました。

この記事では、設計・実装で工夫した技術的なポイントをアーキテクチャ全体から振り返ります。

---

## アプリの概要

### 主な機能

| 機能 | 説明 |
|---|---|
| **家事の記録** | カテゴリ（料理・掃除・洗濯など）から家事を選んで「やった！」ボタンをタップ |
| **ポイント管理** | 日次・累積ポイントをリアルタイム集計。週次棒グラフで推移を可視化 |
| **バックデート登録** | 最大7日前まで遡って家事を登録可能（実績日の変更にも対応） |
| **ねぎらい機能** | 家事以外の行為（プレゼント・マッサージ等）を「ねぎらい」として記録し、ねぎらった側にポイントを付与 |
| **家族招待** | QRコード/URLで招待リンクを共有してパートナーを招待 |
| **PWA対応** | ホーム画面に追加でネイティブアプリのような体験を提供 |

---

## システムアーキテクチャ

### 全体構成図

```
[スマートフォン / ブラウザ]
         │ HTTPS
         ▼
[Amazon CloudFront]
  ├─(OAC)─▶ [Amazon S3]           ← React SPAの静的アセット配信
  └─(JWT)─▶ [API Gateway HTTP API] ← JWT認証をここで完結
                  │
                  ▼
         [AWS Lambda]              ← TypeScript ファットLambda
                  │
                  ▼
         [Amazon DynamoDB]         ← シングルテーブルデザイン

[Amazon Cognito]  ← ユーザー管理・JWT発行
```

### 採用サービスと選定理由

| サービス | 役割 | 選定理由 |
|---|---|---|
| **CloudFront + S3** | SPA配信 | OACでS3を非公開に保ちながら安全なHTTPS配信 |
| **API Gateway HTTP API** | APIエントリーポイント | REST APIより約1/3の単価。必要機能は全て揃う |
| **Lambda (Node.js 22.x)** | ビジネスロジック | サーバー管理不要。2名利用ではコールドスタートも許容範囲 |
| **DynamoDB (オンデマンド)** | データ永続化 | 散発的なアクセスにプロビジョンドコストが発生しない |
| **Cognito** | 認証・認可 | フルマネージドでユーザー管理・JWT発行をまるごと委託 |
| **Terraform** | IaC | 全リソースをコードで管理し、環境の再現性を確保 |

---

## 技術的なポイント

### 1. ファットLambda + 内部スイッチルーティング

エンドポイントごとに Lambda を分割する「マイクロLambda」ではなく、**全エンドポイントを1つの Lambda に集約する「ファットLambda」**を採用しました。

```typescript
// router.ts — メソッド + パスの switch で振り分け
export async function route(method, path, ctx, req, deps) {
  const [seg0, seg1] = path.split('/').filter(Boolean)

  switch (`${method} /${seg0 ?? ''}`) {
    case 'POST /families':
      if (!seg1) return familyCreateHandler(ctx, req, deps)
      if (seg1 === 'invites') return familyInviteHandler(ctx, req, deps)
      if (seg1 === 'join')    return familyJoinHandler(ctx, req, deps)
      break
    case 'POST /tasks':
      if (seg1 === 'execute') return taskExecuteHandler(ctx, req, deps)
      break
    case 'DELETE /tasks':
      if (seg1 === 'execute') return taskExecuteCancelHandler(ctx, req, deps)
      if (seg1) return taskDeleteHandler(ctx, req, deps) // UUIDはexecuteと衝突しない
      break
    // ...
  }
  throw new AppError(404, 'エンドポイントが見つかりません')
}
```

**ファットLambdaのメリット:**

- インフラ定義（Terraform）がシンプルになる（Lambda関数が1つ）
- esbuildによる単一ファイルバンドルで**コールドスタートが速い**
- ハンドラ間でDI（依存性注入）した `IFamilyRepository` を共有できる

esbuildの出力は `CJS形式` にして ZIP に含めるファイルは `index.js` のみ（`package.json` を含めない）——これにより `"type": "module"` との競合を避けています。

---

### 2. DynamoDBシングルテーブルデザイン

全エンティティを1テーブルに格納する「シングルテーブルデザイン」を採用しました。

```
テーブル: iezi-prod-FamilyAppTable

PK(FamilyID)    SK(DataSortKey)                              エンティティ
─────────────────────────────────────────────────────────────────────────
fam_xxx         USER#cognito-sub-001                         ユーザー情報
fam_xxx         USER#cognito-sub-002                         ユーザー情報
fam_xxx         TASK#uuid-task-001                           家事マスター
fam_xxx         TASK#uuid-task-002                           家事マスター
fam_xxx         DAILY#2026-05-25#cognito-sub-001             日次サマリ
fam_xxx         HISTORY#2026-05-25T12:00:00Z#sub-001#uuid   家事実績
fam_xxx         NEGURAI#2026-05-25T10:00:00Z#negurai-uuid   ねぎらい記録
```

**全アクセスパターンをSKの `begins_with` だけで解決**しており、GSI/LSIはゼロです。

```typescript
// アプリ起動時の一括取得: USERとTASKをPromise.allで並列クエリ
const [users, tasks] = await Promise.all([
  query({ begins_with: 'USER#' }),
  query({ begins_with: 'TASK#' }),
])

// 週次サマリ: BETWEEN で7日分を1クエリ
query({ between: ['DAILY#2026-05-19', 'DAILY#2026-05-25~'] })
// ※ '~' (0x7E) は任意のcognitoSubより常に大きいため、翌日のレコードを含まない
```

GSIを使わないことで、DynamoDBの**10GB/パーティション制限（LSI）**も回避でき、コストも抑えられます。

---

### 3. TransactWriteItemsによる冪等性の担保

「やった！」ボタンを連打したり、通信エラーで自動リトライが走っても、**ポイントが二重加算されない**ことは絶対条件です。

```
フロントエンド側:
  ボタンタップ時に crypto.randomUUID() を一度だけ発行し、状態として保持。
  リトライ時も同じ UUID を使い回す。

バックエンド側:
  TransactWriteItems で以下の3つを同時書き込み:

  1. PutItem (HISTORY record)
     条件: attribute_not_exists(DataSortKey)  ← ★ 重複を原子的にブロック

  2. UpdateItem (DAILY summary)
     ADD DailyPoints :points

  3. UpdateItem (USER record)
     ADD TotalPoints :points
```

`attribute_not_exists` 条件が成立しない（= 同一 `taskExecutionId` が既に存在する）場合、トランザクション全体が `ConditionalCheckFailedException` でロールバックされます。これをフロントエンドでは409として扱い、「既に記録済み（リトライ成功）」と解釈します。

取り消し時も同様のトランザクションで、`points` にマイナス値を渡して加算・日次サマリ・累積ポイントを一括で減算します。

---

### 4. API GatewayのJWT Authorizerによるセキュリティと課金防御

```
[不正リクエスト] → API Gateway (JWT Authorizer) → 401 Unauthorized
                                                    （Lambdaは起動されない）

[正常リクエスト] → API Gateway → Lambda → DynamoDB
```

**Lambda が起動する前に** API Gateway がJWTを検証するため、不正リクエストがLambdaを起動させることがありません。これはセキュリティ上の防御であると同時に、**Lambdaの無駄な課金を防ぐコスト最適化**でもあります。

また、PII（個人情報）はすべてCognito側に隔離し、DynamoDBにはランダムなUUID形式のCognitoSubのみを保存します。

---

### 5. Cognitoカスタム属性による家族グループ管理

ユーザーがどの家族に属しているかを `custom:family_id` というCognitoカスタム属性で管理します。

```typescript
// JWT クレームから家族IDを取得
const familyId = event.requestContext.authorizer?.jwt?.claims?.['custom:family_id']
const cognitoSub = event.requestContext.authorizer?.jwt?.claims?.sub

// 家族作成時は Lambda が AdminUpdateUserAttributes で書き込む
await cognito.adminUpdateUserAttributes({
  UserPoolId: process.env.COGNITO_USER_POOL_ID,
  Username: cognitoSub,
  UserAttributes: [{ Name: 'custom:family_id', Value: newFamilyId }],
})
```

これにより**DynamoDBのクエリパラメータに家族IDをハードコードせず**、JWTクレームから安全に取得できます。招待フローも `POST /families/join` が同様のAPIで家族IDをセットします。

---

### 6. 2テーブル横断トランザクションによる招待フロー

招待データは `FamilyAppTable` と別の `FamilyInviteTable` に保存します。招待URLのトークンを `PK` にすることで、「家族IDを持たない状態でトークン単独から引ける」設計です。

招待消費（`POST /families/join`）は**2テーブル横断のTransactWriteItems**で実現しています：

```typescript
await dynamodb.transactWrite({
  TransactItems: [
    // FamilyInviteTable: トークンを消費済みにマーク
    {
      Update: {
        TableName: INVITE_TABLE,
        Key: { Token: token },
        ConditionExpression: 'attribute_exists(#token) AND (attribute_not_exists(UsedAt) OR UsedBy = :sub)',
        UpdateExpression: 'SET UsedAt = :now, UsedBy = :sub',
      }
    },
    // FamilyAppTable: ユーザーレコードを作成
    {
      Put: {
        TableName: FAMILY_APP_TABLE,
        Item: { FamilyID: familyId, DataSortKey: `USER#${cognitoSub}`, ... },
        ConditionExpression: 'attribute_not_exists(DataSortKey)',
      }
    },
  ]
})
```

条件式の `attribute_not_exists(UsedAt) OR UsedBy = :sub` により：
- **未消費**なら通す
- **同一ユーザーの冪等リトライ**も通す（ネットワークエラーで再試行しても安全）
- **別ユーザーが消費済み**なら弾く（409 Conflict）

---

### 7. モノレポ構成と共有型定義（Zodスキーマ）

```
/
├── frontend/     React SPA (npm workspace)
├── backend/      Lambda ソースコード (npm workspace)
├── shared/       @iezi/shared — Zodスキーマで型定義を共有
└── infra/        Terraform HCL
```

フロントエンドとバックエンドで共通のリクエスト/レスポンス型を `@iezi/shared` として管理します。

```typescript
// shared/src/index.ts
export const TaskHistoryCreateRequestSchema = z.object({
  taskId: z.string().uuid(),
  taskExecutionId: z.string().uuid(),
  timestamp: z.string().datetime().optional(),
})

// backend — バリデーション
const result = TaskHistoryCreateRequestSchema.safeParse(req.body)

// frontend — APIレスポンスの型検証
const data = await apiGet('/family/init', FamilyInitResponseSchema)
```

型定義の二重管理をゼロにし、バックエンドのバリデーションとフロントエンドの型推論を単一ソースから導出しています。

---

### 8. バックデート登録と日付変更の設計

「昨日やった家事を今日登録する」ケースに対応するため、`POST /tasks/execute` にオプションの `timestamp` フィールドを追加しています。

```typescript
// フロントエンド: 今日以外を選択した場合のみ timestamp を送信
const body = {
  taskId: task.taskId,
  taskExecutionId: crypto.randomUUID(),
  ...(dateKey !== todayKey && { timestamp: `${dateKey}T12:00:00+09:00` }),
}
```

過去の実績の日付変更は「削除→再登録」の2ステップで実装しています。HISTORY レコードの直接編集は禁止——差分ポイントの再計算というバグの温床を根本から排除するためです。

```
updateTaskHistoryDate(item, newDateKey):
  1. DELETE /tasks/execute  (旧実績を削除、ポイントを減算)
  2. POST /tasks/execute    (新 taskExecutionId で再登録、新日付でポイントを加算)
```

---

### 9. PWA対応とService Workerのキャッシュ戦略

`vite-plugin-pwa` を使いWeb App ManifestとService Workerを自動生成。スマートフォンのホーム画面に追加すればネイティブアプリのように使えます。

CloudFrontのキャッシュ設定でポイントとなるのが `sw.js` の扱いです：

```hcl
# sw.js は TTL=0 — Service Workerを即時更新させる
ordered_cache_behavior {
  path_pattern = "/sw.js"
  min_ttl      = 0
  default_ttl  = 0
  max_ttl      = 0
}

# ハッシュ付きアセット (JS/CSS) は1年キャッシュ
ordered_cache_behavior {
  path_pattern = "/assets/*"
  min_ttl      = 31536000
  default_ttl  = 31536000
  max_ttl      = 31536000
}
```

API呼び出しはWorkboxの `NetworkFirst` 戦略（オンライン時は常に最新データ、オフライン時のみキャッシュ利用）にしており、ポイントデータの陳腐化を防いでいます。

---

### 10. 可視化とフォーカス時の自動再同期

ホーム画面には14日分の積み上げ棒グラフを実装。外部ライブラリは使わず、Tailwind CSSの `height` スタイルをインラインで動的計算し、純粋なHTMLでレンダリングしています。

```tsx
// Y軸最大値を計算し、各バーの高さを割合で算出
const maxWeeklyPoints = Math.max(
  ...dates.map(date => members.reduce((sum, m) =>
    sum + (weeklySummaries.find(s => s.cognitoSub === m.cognitoSub && s.date === date)?.dailyPoints ?? 0), 0)
  ), 100
)
// バーの高さ: height: `${(daily / maxWeeklyPoints) * 100}%`
```

また `visibilitychange` イベントを監視し、ブラウザのタブが再アクティブになったタイミングで自動的にAPIを再取得します。複数端末から操作した場合でも、切り替えのたびにデータが最新になります。

---

### 11. コスト最適化の工夫

AWS無料枠のポイントとなる設計まとめ：

| 設計 | コスト効果 |
|---|---|
| DynamoDBオンデマンドモード | 散発アクセスにプロビジョンドコスト不要 |
| JWT AuthorizerでLambdaを保護 | 不正リクエストでのLambda課金を防止 |
| GSI/LSIなし | 追加の読み書き容量ユニット不要 |
| DynamoDBのTTL | ストレージを自動削除（費用ゼロ） |
| HISTORY: 1年後 / DAILY: 90日後 | 必要十分な保持期間で肥大化防止 |
| CloudWatchログ保持: 14日 | ログストレージ料金の累積防止 |
| AWS HTTP Keep-Alive有効化 | Lambda→DynamoDB間レイテンシ改善（コネクション再利用） |

```typescript
// Lambda環境変数で設定: Keep-Aliveを有効化
AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
```

---

## インフラ管理（Terraform）

全AWSリソースをTerraformで管理し、環境の再現性を確保しています。

```
infra/
├── provider.tf      # AWSプロバイダー設定
├── cloudfront.tf    # CloudFrontディストリビューション + OAC + キャッシュ戦略
├── s3.tf            # 静的アセット用バケット（OACからのみアクセス許可）
├── dynamodb.tf      # シングルテーブル + オンデマンド + TTL + PITR
├── cognito.tf       # ユーザープール + カスタム属性 + アプリクライアント
├── lambda.tf        # ファットLambda + IAMロール（最小権限）
├── apigateway.tf    # HTTP API + JWT Authorizer + CORS
└── backend.tf       # TerraformステートをS3で管理（S3ネイティブロック）
```

Terraform stateはS3バケットでリモート管理。Terraform 1.10以降の `use_lockfile = true` による**S3ネイティブロック**を採用し、DynamoDBテーブルなしで排他制御しています。

---

## 今後の改善点

### バグ修正

1. **家事編集後に一覧の先頭に移動してしまう問題**
   - `context.tsx` の `upsertTaskMaster` がオプティミスティック更新で常に先頭挿入している
   - 修正方針: 既存IDなら同位置で置換、新規IDなら先頭挿入の分岐に変える

2. **Settings画面の編集エラーが新規追加フォームに表示される問題**
   - `error` stateを新規追加と編集で共有している
   - 修正方針: 編集用の `error` stateを独立させる

### 機能改善

1. **オフラインでの家事記録**
   - 現状はNetworkFirst戦略のためオフライン時は記録できない
   - Background Syncを使ったオフライン記録のキュー管理

2. **プッシュ通知**
   - 相手がポイントを記録したときのリアルタイム通知
   - AWS EventBridge + Lambda → Web Push または SNS → FCM

3. **月次レポート**
   - 月ごとの家事貢献度をまとめたサマリ表示
   - 現在はYAGNIで週次サマリ止まり

4. **GitHub Actions CI/CDの整備**
   - OIDC連携（AssumeRoleWithWebIdentity）によるLambdaデプロイの自動化
   - mainブランチへのマージで自動デプロイ

---

## まとめ

iezi の設計を振り返ると、**「月0円で動かす」という制約が技術選定を研ぎ澄ませてくれた**と感じています。

- DynamoDBのシングルテーブル設計はGSIなしでも十分なアクセスパターンを実現
- TransactWriteItemsによる冪等性は、UI上の制御だけでは防げない重複加算を根本排除
- ファットLambdaはインフラをシンプルに保ちつつ、esbuildバンドルで高速なコールドスタートを維持
- API GatewayのJWT Authorizerは認証の関心をLambdaから分離し、コスト防御も兼ねる

家族2人のためのプライベートアプリとはいえ、こうした設計の積み重ねが「毎月数十円もかからず、でも本番品質で動く」プロダクトを生み出せる体験は、個人開発でのAWS活用の醍醐味だと思っています。

---

## 参考

- [Amazon DynamoDB — シングルテーブルデザイン](https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/bp-general-nosql-design.html)
- [Amazon API Gateway — HTTP APIのJWT Authorizer](https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [AWS Lambda — esbuildによるNode.jsバンドル](https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/nodejs-package.html)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Terraform — S3バックエンドのネイティブロック](https://developer.hashicorp.com/terraform/language/backend/s3)
