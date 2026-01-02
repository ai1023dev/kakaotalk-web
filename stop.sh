#!/bin/sh

IDX="$1"

[ -z "$IDX" ] && exit 1
[ "$IDX" -lt 1 ] || [ "$IDX" -gt 10 ] && exit 1

DISPLAY=":$IDX"

xpra stop "$DISPLAY"

sleep 5

SRC="$HOME/Desktop/kakaotalk-web/default_drive_c"
DST="$HOME/.var/app/com.usebottles.bottles/data/bottles/bottles/kweb-$IDX/drive_c"

rsync -a --delete "$SRC/" "$DST/"
