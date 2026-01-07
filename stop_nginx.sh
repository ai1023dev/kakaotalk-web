#!/bin/sh

IDX="$1"

[ -z "$IDX" ] && exit 1
[ "$IDX" -lt 1 ] || [ "$IDX" -gt 10 ] && exit 1

ALLOW_FILE="/etc/nginx/xpra_ip_rules/allow_xpra_${IDX}.conf"

tee "$ALLOW_FILE" > /dev/null <<EOF
deny all;
EOF

nginx -t || exit 1
nginx -s reload
