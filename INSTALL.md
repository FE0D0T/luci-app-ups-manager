# Установка luci-app-ups-manager (OpenWrt 25.x, apk)

## Быстрая установка (одна команда)

На роутере по SSH, от root:

```sh
wget -qO- https://raw.githubusercontent.com/FE0D0T/luci-app-ups-manager/main/install.sh | sh
```

Скрипт сам поставит зависимости, скачает последний релиз, установит его и запустит службу.
Ниже — ручная установка по шагам, если нужно понимать, что происходит.

Пакет не содержит бинарных файлов и работает на любой архитектуре. Зависимости
ставятся из официального репозитория OpenWrt, а сам пакет — из файла `.apk`,
собранного через GitHub Actions (артефакт `luci-app-ups-manager-apk`).

## 1. Скачать пакет

Скачайте `.apk` из последнего релиза: https://github.com/FE0D0T/luci-app-ups-manager/releases/latest

В разделе **Assets** выберите файл `luci-app-ups-manager-*.apk`.

## 2. Установить зависимости из официального репозитория

На роутере (по SSH):

```sh
apk update
apk add luci-base rpcd rpcd-mod-file curl \
  nut nut-common nut-server nut-upsmon nut-upsc nut-upscmd \
  nut-driver-usbhid-ups nut-driver-blazer_usb
```

`nut-driver-blazer_usb` нужен для UPS Megatec/Santak/Kehua/Ladis, в том числе Greencell UPSLP480.

## 3. Скопировать и установить пакет

С компьютера (из папки, где лежит `.apk`):

```sh
scp -O luci-app-ups-manager-*.apk root@192.168.1.1:/tmp/
```

На роутере:

```sh
apk add --allow-untrusted /tmp/luci-app-ups-manager-*.apk
```

`--allow-untrusted` нужен, потому что пакет собран без подписи репозитория.

## 4. Запустить службы

```sh
/etc/init.d/ups-manager enable
/etc/init.d/ups-manager restart
/etc/init.d/rpcd reload
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache/
```

Откройте LuCI в режиме инкогнито: **Службы → UPS Manager**.

## 5. Проверка

```sh
upsc ups@127.0.0.1 ups.status
logread | grep ups-manager | tail -n 5
```

`ups.status` должен показать `OL` (питание от сети). Если связи нет, проверьте,
что UPS подключён по USB, и что драйвер `blazer_usb` запущен (`ps | grep blazer`).

## Удаление

```sh
/etc/init.d/ups-manager stop
/etc/init.d/ups-manager disable
apk del luci-app-ups-manager
```

## Примечания

- Пакет собирается в SDK OpenWrt 25.12 (GitHub Actions). Установка на роутер и
  работа с UPS проверяются отдельно: если что-то не работает, пришлите вывод
  команд из раздела 5.
- Пароли для NUT создаёт скрипт `uci-defaults` при первой установке.
