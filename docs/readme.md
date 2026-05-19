# カジコ (Cajico) - 家事管理アプリ 🏠✨

## 📝 プロジェクト概要

[cite_start]「カジコ」は、家族間で家事タスクを共有し、日々の完了状況や獲得ポイントを楽しく管理するためのアプリケーションです [cite: 1]。
[cite_start]AWSのマネージドサービスをフル活用したモダンな「完全サーバーレスアーキテクチャ」を採用しており、個人や自分とパートナーの2名での利用においては維持費を「ほぼ0円」に抑えることができる、高いコストパフォーマンスを誇ります [cite: 36]。

## 🏗️ システムアーキテクチャ

フロントエンドからインフラ管理まで、実務レベルのスケーラビリティと保守性を意識した技術スタックを採用しています。

- [cite_start]**フロントエンド**: React (サーバーサイドレンダリングなし) [cite: 32]
- [cite_start]**バックエンド**: Amazon API Gateway + AWS Lambda (Go言語 / ファットLambda構成) [cite: 27, 32]
- [cite_start]**データベース**: Amazon DynamoDB [cite: 32]
- [cite_start]**認証**: Amazon Cognito (CognitoサブをユーザーIDとして使用) [cite: 32]
- [cite_start]**インフラ構築**: Terraform (HCLを使用) [cite: 32]

### 💡 構成のハイライト

- [cite_start]**Go言語によるファットLambda**: コンパイルされた単一のバイナリファイルとなるため、起動速度を保ちつつインフラ管理をシンプルにしています [cite: 27, 33]。
- [cite_start]**Cognito Authorizer**: API Gatewayの入り口でCognitoオーソライザーによるアクセス保護を行うことで、不正なリクエストをLambdaの手前でブロックします [cite: 30, 31]。

## 🗄️ データベース設計 (DynamoDB)

[cite_start]RDBMSの概念を捨て、データのアクセスパターンに最適化された**シングルテーブル設計**を採用しています [cite: 32]。

- [cite_start]**テーブル名**: `FamilyAppTable` [cite: 19]
- [cite_start]**パーティションキー (PK)**: `FamilyID` (家族単位でデータを集約) [cite: 19, 32]
- [cite_start]**ソートキー (SK)**: プレフィックスを活用し、同じPKの中で「設定データ」や「履歴データ」を同居させます [cite: 19][cite_start]。プレフィックスには `USER#`, `TASK#`, `DAILY#`, `HISTORY#` などを活用します [cite: 32]。
- [cite_start]**データライフサイクル**: 無限にデータが溜まるのを防ぐため、日次サマリやタスク履歴にはTTL（自動削除）の対象として設定します [cite: 20]。
- [cite_start]**ポイント集計**: 削除イベントに対応するため、DynamoDB Streamsと専用の更新用Lambda関数を連携させて自動更新します [cite: 32]。

## 🛡️ 最重要ロジック：冪等性の担保（二重加算防止）

通信エラー時の自動リトライやボタン連打による「ポイント増殖バグ」を防ぐため、システム全体で強固な冪等性を担保しています。

- [cite_start]**フロントエンドでのID発行**: ユーザーが完了ボタンをタップした瞬間にフロントエンドでUUIDを発行します [cite: 20]。
- [cite_start]**履歴キーへの組み込み**: 送信されたUUIDは、タスク履歴のSKの末尾に組み込まれます [cite: 20]。
- [cite_start]**条件付き書き込みによるブロック**: DynamoDBへトランザクション書き込みを行う際、`attribute_not_exists(HistoryKey)` の条件を指定し、ポイントの二重加算を確実に防ぎます [cite: 20, 21]。

## 📂 ディレクトリ構成

[cite_start]Git管理における基本的なフォルダ構成は以下の通りです [cite: 32]。

- [cite_start]`frontend/`: Reactプロジェクト [cite: 32]
- [cite_start]`backend/`: Lambdaなどのバックエンドロジック [cite: 32]
- [cite_start]`infrastructure/`: Terraformのインフラコード [cite: 32]
- `docs/`: プロジェクトドキュメント (各種仕様書)

[cite_start]_(※ ステージング環境のCI/CDなどでGitHub SecretsやAWS Systems Managerを活用し、環境分離を行います [cite: 32])_

## 📖 関連ドキュメント

各機能の詳細な設計については、以下のドキュメントを参照してください。

- [DynamoDB テーブル設計詳細](./docs/dynamodb_spec.md)
- [API エンドポイント仕様書](./docs/api_spec.md)
- [インフラストラクチャ (Terraform) 構成仕様](./docs/infrastructure.md)

---

_Developed by Cajico Project_
