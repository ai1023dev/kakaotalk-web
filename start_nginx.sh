#!/bin/sh

IDX="$1"
ALLOW_IP="$2"

ALLOW_FILE="/etc/nginx/allow_xpra_${IDX}.conf"

# nginx allow 파일 생성/수정
tee "$ALLOW_FILE" > /dev/null <<EOF
allow all;
EOF

# nginx 테스트 + reload
nginx -t || exit 1
nginx -s reload

