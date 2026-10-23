#!/bin/bash
set -euo pipefail
qian_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$qian_root"
mkdir -p build
qian_developer=""
for qian_candidate in /Applications/Xcode*.app/Contents/Developer; do
  [ -d "$qian_candidate" ] || continue
  qian_sdk="$(DEVELOPER_DIR="$qian_candidate" xcrun --sdk iphoneos --show-sdk-version 2>/dev/null || true)"
  if /usr/bin/python3 - "$qian_sdk" <<'PY'
import sys
try:
    major, minor = (list(map(int, sys.argv[1].split('.'))) + [0])[:2]
    sys.exit(0 if (major, minor) >= (27, 1) else 1)
except Exception:
    sys.exit(1)
PY
  then qian_developer="$qian_candidate"; break; fi
done
if [ -z "$qian_developer" ]; then
  echo 'This source needs an Xcode installation containing the iOS 27.1 SDK or newer.'
  echo 'No matching installation was found. Choose a cloud image with that SDK; this is not a signing error.'
  ls -d /Applications/Xcode*.app 2>/dev/null || true
  exit 2
fi
export DEVELOPER_DIR="$qian_developer"
xcodebuild -version | tee build/toolchain.txt
xcrun --sdk iphoneos --show-sdk-version | tee -a build/toolchain.txt
xcodebuild -project ios/QianZhi.xcodeproj -scheme QianZhi -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO \
  build 2>&1 | tee build/ios-build.log
printf '%s\n' 'Unsigned simulator build only: this artifact cannot be installed on an iPhone.'
