#!/bin/sh
# Полное восстановление наработок UPS Manager на роутере OpenWrt 25.x (BusyBox sh).
# Запуск на роутере после копирования набора в /tmp/ups-restore:
#   sh /tmp/ups-restore/restore-all.sh
#
# Что делает:
#   1. Проверяет, что установлен чистый пакет luci-app-ups-manager.
#   2. Ставит драйвер blazer_usb и утилиты NUT (apk).
#   3. Задаёт параметры UPS и опции UCI (без паролей: их создаёт uci-defaults).
#   4. Отключает системные nut-server и nut-monitor (конфликтуют с пакетом).
#   5. Устанавливает перевод, журнал, звук, демон, RPC, init, ACL.
#   6. Перезапускает демон (procd поднимает его заново) и перечитывает RPC.
#
# Нужные переменные можно задать перед запуском, например:
#   UPS_VID=0665 UPS_PID=5161 sh restore-all.sh

set -e

SRC=/tmp/ups-restore
UPS_VID="${UPS_VID:-0665}"
UPS_PID="${UPS_PID:-5161}"
NOMINAL_W="${NOMINAL_W:-450}"
BATT_AH="${BATT_AH:-7}"
EFF="${EFF:-0.85}"

step() { echo; echo "=== $1 ==="; }

step "1. Проверка пакета и файлов"
[ -f /usr/bin/ups-manager-daemon ] || [ -f /etc/init.d/ups-manager ] || { echo "ОШИБКА: пакет luci-app-ups-manager не установлен. Сначала поставьте чистый пакет."; exit 1; }
for f in router-install.sh router-journal-install.sh router-beeper-install.sh ups-ru.tar.gz ups-manager-daemon ups-manager-beeper ups-manager-log-event luci.ups-manager ups-manager luci-app-ups-manager.json; do
	[ -f "$SRC/$f" ] || { echo "ОШИБКА: нет $SRC/$f"; exit 1; }
done
echo "файлы на месте"

step "2. Драйвер NUT"
apk update >/dev/null 2>&1 || echo "предупреждение: apk update не выполнен, продолжаю"
apk add nut-driver-blazer_usb nut-upscmd >/dev/null 2>&1 || apk add nut-driver-blazer_usb nut-upscmd
echo "драйвер установлен"

step "3. Параметры UPS (UCI)"
uci set ups_manager.ups.driver='blazer_usb'
uci set ups_manager.ups.vendorid="$UPS_VID"
uci set ups_manager.ups.productid="$UPS_PID"
uci set ups_manager.ups.port='auto'
uci set ups_manager.ups.nominal_power="$NOMINAL_W"
uci set ups_manager.ups.battery_capacity_ah="$BATT_AH"
uci set ups_manager.ups.inverter_efficiency="$EFF"
uci set ups_manager.global.reuse_existing_nut='0'
uci commit ups_manager
echo "UCI записан"

step "4. Системные сервисы NUT отключаются"
/etc/init.d/nut-server stop >/dev/null 2>&1 || true
/etc/init.d/nut-server disable >/dev/null 2>&1 || true
/etc/init.d/nut-monitor stop >/dev/null 2>&1 || true
/etc/init.d/nut-monitor disable >/dev/null 2>&1 || true
echo "nut-server и nut-monitor отключены"

step "5. Установка набора"
sh "$SRC/router-install.sh" || echo "предупреждение: router-install.sh завершился с ошибкой (см. вывод выше)"
sh "$SRC/router-journal-install.sh" || echo "предупреждение: журнал не установлен"
sh "$SRC/router-beeper-install.sh" || echo "предупреждение: вкладка «Звук» не установлена"
cp "$SRC/ups-manager-daemon" /usr/bin/ups-manager-daemon
cp "$SRC/ups-manager-beeper" /usr/bin/ups-manager-beeper
cp "$SRC/ups-manager-log-event" /usr/bin/ups-manager-log-event
cp "$SRC/luci.ups-manager" /usr/libexec/rpcd/luci.ups-manager
cp "$SRC/ups-manager" /etc/init.d/ups-manager
cp "$SRC/luci-app-ups-manager.json" /usr/share/rpcd/acl.d/luci-app-ups-manager.json
chmod 755 /usr/bin/ups-manager-daemon /usr/bin/ups-manager-beeper /usr/bin/ups-manager-log-event /usr/libexec/rpcd/luci.ups-manager /etc/init.d/ups-manager
for f in /usr/bin/ups-manager-daemon /usr/bin/ups-manager-beeper /usr/libexec/rpcd/luci.ups-manager /etc/init.d/ups-manager; do sh -n "$f" || { echo "ОШИБКА синтаксиса: $f"; exit 1; }; done
echo "файлы установлены, синтаксис OK"

step "6. Перезапуск служб"
/etc/init.d/ups-manager enable >/dev/null 2>&1 || true
kill $(pgrep -f ups-manager-daemon) 2>/dev/null || true
sleep 5
/etc/init.d/rpcd reload >/dev/null 2>&1 || true
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache/
sleep 5

step "7. Проверка"
UPSSTATUS=$(upsc ups@127.0.0.1 ups.status 2>/dev/null || echo "нет связи")
echo "ups.status: $UPSSTATUS"
echo "daemon: $(pgrep -f ups-manager-daemon >/dev/null && echo запущен || echo НЕ запущен)"
echo "перевод: $(grep -c 'Обзор' /usr/share/luci/menu.d/luci-app-ups-manager.json 2>/dev/null) строк(и) в меню"
echo
echo "ГОТОВО. Откройте LuCI в режиме инкогнито."
echo "Если ups.status не OL и нет связи: проверьте 'logread | tail -n 20' и повторите запуск."
