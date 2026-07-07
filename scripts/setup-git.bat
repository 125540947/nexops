@echo off
echo ==========================================
echo  NexOps - Git 初始化 + GitHub 发布
echo ==========================================

cd /d C:\1\nexops

:: 检查 git
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未找到 git，请先安装 Git: https://git-scm.com
    pause
    exit /b 1
)

:: 检查 gh
gh --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未找到 GitHub CLI，请先安装: https://cli.github.com
    pause
    exit /b 1
)

:: 检查登录
gh auth status >nul 2>&1
if errorlevel 1 (
    echo [INFO] 未登录 GitHub，正在登录...
    gh auth login
)

:: 初始化 git
if not exist ".git" (
    echo [INFO] 初始化 Git 仓库...
    git init
    git branch -M main
)

:: 首次提交
git add .
git status --short
git commit -m "feat: initial NexOps project - SSH terminal, SFTP, batch ops" 2>nul

:: 创建 GitHub 仓库并推送
echo [INFO] 创建 GitHub 仓库 nexops ...
gh repo create nexops --public --source=. --remote=origin --push

echo.
echo ==========================================
echo  完成！仓库已发布到 GitHub
echo ==========================================
gh repo view --web
pause
