#!/bin/sh
# Исправление: на странице «Качество сети» не должно выводиться слово null.
# Ставит quality.js из /tmp/quality-fix/quality.js. Резервная копия создаётся один раз.
set -e

SRC=/tmp/ups-restore/quality.js
DST=/www/luci-static/resources/view/ups-manager/quality.js
BACKUP=/root/ups-manager-quality-backup.js

[ -f "$SRC" ] || { echo "ОШИБКА: нет $SRC"; exit 1; }
[ -f "$DST" ] || { echo "ОШИБКА: не найден $DST. Пакет UPS Manager не установлен."; exit 1; }

if [ ! -f "$BACKUP" ]; then
	cp "$DST" "$BACKUP"
	echo "Создана резервная копия: $BACKUP"
else
	echo "Резервная копия уже есть, не перезаписываю: $BACKUP"
fi

cp "$SRC" "$DST"
chmod 644 "$DST"
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache/

if grep -q "\]) : '';" "$DST" && ! grep -q "\]) : null;" "$DST"; then
	echo "УСПЕХ: правка установлена. Откройте «Качество сети» в режиме инкогнито."
else
	echo "ОШИБКА: проверка не прошла."
	exit 1
fi
