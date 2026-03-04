#!/bin/sh

# ===== 인자 =====
IDX="$1"          # 1 ~ 10

# ===== 범위 체크 =====
if [ "$IDX" -lt 1 ] || [ "$IDX" -gt 10 ]; then
  echo "IDX must be 1~10"
  exit 1
fi

DISPLAY=":$IDX"
PORT=$((14400 + IDX))
BOTTLE="kweb-$IDX"

# ===== Xpra 실행 =====
exec xpra start "$DISPLAY" \
  --bind-tcp=0.0.0.0:"$PORT" \
  --html=on \
  --start-child="sh -c '
    export XDG_RUNTIME_DIR=/run/user/$(id -u)
    export DBUS_SESSION_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/bus
    sleep 10
    flatpak run --command=bottles-cli com.usebottles.bottles run -b \"$BOTTLE\" -p KakaoTalk
  '" \
  --exit-with-children=no \
  --start-new-commands=no \
  --daemon=no \
  --file-transfer=no \
  --open-files=no \
  --printing=no \
  --no-notifications \
  --no-system-tray
