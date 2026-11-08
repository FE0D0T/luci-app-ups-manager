@echo off
rem Установка перевода и наработок UPS Manager на роутер OpenWrt (Windows 10/11).
rem Двойной щелчок по файлу. Нужен OpenSSH Client (Параметры - Приложения - Дополнительные компоненты).
chcp 65001 >nul
setlocal

set "ROUTER_DIR=%~dp0..\router"

where ssh >nul 2>nul || (echo ОШИБКА: ssh не найден. Включите OpenSSH Client в Параметрах Windows. & pause & exit /b 1)
where scp >nul 2>nul || (echo ОШИБКА: scp не найден. Включите OpenSSH Client в Параметрах Windows. & pause & exit /b 1)

if not exist "%ROUTER_DIR%\restore-all.sh" (
    echo ОШИБКА: не найдена папка router рядом с installers.
    pause
    exit /b 1
)

set /p ROUTER_IP=IP-адрес роутера (например 192.168.1.1):
if "%ROUTER_IP%"=="" (
    echo ОШИБКА: IP не введён.
    pause
    exit /b 1
)

echo.
echo [1/2] Создаю папку на роутере и копирую файлы. Введите пароль root.
ssh root@%ROUTER_IP% "mkdir -p /tmp/ups-restore"
scp -O "%ROUTER_DIR%\*" root@%ROUTER_IP%:/tmp/ups-restore/
if errorlevel 1 (
    echo ОШИБКА: не удалось скопировать файлы. Проверьте IP и пароль.
    pause
    exit /b 1
)

echo.
echo [2/2] Полное восстановление на роутере. Введите пароль root ещё раз.
ssh root@%ROUTER_IP% "sh /tmp/ups-restore/restore-all.sh"

echo.
echo Готово. Откройте LuCI в режиме инкогнито. Подробнее: RESTORE_ALL.md
pause
endlocal
