@echo off
:: 用法: publish.bat "提交信息"
:: 示例: publish.bat "feat: add database client"

cd /d C:\1\nexops

set MSG=%~1
if "%MSG%"=="" (
    echo [ERROR] 请提供提交信息
    echo 用法: publish.bat "feat: your message"
    pause
    exit /b 1
)

echo [INFO] 提交: %MSG%
git add .
git commit -m "%MSG%"

echo [INFO] 推送到 GitHub...
git push origin main

if errorlevel 1 (
    echo [ERROR] 推送失败，请检查网络或 GitHub 登录状态
    pause
    exit /b 1
)

echo.
echo [OK] 已发布: %MSG%
