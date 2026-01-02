#!/bin/sh

# ===== 인자 =====
IDX="$1"          # 1 ~ 10

# ===== 범위 체크 =====
if [ "$IDX" -lt 1 ] || [ "$IDX" -gt 10 ]; then
  echo "IDX must be 1~10"
  exit 1
fi

DISPLAY=":$IDX"
PORT=$((14500 + IDX))
BOTTLE="kweb-$IDX"

# ===== Xpra 실행 =====
exec xpra start "$DISPLAY" \
  --bind-tcp=0.0.0.0:"$PORT" \
  --html=on \
  --start-child="flatpak run --command=bottles-cli com.usebottles.bottles run -b \"$BOTTLE\" -p KakaoTalk" \
  --exit-with-children=yes \
  --start-new-commands=no \
  --daemon=no \
  --file-transfer=no \
  --open-files=no \
  --printing=no

