# Контекст для ИИ-ассистента: UPS Manager на OpenWrt, наработки и установка

Этот файл отправьте ИИ-ассистенту, чтобы он понимал всю картину проекта. Файл самодостаточный.

## 1. Что за проект

- **Пакет:** `luci-app-ups-manager` (LuCI-приложение, автор Gilbert Liu & Contributors, лицензия GPL-2.0-or-later).
- **Назначение:** мониторинг ИБП (UPS) через NUT на OpenWrt: статус, напряжения, заряд, нагрузка, история, энергия, журнал событий, уведомления, автоотключение роутера, звук ИБП.
- **Исходный пакет:** интерфейс китайский. Мы перевели его на русский и добавили новые функции.
- **Бэкенд:** shell-скрипты (`/usr/bin/ups-manager-daemon`, `/usr/libexec/rpcd/luci.ups-manager`, `/etc/init.d/ups-manager`). UI — JavaScript-виды LuCI в `/www/luci-static/resources/view/ups-manager/`.

## 2. Окружение пользователя

- **Роутер:** NanoPi R3S, OpenWrt 25.12.5, `aarch64_generic`, target `rockchip/armv8`. Пакетный менеджер `apk` (не opkg).
- **Доступ:** IP `192.168.1.1`, пользователь `root`, SSH (dropbear). Шелл — BusyBox (ash): нет `od`, `cat -A`, `timeout`, `find -delete`, `ps -o`.
- **Компьютер пользователя:** macOS (zsh). Нужны также Windows-установщики (пользователь может использовать любую ОС).
- **SSH-клиент пользователя:** Termix. При вставке многострочного текста с приглашением `root@OpenWrt:~#` shell выполняет строки вывода как команды — вставлять только команды.
- **UPS:** Greencell UPSLP480 (Line Interactive, 750 VA, 12 В), USB `0665:5161` (чип Cypress/Megatec). Драйвер NUT: `blazer_usb` (используем). `nutdrv_qx` не отдаёт `input.frequency`, поэтому не используем.

## 3. Наработки

### 3.1 Перевод и верстка
- 10 видов LuCI и вкладка «Звук» переведены на русский (словарь ~411 строк).
- Русское меню (12 пунктов). Меню переведено в `root/usr/share/luci/menu.d/` проекта; `.
- Цвета и поля для тёмной темы Proton2025: используются CSS-переменные темы (`--text-color-high`, `--background-color-low`, `--text-color-highest`).
- Верстка для телефона (узкий экран < 600 px): кнопки, строки таблиц, заголовки.
- Полоска заряда: зелёная > 50 %, жёлтая 21–50 %, красная ≤ 20 %, толщина 12 px, обводка.

### 3.2 Исправления
- Слово `null` на «Качестве сети» (`quality.js`).
- Кодировка: в `rpcd` были повреждённые байты в китайских названиях. Исправлено, диагностика переведена.
- Демон: `local` вне функций вызывал ошибку BusyBox («not in a function») и блокировал блок энергии. Убрано.
- Init-скрипт не пишет `battery.voltage.*` в `ups.conf`: `blazer_usb` такие параметры не принимает (ошибка «not a valid variable name»). Пороги батареи реализованы через RPC.

### 3.3 Журнал событий на русском
- Демон и init-скрипт пишут новые записи в `/tmp/log/ups-manager/ops_events.tsv` на русском. Старые записи остаются китайскими.
- Уведомления (`ups-manager-notify`, мессенджеры, Webhook) пока не переведены.


### 3.4 Расчёт заряда батареи по напряжению
- Формула производителя (взята из официального приложения GreenCell, код не копировался): `заряд = 100·(U − Ulow)/(Uhigh − Ulow)`, где `Ulow = 0.915·12 = 10.98 В`, `Uhigh = 1.05·12 = 12.60 В`, с ограничением 0–100 %.
- RPC `get_status` отдаёт `battery_charge_calc`. Страницы «Обзор» и «История» используют его.
- Пороги задаются UCI: `battery_voltage_low`, `battery_voltage_high` (по умолчанию 10.98 и 12.60).
- Драйвер `blazer_usb` сам считает `battery.charge` по шкале 10.4 / 13.0 (занижает). Поэтому для отображения используется расчёт по напряжению.

### 3.5 Время работы батареи (оценка)
- Драйвер не отдаёт `battery.runtime`. Оценка в RPC: `ёмкость(Ач) × 12 × заряд × КПД / мощность_нагрузки`, поле `battery_runtime_est` (секунды).
- Параметры UCI: `battery_capacity_ah` (7), `inverter_efficiency` (0.85), `nominal_power` (450 Вт). Значение 7 Ач типичное, точное нужно с этикетки батареи.
- Учитывает нагрузку (`ups.load`) в реальном времени, но не учитывает эффект Пекерта и старение батареи.

### 3.6 История (график)
- Сырые точки: `history.csv`, опрос каждые 3 с, ~1 час (ограничено 1200 строками). Используется для 1 и 6 часов.
- Минутные агрегаты: `history_1m.csv`, сутки (1440 строк). Поля: `ts, v, vo, c, l, p, ob, vmin, obc` (`vmin` — минимум входного напряжения за минуту, `obc` — число опросов на батарее за минуту).
- RPC `get_history` с параметром `range`: `raw` или `minute`.
- График: пунктирная линия минимума напряжения, оранжевые отметки минут с батареей.
- Файлы в tmpfs `/tmp/run/ups-manager/`, флеш не изнашивается.

### 3.7 Энергия
- Демон интегрирует мощность: `today_wh`, `month_wh`, сброс при смене даты и месяца. Файл `/tmp/run/ups-manager/energy.json` (пишется раз в минуту).
- Пик и среднее за сутки — по `history_1m.csv`.
- Страница «Энергия»: Втч, если значение < 0.01 кВтч.
- Пропадает при перезагрузке роутера (tmpfs).

### 3.8 Вкладка «Звук» (управление звуком ИБП)
- Команда NUT `beeper.toggle` от пользователя `admin` (пароль из UCI `ups_manager.nut_service.admin_password`). Скрипт сначала читает `ups.beeper.status` и отправляет `toggle` только при несовпадении, затем проверяет результат.
- Режимы: «Обычный режим», «Выключить звук» (однократно), «Выключить постоянно», «Расписание» (время выключения и включения; время — системное время роутера, переход через полночь поддерживается).
- Статус цветом: зелёный — звук включён, оранжевый — выключен, красный — выключен постоянно. В режиме расписания — «Расписание (сейчас включён/выключен)».
- Скрипт `/usr/bin/ups-manager-beeper`: `status`, `set on|off`, `enforce`, `schedule-now`. Запускается вторым процессом службы каждые 2 минуты.
- При сохранении режима (`set_beeper_mode`) RPC сразу запускает `enforce` в фоне, поэтому выключение по расписанию происходит за секунды, а не через 2 минуты.
- Скрипт пишет в журнал только при переключении состояния. Отсутствие новых строк означает, что состояние уже совпадает с расписанием.
- Проверено на устройстве: расписание 22:00–10:00 выключает звук; при `disabled` и питании от сети UPS молчит.

### 3.9 Прочее
- На «Качестве сети» автообновление не сделано (по просьбе пользователя откатили). Кнопка «Обновить данные» показывает уведомление.

## 4. Технические нюансы (чтобы ИИ не наступил на грабли)

- **Перезапуск службы:** `/etc/init.d/ups-manager restart` зависает. Использовать: `killall upsd upsdrvctl`, `kill -9 $(pgrep -f blazer_usb)`, `rm -f /var/run/nut/blazer_usb-ups*`, затем `/etc/init.d/ups-manager start > /tmp/ups-start.log 2>&1 &`.
- **Демон:** после копирования нового кода процесс работает со старым. Перезапуск: `kill <PID ups-manager-daemon>` (procd поднимет новый).
- **`reuse_existing_nut` = 0** обязательно, иначе `ups.conf` не обновляется.
- **Системные `nut-server` и `nut-monitor` отключены** (конфликтуют с пакетом).
- **`uci_get` в rpcd:** при отсутствии опции возвращает пусто, а не значение по умолчанию. Дефолты задавать явно: `[ -n "$x" ] || x=...`.
- **`jsonfield_arg` (rpcd):** stdin читается один раз в переменную, иначе второй и третий аргументы будут пустыми.
- **`local` в демоне:** только внутри функций (`uci_get`, `uci_get_energy_val`, `log_event`, `get_field`). В основном цикле `local` даёт ошибку BusyBox.
- **BusyBox:** работают `echo -n`, `printf`, `awk`, `sed`; нет `od`, `cat -A`, `timeout`, `find -delete`, `ps -o`.
- **Арифметика `10#` не работает в ash (BusyBox).** Вместо `$((10#$h))` использовать `sed 's/^0*//'` (см. `to_min` в `ups-manager-beeper`). Из-за этого расписание раньше всегда показывало «включён».
- **Вставка в Termix:** только команды, без приглашения и вывода.
- **Heredoc в составных командах** инструмента на Mac иногда не выполняется: создавать скрипты отдельным файлом.
- **Драйвер `blazer_usb`:** допустимые параметры см. `/lib/nut/blazer_usb -L`. `battery.voltage.low/high` в `ups.conf` недопустимы.
- **Проверка перед выдачей пользователю:** `sh -n` для shell, `osascript -l JavaScript` (JavaScriptCore) для JS, так как node на Mac может отсутствовать.

## 5. Установка через папку translate

Структура:
```
tools/
├── README.md          ← краткая инструкция
├── STEPS.md           ← пошагово, ручной вариант
├── AI_CONTEXT.md      ← этот файл
├── installers/
│   ├── install-windows.bat   ← Windows (двойной щелчок)
│   └── install-mac.sh        ← macOS / Linux (bash install-mac.sh)
├── router/            ← 14 файлов для роутера, плоский список
├── htdocs/            ← переведённые виды
└── root/              ← русское меню
```

### Предусловия
1. Роутер OpenWrt 25.x с чистым пакетом `luci-app-ups-manager` (проект `install.sh`).
2. Компьютер с OpenSSH (Windows: «Параметры → Приложения → Дополнительные компоненты → OpenSSH Client»).
3. Пароль root и IP роутера.
4. UPS подключён по USB.

### Шаг A. Драйвер UPS (один раз)
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
/etc/init.d/nut-server stop; /etc/init.d/nut-server disable
/etc/init.d/nut-monitor stop; /etc/init.d/nut-monitor disable
```

### Шаг B. Копирование на роутер (с компьютера, из папки translate)
```
ssh root@192.168.1.1 "mkdir -p /tmp/ups-restore"
scp -O router/* root@192.168.1.1:/tmp/ups-restore/
```
Или запустить `tools/installers/install-mac.sh` / `installers/install-windows.bat`, которые делают то же самое.

### Шаг C. Установка на роутере
```
sh /tmp/ups-restore/router-install.sh          # перевод интерфейса и меню
sh /tmp/ups-restore/router-journal-install.sh  # журнал на русском
sh /tmp/ups-restore/router-beeper-install.sh   # вкладка «Звук» и её служба
```

### Шаг D. Демон и RPC (история, энергия, расчёт батареи)
```
cp /tmp/ups-restore/ups-manager-daemon /usr/bin/ups-manager-daemon && chmod 755 /usr/bin/ups-manager-daemon
cp /tmp/ups-restore/luci.ups-manager /usr/libexec/rpcd/luci.ups-manager && chmod 755 /usr/libexec/rpcd/luci.ups-manager
```
Затем перезапустить демон: `kill $(pgrep -f ups-manager-daemon)` (procd поднимет новый), `/etc/init.d/rpcd reload`.

### Шаг E. Проверка
- `upsc ups@127.0.0.1 ups.status` → `OL` (питание от сети).
- `ubus call luci.ups-manager get_status | grep battery_charge_calc` → число.
- `tail -n 1 /tmp/run/ups-manager/history_1m.csv` → 9 полей (через минуту после старта демона).
- `cat /tmp/run/ups-manager/energy.json` → есть `today_wh`.
- LuCI (инкогнито): «Обзор», «История» (24 часа), «Энергия», «Звук», «Качество сети».
- Если меню китайское: `rm -rf /tmp/luci-indexcache /tmp/luci-modulecache/`.

### Откат
```
sh /tmp/ups-restore/router-restore.sh
sh /tmp/ups-restore/router-journal-restore.sh
sh /tmp/ups-restore/router-beeper-restore.sh
```
Оригиналы: `/root/ups-manager-zh-backup`, `/root/luci-app-ups-manager.json.zh-backup`, `/root/ups-manager-journal-zh-backup`, `/root/ups-manager-beeper-backup`.

## 6. Ограничения и открытые вопросы

- Расписание звука (раздел 3.8) проверено на 22:00–10:00 (выключение работает). Включение утром (~10:00) ещё не подтверждено.

- Данные истории и энергии в tmpfs: пропадают при перезагрузке. Сохранение на флеш — отдельная задача (редкая запись, например раз в час).
- Точность времени работы зависит от ёмкости батареи (нужна реальная цифра).
- Пороги батареи (10.98 / 12.60) взяты из официального приложения, не измерены у пользователя.
- Уведомления (мессенджеры) не переведены полностью, Telegram-канала в пакете нет.
- Windows-установщик не проверялся (нет Windows для теста).
- Лицензия: GPL-2.0-or-later. Код закрытого приложения GreenCell не переносится в проект (только формулы и параметры).

## 7. Как пользоваться этим файлом

Отправьте файл ИИ с запросом, например:
- «Помоги установить пакет по AI_CONTEXT.md на роутер 192.168.1.1, шаги A–E».
- «Найди причину: <вставить вывод logread или ubus>».
- «Добавь функцию X, учитывая разделы 3–4».

Перед правками кода учитывайте раздел 4 и проверяйте синтаксис (`sh -n`, JavaScriptCore) до выдачи пользователю.

- Полоски и подписи в тёмной теме исправлены по скриншотам пользователя.
