#!/bin/bash
# 自动上传小程序：更新版本号 → 上传
# 用法: bash scripts/upload.sh 3.2.7 "描述"

VERSION=$1
DESC=${2:-"update"}

if [ -z "$VERSION" ]; then
  echo "用法: bash scripts/upload.sh <版本号> [描述]"
  exit 1
fi

# 自动替换首页版本号
sed -i '' "s/· v[0-9]*\.[0-9]*\.[0-9]*/· v${VERSION}/" miniprogram/pages/index/index.wxml

# 上传
npx miniprogram-ci upload \
  --appid wx6afd6434f348034d \
  --pp . \
  --pkp /Users/qingfengjianke/.miniprogram/private.wx6afd6434f348034d.key \
  -r 1 --uv "$VERSION" -d "$DESC" \
  --enable-es6 --enable-es7

echo "✅ v${VERSION} 已上传"
