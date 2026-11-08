#!/bin/sh
# Откат к оригинальному китайскому интерфейсу UPS Manager.
# Использует копии, созданные router-install.sh.

set -e

BACKUP_DIR=/root/ups-manager-zh-backup
MENU_BACKUP=/root/luci-app-ups-manager.json.zh-backup
VIEW_DST=/www/luci-static/resources/view/ups-manager
MENU_DST=/usr/share/luci/menu.d/luci-app-ups-manager.json

[ -d "$BACKUP_DIR" ] || { echo "ОШИБКА: нет резервной копии $BACKUP_DIR"; exit 1; }
[ -f "$MENU_BACKUP" ] || { echo "ОШИБКА: нет резервной копии $MENU_BACKUP"; exit 1; }

cp "$BACKUP_DIR"/*.js "$VIEW_DST"/
cp "$MENU_BACKUP" "$MENU_DST"
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache/
echo "Оригинальный интерфейс восстановлен. Откройте LuCI в режиме инкогнито."
