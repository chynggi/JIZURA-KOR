@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PORT=8766"
set "URL=http://127.0.0.1:%PORT%/"

rem 이미 실행 중이면 브라우저만 연다
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient).Connect('127.0.0.1', %PORT%) } catch { exit 1 }" >nul 2>nul && (
    echo 이미 실행 중입니다: %URL%
    start "" "%URL%"
    exit /b 0
)

set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY where python >nul 2>nul && set "PY=python"
if not defined PY (
    echo Python 3 을 찾을 수 없습니다. https://www.python.org/ 에서 설치해 주세요.
    pause
    exit /b 1
)

rem 서버는 별도 창에서 실행 - 그 창을 닫으면 서버가 종료된다
start "JIZURA server (닫으면 종료)" %PY% preview_server.py --port %PORT%
ping -n 3 127.0.0.1 >nul
start "" "%URL%"
