#!/bin/sh
# Установка русского перевода UPS Manager (LuCI) на OpenWrt 25.x (apk).
# Запускать на роутере от root: sh /tmp/router-install.sh
# Принимает архив ups-ru.tar.gz, лежащий в /tmp.

set -e

ARCHIVE=/tmp/ups-restore/ups-ru.tar.gz
WORK=/tmp/ups-restore/work
VIEW_DST=/www/luci-static/resources/view/ups-manager
MENU_DST=/usr/share/luci/menu.d/luci-app-ups-manager.json
BACKUP_DIR=/root/ups-manager-zh-backup
MENU_BACKUP=/root/luci-app-ups-manager.json.zh-backup

echo "=== 1. Проверка системы и файлов ==="
[ -f "$ARCHIVE" ] || { echo "ОШИБКА: нет $ARCHIVE. Сначала загрузите архив в /tmp."; exit 1; }
[ -d "$VIEW_DST" ] || { echo "ОШИБКА: не найдена папка $VIEW_DST. Пакет UPS Manager не установлен."; exit 1; }
[ -f "$MENU_DST" ] || { echo "ОШИБКА: не найден $MENU_DST. Пакет UPS Manager не установлен."; exit 1; }

echo "=== 2. Резервная копия оригинала (один раз) ==="
if [ ! -d "$BACKUP_DIR" ]; then
	cp -r "$VIEW_DST" "$BACKUP_DIR"
	echo "Создана копия: $BACKUP_DIR"
else
	echo "Копия уже есть, не перезаписываю: $BACKUP_DIR"
fi
if [ ! -f "$MENU_BACKUP" ]; then
	cp "$MENU_DST" "$MENU_BACKUP"
	echo "Создана копия: $MENU_BACKUP"
else
	echo "Копия уже есть, не перезаписываю: $MENU_BACKUP"
fi

echo "=== 3. Распаковка архива ==="
rm -rf "$WORK"
mkdir -p "$WORK"
tar -xzf "$ARCHIVE" -C "$WORK"
# Удаляем служебные файлы macOS (._*), если они попали в архив
find "$WORK" -name '._*' | while read -r f; do rm -f "$f"; done

NEW_VIEWS="$WORK/htdocs/luci-static/resources/view/ups-manager"
NEW_MENU="$WORK/root/usr/share/luci/menu.d/luci-app-ups-manager.json"
[ -d "$NEW_VIEWS" ] || { echo "ОШИБКА: в архиве нет папки видов"; exit 1; }
[ -f "$NEW_MENU" ] || { echo "ОШИБКА: в архиве нет файла меню"; exit 1; }

echo "=== 4. Установка файлов ==="
cp "$NEW_VIEWS"/*.js "$VIEW_DST"/
cp "$NEW_MENU" "$MENU_DST"

echo "=== 5. Сброс кэша LuCI ==="
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache/

echo "=== 6. Проверка ==="
OK=1
grep -q 'Состояние питания' "$VIEW_DST/overview.js" || OK=0
grep -q 'Обзор' "$MENU_DST" || OK=0
if ls -a "$VIEW_DST" | grep -q '^\._'; then OK=0; fi
if [ "$OK" = "1" ]; then
	echo "УСПЕХ: перевод установлен."
	echo "Откройте LuCI, закройте вкладки и откройте в режиме инкогнито или очистите кэш браузера."
else
	echo "ВНИМАНИЕ: проверка не прошла. Откатите командой: sh /tmp/router-restore.sh"
	exit 1
fi
