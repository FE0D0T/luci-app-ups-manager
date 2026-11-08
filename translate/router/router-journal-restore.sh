#!/bin/sh
# Откат журнала UPS Manager к китайским сообщениям.
set -e

BACKUP_DIR=/root/ups-manager-journal-zh-backup
[ -f "$BACKUP_DIR/ups-manager-daemon" ] || { echo "ОШИБКА: нет резервной копии в $BACKUP_DIR"; exit 1; }

cp "$BACKUP_DIR/ups-manager-daemon" /usr/bin/ups-manager-daemon
cp "$BACKUP_DIR/ups-manager" /etc/init.d/ups-manager
chmod 755 /usr/bin/ups-manager-daemon /etc/init.d/ups-manager
/etc/init.d/ups-manager restart
echo "Журнал возвращён к китайскому оригиналу."
