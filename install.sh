#!/bin/sh
# Установка luci-app-ups-manager на OpenWrt 25.x (apk) одной командой.
#
# Запуск на роутере (по SSH, от root):
#   wget -qO- https://raw.githubusercontent.com/FE0D0T/luci-app-ups-manager/main/install.sh | sh
#
# Что делает: ставит зависимости из официального репозитория, скачивает .apk
# из последнего релиза, устанавливает его без post-install скриптов (они могут
# зависнуть), выполняет первичную настройку и запускает службу в фоне.

set -e

REPO="FE0D0T/luci-app-ups-manager"
API="https://api.github.com/repos/$REPO/releases/latest"
TMP_APK="/tmp/luci-app-ups-manager.apk"
DEPS="luci-base rpcd rpcd-mod-file curl nut nut-common nut-server nut-upsmon nut-upsc nut-upscmd nut-driver-usbhid-ups nut-driver-blazer_usb"

say() { echo "=== $1"; }
die() { echo "ОШИБКА: $1" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "запустите от root"
command -v apk >/dev/null 2>&1 || die "нужен apk (OpenWrt 25.x). На старых версиях используйте opkg-пакет из релизов вручную."
command -v wget >/dev/null 2>&1 || die "не найден wget"

if opkg list-installed 2>/dev/null | grep -q '^luci-app-ups-manager '; then
	die "установлен старый пакет через opkg. Удалите его: opkg remove luci-app-ups-manager"
fi

say "1/6 Обновление списка пакетов"
apk update >/dev/null || die "apk update не выполнен: проверьте интернет и DNS"

say "2/6 Зависимости из официального репозитория OpenWrt"
apk add $DEPS || die "не удалось установить зависимости (см. вывод выше)"

say "3/6 Поиск последнего релиза"
URL=$(wget -qO- "$API" | grep -o '"browser_download_url": *"[^"]*\.apk"' | head -n 1 | sed 's/.*"\(https[^"]*\)"/\1/')
[ -n "$URL" ] || die "в последнем релизе нет файла .apk"
echo "    $URL"

say "4/6 Загрузка и установка пакета"
wget -qO "$TMP_APK" "$URL" || die "не удалось скачать пакет"
apk add --no-scripts --allow-untrusted "$TMP_APK" || die "установка пакета не удалась"
rm -f "$TMP_APK"

say "5/6 Первичная настройка"
chmod 755 /etc/init.d/ups-manager /usr/bin/ups-manager-* /usr/libexec/rpcd/luci.ups-manager /etc/uci-defaults/80_ups_manager
sh /etc/uci-defaults/80_ups_manager >/dev/null 2>&1 || true
# Автозапуск через симлинк: команда "enable" может зависнуть, если служба уже работает
mkdir -p /etc/rc.d
ln -sf /etc/init.d/ups-manager /etc/rc.d/S99ups-manager
if [ -f /etc/config/ups_manager.apk-new ]; then
	echo "    Ваш конфиг сохранён. Новый вариант лежит рядом: /etc/config/ups_manager.apk-new (его можно удалить)."
fi

say "6/6 Запуск службы"
( /etc/init.d/ups-manager restart > /tmp/ups-manager-start.log 2>&1 < /dev/null & )
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache/
STATUS=""
i=0
while [ "$i" -lt 30 ]; do
	STATUS=$(upsc ups@127.0.0.1 ups.status 2>/dev/null || true)
	[ "$STATUS" = "OL" ] || [ "$STATUS" = "OB" ] && break
	sleep 2
	i=$((i + 1))
done
echo "    Статус UPS: ${STATUS:-нет ответа} (ждали до 60 с)"
echo
echo "Готово. Откройте LuCI: Службы → UPS Manager (лучше в режиме инкогнито)."
echo "Если статус не OL, подождите 30 секунд и выполните: upsc ups@127.0.0.1 ups.status"
echo "Лог запуска: /tmp/ups-manager-start.log"
