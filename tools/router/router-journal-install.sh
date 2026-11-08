#!/bin/sh
# Установка русского журнала событий UPS Manager (демон и init-скрипт).
# Запускать на роутере: sh /tmp/router-journal-install.sh
# Нужны файлы /tmp/journal/ups-manager-daemon и /tmp/journal/ups-manager.

set -e

SRC=/tmp/ups-restore
DAEMON_DST=/usr/bin/ups-manager-daemon
INIT_DST=/etc/init.d/ups-manager
BACKUP_DIR=/root/ups-manager-journal-zh-backup

echo "=== 1. Проверка файлов ==="
[ -f "$SRC/ups-manager-daemon" ] || { echo "ОШИБКА: нет $SRC/ups-manager-daemon"; exit 1; }
[ -f "$SRC/ups-manager" ] || { echo "ОШИБКА: нет $SRC/ups-manager"; exit 1; }
[ -f "$DAEMON_DST" ] || { echo "ОШИБКА: не найден $DAEMON_DST. Пакет UPS Manager не установлен."; exit 1; }
[ -f "$INIT_DST" ] || { echo "ОШИБКА: не найден $INIT_DST. Пакет UPS Manager не установлен."; exit 1; }

echo "=== 2. Резервная копия оригинала (один раз) ==="
if [ ! -d "$BACKUP_DIR" ]; then
	mkdir -p "$BACKUP_DIR"
	cp "$DAEMON_DST" "$BACKUP_DIR/ups-manager-daemon"
	cp "$INIT_DST" "$BACKUP_DIR/ups-manager"
	echo "Создана копия: $BACKUP_DIR"
else
	echo "Копия уже есть, не перезаписываю: $BACKUP_DIR"
fi

echo "=== 3. Установка ==="
cp "$SRC/ups-manager-daemon" "$DAEMON_DST"
cp "$SRC/ups-manager" "$INIT_DST"
chmod 755 "$DAEMON_DST" "$INIT_DST"

echo "=== 4. Перезапуск службы ==="
/etc/init.d/ups-manager restart
sleep 5

echo "=== 5. Проверка ==="
OK=1
grep -q 'Запуск демона UPS' "$DAEMON_DST" || OK=0
grep -q 'Конфигурация и служба UPS загружены' "$INIT_DST" || OK=0
if pgrep -f ups-manager-daemon >/dev/null 2>&1; then
	echo "Демон запущен."
else
	echo "ВНИМАНИЕ: демон не запущен."
	OK=0
fi
if [ "$OK" = "1" ]; then
	echo "УСПЕХ: журнал будет писаться на русском. Старые записи останутся на китайском."
else
	echo "ОШИБКА: проверка не прошла. Откат: sh /tmp/router-journal-restore.sh"
	exit 1
fi
