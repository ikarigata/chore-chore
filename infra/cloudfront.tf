# ============================================================
# CloudFront OAC（Origin Access Control）
# ============================================================
# S3 バケットに直接アクセスさせず、CloudFront 経由に限定する。
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.prefix}-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ============================================================
# CloudFront ディストリビューション
# ============================================================
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${local.prefix} SPA"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # デフォルトキャッシュビヘイビア（index.html は短期キャッシュ）
  default_cache_behavior {
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    # index.html はデプロイ直後に即時反映させるため短め
    min_ttl     = 0
    default_ttl = 60  # 1分
    max_ttl     = 300 # 5分
  }

  # ハッシュ付き静的アセット（JS/CSS）は長期キャッシュ
  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 31536000 # 1年
    default_ttl = 31536000
    max_ttl     = 31536000
  }

  # SPA ルーティング対応: 404/403 は index.html にフォールバック
  # クライアントサイドルーティングで /invite?token=xxx 等のパスを処理させる
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # ACM 証明書を使わない場合（カスタムドメイン無し）は CloudFront デフォルト証明書を使用
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
