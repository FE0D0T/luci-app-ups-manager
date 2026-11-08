#!/bin/bash
# Установка перевода и всех наработок UPS Manager на роутер OpenWrt (macOS / Linux).
# Запуск из Terminal:  bash install-mac.sh
#
# Что делает:
#   1. Спрашивает IP роутера и пароль root.
#   2. Копирует все файлы из папки ../router на роутер в /tmp/ups-restore/.
#   3. Запускает restore-all.sh на роутере: драйвер, UCI, установка набора, перезапуск.
#
# Перед запуском на роутере должен стоять чистый пакет luci-app-ups-manager.

set -e

ROUTER_DIR="$(cd "$(dirname "$0")/../router" && pwd)"

if [ ! -f "$ROUTER_DIR/restore-all.sh" ]; then
  echo "ОШИБКА: не найдена папка router с restore-all.sh рядом с installers." >&2
  exit 1
fi

read -r -p "IP-адрес роутера (например 192.168.1.1): " ROUTER_IP
[ -n "$ROUTER_IP" ] || { echo "ОШИБКА: IP не введён"; exit 1; }

echo
echo "[1/2] Создаю папку на роутере и копирую файлы (введите пароль root)."
ssh "root@${ROUTER_IP}" "mkdir -p /tmp/ups-restore"
scp -O "$ROUTER_DIR"/* "root@${ROUTER_IP}:/tmp/ups-restore/"

echo
echo "[2/2] Полное восстановление на роутере (введите пароль root ещё раз)."
ssh "root@${ROUTER_IP}" "sh /tmp/ups-restore/restore-all.sh" || \
  echo "ВНИМАНИЕ: восстановление завершилось с ошибкой. Смотрите вывод выше."

echo
echo "Готово. Откройте LuCI в режиме инкогнито. Подробнее: docs/restore/STEPS.md"
