terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # Lambda デプロイ用 ZIP 生成に使用
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

# 全リソースに Project / Environment / ManagedBy タグを自動付与
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "iezi"
      Environment = var.env
      ManagedBy   = "Terraform"
    }
  }
}
