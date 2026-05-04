#!/bin/bash
# TalkwebSour — Mac 一键环境（Homebrew / Node / Python / npm install）
# 发行包已自带 third_party/agency-agents 与构建好的 src/agency，无需从 GitHub 拉取。
# 可选：复制 scripts/install.prefs.example 为 install.prefs（项目根）或 scripts/install.prefs，设 BUILD_AGENCY_AFTER_INSTALL=1 可在改上游后重建索引。
# 首次在 Finder 中双击若被拦截：右键 → 打开；或 系统设置 → 隐私与安全性 → 仍要打开。
# 若提示「无法执行」：在终端执行 chmod +x SourMac.command

echo "🚀 Setup starting..."
echo ""

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -x /usr/local/bin/brew ]]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "未检测到 Homebrew，将运行官方安装脚本（需本机管理员密码，按屏幕提示操作）。"
  echo ""
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "❌ 仍未检测到 brew。请根据 https://brew.sh 手动安装后，关闭终端再双击本脚本。"
  read -r -p "按 Enter 退出…"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "正在安装 Node.js…"
  brew install node
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "正在安装 Python 3…"
  brew install python@3.12 2>/dev/null || brew install python
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ 已安装 node 但未找到 npm，请检查 PATH 后重试。"
  read -r -p "按 Enter 退出…"
  exit 1
fi

echo "正在执行 npm install…"
npm install

echo "正在生成扩展用 bundle（IndexedDB 对话历史 / Mermaid 编辑器）…"
npm run build:quick-chat-history || echo "⚠ build:quick-chat-history 失败。"
npm run build:mermaid-editor || echo "⚠ build:mermaid-editor 失败。"

PREF_FILE="$DIR/install.prefs"
if [[ ! -f "$PREF_FILE" ]]; then
  PREF_FILE="$DIR/scripts/install.prefs"
fi
BUILD_AGENCY_AFTER_INSTALL=0
if [[ -f "$PREF_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PREF_FILE" 2>/dev/null || true
  set +a
fi

if [[ "${BUILD_AGENCY_AFTER_INSTALL:-0}" == "1" ]]; then
  echo "install.prefs: 正在执行 npm run build:agency…"
  npm run build:agency || echo "⚠ build:agency 失败。"
fi

echo ""
echo "✅ Done!（可选：npm run build:mermaid && npm run build:parse-ai；界面多语言 Agent 标题：npm run generate:agency-l10n，需联网）"
read -r -p "按 Enter 退出…"
