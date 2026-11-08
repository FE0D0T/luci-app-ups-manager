#!/bin/sh
# Установка вкладки «Звук» (управление звуковым сигналом ИБП) на роутер.
# Ставит: скрипт ups-manager-beeper, RPC-методы, ACL, службу проверки и вид «Звук».
# Запускать на роутере: sh /tmp/router-beeper-install.sh  (нужна папка /tmp/beeper)
set -e

SRC=/tmp/ups-restore
BACKUP=/root/ups-manager-beeper-backup

echo "=== 1. Проверка файлов ==="
for f in ups-manager-beeper luci.ups-manager ups-manager luci-app-ups-manager.json; do
	[ -f "$SRC/$f" ] || { echo "ОШИБКА: нет $SRC/$f"; exit 1; }
done
[ -f /usr/bin/ups-manager-daemon ] || { echo "ОШИБКА: пакет UPS Manager не установлен."; exit 1; }

echo "=== 2. Резервная копия (один раз) ==="
if [ ! -d "$BACKUP" ]; then
	mkdir -p "$BACKUP"
	for f in /usr/libexec/rpcd/luci.ups-manager /etc/init.d/ups-manager /usr/share/rpcd/acl.d/luci-app-ups-manager.json; do
		[ -f "$f" ] && cp "$f" "$BACKUP/"
	done
	echo "Создана копия: $BACKUP"
else
	echo "Копия уже есть, не перезаписываю: $BACKUP"
fi

echo "=== 3. Установка файлов ==="
cp "$SRC/ups-manager-beeper" /usr/bin/ups-manager-beeper
cp "$SRC/luci.ups-manager" /usr/libexec/rpcd/luci.ups-manager
cp "$SRC/ups-manager" /etc/init.d/ups-manager
cp "$SRC/luci-app-ups-manager.json" /usr/share/rpcd/acl.d/luci-app-ups-manager.json
chmod 755 /usr/bin/ups-manager-beeper /usr/libexec/rpcd/luci.ups-manager /etc/init.d/ups-manager

echo "=== 4. Проверка синтаксиса ==="
sh -n /usr/bin/ups-manager-beeper
sh -n /usr/libexec/rpcd/luci.ups-manager
sh -n /etc/init.d/ups-manager
echo "синтаксис OK"

echo "=== 5. Перезапуск rpcd и службы ==="
/etc/init.d/rpcd reload 2>/dev/null || /etc/init.d/rpcd restart
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache/
killall upsd upsdrvctl 2>/dev/null || true
sleep 2
/etc/init.d/ups-manager start
sleep 5

echo "=== 6. Проверка ==="
/usr/bin/ups-manager-beeper status && echo "звук: статус получен" || echo "ВНИМАНИЕ: статус звука не получен (проверьте связь с UPS)"
echo "УСТАНОВКА ЗАВЕРШЕНА. Откройте LuCI в режиме инкогнито, пункт «Звук»."
echo "Откат: sh /tmp/router-beeper-restore.sh"
