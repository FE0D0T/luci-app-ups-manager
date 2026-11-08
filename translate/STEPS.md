# Пошаговая установка (ручной вариант, любая ОС)

Используйте этот файл, если установщики (`installers/`) не работают. Все команды одинаковы для Windows (PowerShell или cmd с OpenSSH), macOS и Linux. Команды `scp` и `ssh` должны быть установлены.

Обозначения: `ROUTER` — IP роутера (например `192.168.1.1`). Папку `router` ниже берём из этого набора.

## Шаг 1. Подготовка компьютера

1. Откройте терминал: в Windows — PowerShell или cmd; в macOS — Terminal.
2. Перейдите в папку набора:
   - Windows: `cd "C:\путь\к\translate"`
   - macOS / Linux: `cd "/путь/к/translate"`
3. Проверьте, что файлы на месте:
   - Windows: `dir router`
   - macOS / Linux: `ls router`

   Должно быть 14 файлов, среди них `router-install.sh` и `ups-ru.tar.gz`.

## Шаг 2. Создать папку на роутере и скопировать файлы

```
ssh root@ROUTER "mkdir -p /tmp/ups-restore"
scp -O router/* root@ROUTER:/tmp/ups-restore/
```

Введите пароль root (символы не отображаются). При первом подключении введите `yes`.

Windows: в PowerShell используйте пути `router\*` (`scp -O router\* root@ROUTER:/tmp/ups-restore/`).

## Шаг 3. Установка перевода

```
ssh root@ROUTER "sh /tmp/ups-restore/router-install.sh"
```

Ожидаемо в конце: `УСПЕХ: перевод установлен.`

Если появилось `ВНИМАНИЕ`, проверьте: `grep -c 'Обзор' /usr/share/luci/menu.d/luci-app-ups-manager.json`. Если результат `1`, установка прошла.

## Шаг 4. Журнал событий на русском

```
ssh root@ROUTER "sh /tmp/ups-restore/router-journal-install.sh"
```

## Шаг 5. Вкладка «Звук»

```
ssh root@ROUTER "sh /tmp/ups-restore/router-beeper-install.sh"
```

## Шаг 6. Проверка

1. Откройте LuCI в браузере в режиме инкогнито.
2. Проверьте вкладки: «Обзор», «История», «Энергия», «Звук», «Качество сети».
3. На роутере: `upsc ups@127.0.0.1 ups.status` — ожидаемо `OL` (питание от сети).

Если меню китайское: `rm -rf /tmp/luci-indexcache /tmp/luci-modulecache/`.

## Откат

```
ssh root@ROUTER "sh /tmp/ups-restore/router-restore.sh"
ssh root@ROUTER "sh /tmp/ups-restore/router-journal-restore.sh"
ssh root@ROUTER "sh /tmp/ups-restore/router-beeper-restore.sh"
```

## Если что-то не работает

- `Permission denied` — неверный пароль root.
- `No such file or directory` — команда запущена не из папки `translate` (шаг 1).
- `ssh` или `scp` не найдены — включите OpenSSH Client (Windows) или установите OpenSSH (Linux).
- Служба зависает на `restart` — не используйте `restart`. Для перезапуска: `killall upsd upsdrvctl`, `kill -9 $(pgrep -f blazer_usb)`, затем `/etc/init.d/ups-manager start`.
- Драйвер UPS не запущен — проверьте `/etc/nut/ups.conf` и `logread | tail -n 20`. Драйвер и параметры UPS (`blazer_usb`, 0665:5161) должны быть установлены заранее по инструкции драйвера.

## Драйвер UPS (один раз, до установки)

На роутере:
```
apk update
apk add nut-driver-blazer_usb nut-upscmd
uci set ups_manager.ups.driver='blazer_usb'
uci set ups_manager.ups.vendorid='0665'
uci set ups_manager.ups.productid='5161'
uci set ups_manager.ups.port='auto'
uci set ups_manager.ups.nominal_power='450'
uci set ups_manager.ups.battery_capacity_ah='7'
uci set ups_manager.ups.inverter_efficiency='0.85'
uci set ups_manager.global.reuse_existing_nut='0'
uci commit ups_manager
/etc/init.d/nut-server stop
/etc/init.d/nut-server disable
/etc/init.d/nut-monitor stop
/etc/init.d/nut-monitor disable
```
