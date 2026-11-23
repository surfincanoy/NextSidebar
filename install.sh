#!/usr/bin/env bash
# 安装扩展到用户目录；源码在本仓库外，这里只做复制
set -euo pipefail
cd "$(dirname "$0")"
DEST="$HOME/.local/share/gnome-shell/extensions/nextsidebar@github.com"
rm -rf "$DEST/src"
mkdir -p "$DEST/src" "$DEST/schemas"
cp extension.js prefs.js metadata.json stylesheet.css "$DEST/"
cp src/*.js "$DEST/src/"
cp -r icons "$DEST/"
cp schemas/*.xml "$DEST/schemas/"
glib-compile-schemas "$DEST/schemas"
echo "已安装到 $DEST"
