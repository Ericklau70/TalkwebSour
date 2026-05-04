#!/usr/bin/env bash
# 拉取 agency-agents 到 third_party/agency-agents（无 engineering 目录时）
# 由 SourMac.command 调用；需网络。
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$DIR/third_party/agency-agents"

if [[ -d "$VENDOR/engineering" ]]; then
  echo "Agency 上游已存在（third_party/agency-agents），跳过下载。"
  exit 0
fi

echo "正在获取 agency-agents 上游（GitHub）…"
mkdir -p "$DIR/third_party"
rm -rf "$VENDOR"

if command -v git >/dev/null 2>&1; then
  if git clone --depth 1 "https://github.com/msitarzewski/agency-agents.git" "$VENDOR" && [[ -d "$VENDOR/engineering" ]]; then
    echo "✓ git clone 完成。"
    exit 0
  fi
  rm -rf "$VENDOR"
fi

TMPZ="$(mktemp /tmp/agency-agents.XXXXXX.zip)"
cleanup() { rm -f "$TMPZ"; }
trap cleanup EXIT

curl -fsSL -o "$TMPZ" "https://github.com/msitarzewski/agency-agents/archive/refs/heads/main.zip"
unzip -q "$TMPZ" -d "$DIR/third_party"
if [[ -d "$DIR/third_party/agency-agents-main" ]]; then
  mv "$DIR/third_party/agency-agents-main" "$VENDOR"
  echo "✓ ZIP 解压完成。"
  exit 0
fi

echo "❌ 未能布置 agency-agents（请检查网络）。"
exit 1
