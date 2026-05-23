#!/usr/bin/env bash
set -e

# ==============================================================================
# iezi デプロイスクリプト
# 
# バックエンドのビルド、Terraformによるインフラ展開、
# フロントエンドの環境変数自動注入、ビルド、S3同期までを一気通貫で実行します。
# 
# 使い方:
#   ./deploy.sh <environment>
# 例:
#   ./deploy.sh dev
# ==============================================================================

if [ -z "$1" ]; then
  echo "❌ エラー: 環境名が指定されていません。"
  echo "使用方法: $0 <environment>"
  echo "例: $0 dev"
  exit 1
fi

ENV=$1
TFVARS_FILE="${ENV}.tfvars"

# AWSプロファイルの設定 (指定がなければ 'terraform' を使用)
export AWS_PROFILE="${AWS_PROFILE:-terraform}"
echo "🔧 AWS_PROFILE を '${AWS_PROFILE}' に設定しました。"

echo "🚀 [1/5] バックエンドと共有パッケージのビルドを開始します..."
npm install
npm run build -w shared
npm run build -w backend

echo "🚀 [2/5] Terraform によるインフラのデプロイを開始します (環境: ${ENV})..."
cd infra
if [ ! -f "$TFVARS_FILE" ]; then
  echo "⚠️ 警告: ${TFVARS_FILE} が見つかりません。Terraform の実行には環境変数ファイルが必要です。"
  echo "terraform.tfvars.example をコピーして作成してください。"
  exit 1
fi

terraform init
terraform apply -var-file="${TFVARS_FILE}" -auto-approve

echo "🚀 [3/5] Terraform の Output を取得し、フロントエンドの環境変数を設定します..."
# Terraform の Output を JSON 形式で取得
TF_OUTPUTS=$(terraform output -json)

# JSONから jq を使って値を取り出し、フロントエンドの .env ファイルを生成
FRONTEND_BUCKET=$(echo $TF_OUTPUTS | jq -r '.frontend_bucket_name.value')
CF_DIST_ID=$(echo $TF_OUTPUTS | jq -r '.cloudfront_distribution_id.value')

cat << EOF > ../frontend/.env.production.local
VITE_COGNITO_USER_POOL_ID=$(echo $TF_OUTPUTS | jq -r '.cognito_user_pool_id.value')
VITE_COGNITO_CLIENT_ID=$(echo $TF_OUTPUTS | jq -r '.cognito_user_pool_client_id.value')
VITE_API_ENDPOINT=$(echo $TF_OUTPUTS | jq -r '.api_endpoint.value')
EOF
echo "✅ frontend/.env.production.local を生成しました。"
cd ..

echo "🚀 [4/5] フロントエンドのビルドを開始します..."
npm run build -w frontend

echo "🚀 [5/5] S3への同期と CloudFront のキャッシュ無効化を実行します..."
if [ -z "$FRONTEND_BUCKET" ] || [ "$FRONTEND_BUCKET" == "null" ]; then
  echo "❌ エラー: S3バケット名が取得できませんでした。"
  exit 1
fi

echo "S3 へアップロード中 (s3://${FRONTEND_BUCKET})..."
aws s3 sync frontend/dist/ s3://${FRONTEND_BUCKET} --delete

echo "CloudFront のキャッシュをクリア中 (Distribution ID: ${CF_DIST_ID})..."
aws cloudfront create-invalidation --distribution-id ${CF_DIST_ID} --paths "/*"

echo "🎉 すべてのデプロイプロセスが完了しました！"
