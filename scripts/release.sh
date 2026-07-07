#!/usr/bin/env bash
# NexOps 一键发布脚本
# 用法:
#   ./scripts/release.sh              # 读取 package.json 中的版本号自动发布
#   ./scripts/release.sh v0.5         # 指定版本号发布
#   ./scripts/release.sh v0.5 --draft # 创建草稿 Release（不公开）
#
# 依赖: git, gh (GitHub CLI), node
set -euo pipefail

# ─── 颜色输出 ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[info]${NC} $*"; }
success() { echo -e "${GREEN}[ok]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $*"; }
die()     { echo -e "${RED}[err]${NC}  $*" >&2; exit 1; }

# ─── 参数解析 ──────────────────────────────────────────────────────────────────
VERSION="${1:-}"
DRAFT_FLAG=""
for arg in "$@"; do
  [[ "$arg" == "--draft" ]] && DRAFT_FLAG="--draft"
done

# 没有传版本号时从 package.json 读取
if [[ -z "$VERSION" || "$VERSION" == "--draft" ]]; then
  VERSION="v$(node -p "require('./package.json').version")"
fi

# 确保版本号以 v 开头
[[ "$VERSION" == v* ]] || VERSION="v${VERSION}"

# ─── 环境检查 ──────────────────────────────────────────────────────────────────
command -v git >/dev/null || die "git 未安装"
command -v gh  >/dev/null || die "gh (GitHub CLI) 未安装，请先执行: gh auth login"
gh auth status >/dev/null 2>&1 || die "GitHub CLI 未登录，请先执行: gh auth login"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$(pwd)")"
cd "$REPO_ROOT"

# ─── 检查 git 仓库 ─────────────────────────────────────────────────────────────
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  info "初始化 git 仓库..."
  git init
  git branch -M main
fi

# ─── 检查远程仓库 ──────────────────────────────────────────────────────────────
GITHUB_USER=$(gh api user --jq '.login' 2>/dev/null || die "无法获取 GitHub 用户名")
REPO_NAME=$(node -p "require('./package.json').name" 2>/dev/null || echo "nexops")
REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

if ! git remote get-url origin >/dev/null 2>&1; then
  # 尝试创建远程仓库
  REPO_DESC=$(node -p "require('./package.json').description" 2>/dev/null || echo "Modern SSH workspace")
  if gh repo view "${GITHUB_USER}/${REPO_NAME}" >/dev/null 2>&1; then
    info "远程仓库已存在: ${GITHUB_USER}/${REPO_NAME}"
  else
    info "创建 GitHub 仓库: ${GITHUB_USER}/${REPO_NAME}"
    gh repo create "${REPO_NAME}" \
      --public \
      --description "${REPO_DESC}" \
      --source=. \
      --remote=origin \
      --push=false
  fi
  git remote add origin "$REMOTE_URL" 2>/dev/null || git remote set-url origin "$REMOTE_URL"
  success "远程仓库: $REMOTE_URL"
fi

# ─── 检查是否已存在该 Tag ──────────────────────────────────────────────────────
if git tag -l | grep -q "^${VERSION}$"; then
  die "Tag ${VERSION} 已存在，请先删除: git tag -d ${VERSION}"
fi

# ─── 构建 ──────────────────────────────────────────────────────────────────────
info "运行构建 (npm run build)..."
npm run build
success "构建完成"

# ─── 提取当前版本 CHANGELOG ────────────────────────────────────────────────────
CHANGELOG_BODY=""
if [[ -f CHANGELOG.md ]]; then
  # 提取当前版本的 changelog 段落（从本版本标题到下一个版本标题之间）
  CHANGELOG_BODY=$(awk "/^## \[${VERSION}\]/{found=1; next} found && /^## \[/{exit} found{print}" CHANGELOG.md)
fi

if [[ -z "$CHANGELOG_BODY" ]]; then
  warn "CHANGELOG.md 中未找到 ${VERSION} 的条目，Release Notes 将为空"
  CHANGELOG_BODY="请查看 [CHANGELOG.md](CHANGELOG.md) 了解详细变更。"
fi

# ─── Git 提交 ──────────────────────────────────────────────────────────────────
info "暂存并提交所有变更..."
git add -A

if git diff --cached --quiet; then
  warn "没有新的变更需要提交"
else
  git commit -m "release: ${VERSION}

$(echo "$CHANGELOG_BODY" | head -20)"
  success "已提交"
fi

# ─── 打 Tag ────────────────────────────────────────────────────────────────────
info "创建 Tag: ${VERSION}"
git tag -a "${VERSION}" -m "Release ${VERSION}"
success "Tag 已创建"

# ─── 推送 ──────────────────────────────────────────────────────────────────────
info "推送到 GitHub..."
git push -u origin main --follow-tags
success "代码已推送"

# ─── 创建 GitHub Release ───────────────────────────────────────────────────────
RELEASE_TITLE="NexOps ${VERSION}"
RELEASE_NOTES="$(cat <<EOF
${CHANGELOG_BODY}

---
**完整变更日志：** https://github.com/${GITHUB_USER}/${REPO_NAME}/blob/main/CHANGELOG.md
EOF
)"

info "创建 GitHub Release: ${RELEASE_TITLE}"
gh release create "${VERSION}" \
  --title "${RELEASE_TITLE}" \
  --notes "${RELEASE_NOTES}" \
  ${DRAFT_FLAG}

RELEASE_URL=$(gh release view "${VERSION}" --json url --jq '.url')
echo ""
success "发布完成！"
echo -e "  ${CYAN}Release URL:${NC} ${RELEASE_URL}"
echo -e "  ${CYAN}仓库地址:${NC}    https://github.com/${GITHUB_USER}/${REPO_NAME}"
