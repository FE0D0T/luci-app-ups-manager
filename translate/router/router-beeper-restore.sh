#!/bin/sh
# Откат вкладки «Звук»: возвращает файлы из /root/ups-manager-beeper-backup
# и удаляет скрипт звука и его службу.
set -e

BACKUP=/root/ups-manager-beeper-backup
[ -d "$BACKUP" ] || { echo "ОШИБКА: нет резервной копии $BACKUP"; exit 1; }

# Остановить проверку звука (она запускается внутри службы)
/etc/init.d/ups-manager restart >/dev/null 2>&1 || true

[ -f "$BACKUP/luci.ups-manager" ] && cp "$BACKUP/luci.ups-manager" /usr/libexec/rpcd/luci.ups-manager
[ -f "$BACKUP/ups-manager" ] && cp "$BACKUP/ups-manager" /etc/init.d/ups-manager
[ -f "$BACKUP/luci-app-ups-manager.json" ] && cp "$BACKUP/luci-app-ups-manager.json" /usr/share/rpcd/acl.d/luci-app-ups-manager.json
rm -f /usr/bin/ups-manager-beeper
rm -f /usr/share/luci/menu.d/luci-app-ups-manager.json.beeper
/etc/init.d/rpcd reload 2>/dev/null || /etc/init.d/rpcd restart
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache/
echo "Вкладка «Звук» удалена. Откройте LuCI в режиме инкогнито."
