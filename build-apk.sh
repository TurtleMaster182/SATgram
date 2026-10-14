#!/usr/bin/env bash
set -euo pipefail
# A dependency-free Android SDK build. Run after installing platform 35 and build-tools 35.0.0.
project_dir="$(cd "$(dirname "$0")" && pwd)"
sdk_dir="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [[ -z "$sdk_dir" ]]; then echo 'Set ANDROID_SDK_ROOT to the Android SDK directory.' >&2; exit 1; fi
tools_dir="${SATFLOW_BUILD_TOOLS:-$sdk_dir/build-tools/35.0.0}"
platform_jar="${SATFLOW_ANDROID_JAR:-$sdk_dir/platforms/android-35/android.jar}"
out_dir="$project_dir/app/build/manual"
mkdir -p "$out_dir/classes" "$out_dir/dex" "$project_dir/app/src/main/assets"
for filename in index.html style.css app.js core.js practice.json official-index.json icon.svg manifest.webmanifest; do
 cp "$project_dir/dist/$filename" "$project_dir/app/src/main/assets/$filename"
done
"$tools_dir/aapt" package -f -M "$project_dir/app/src/main/AndroidManifest.xml" -S "$project_dir/app/src/main/res" -A "$project_dir/app/src/main/assets" -I "$platform_jar" -F "$out_dir/resources.apk"
if command -v javac >/dev/null 2>&1; then
 javac -encoding UTF-8 -source 8 -target 8 -classpath "$platform_jar" -d "$out_dir/classes" "$project_dir/app/src/main/java/dev/satflow/app/MainActivity.java"
elif [[ -n "${SATFLOW_ECJ:-}" ]]; then
 java -jar "$SATFLOW_ECJ" -encoding UTF-8 -source 8 -target 8 -classpath "$platform_jar" -d "$out_dir/classes" "$project_dir/app/src/main/java/dev/satflow/app/MainActivity.java"
else
 echo 'Install a JDK (javac) before building.' >&2; exit 1
fi
mapfile -t class_files < <(find "$out_dir/classes" -name '*.class' -print)
"$tools_dir/d8" --lib "$platform_jar" --min-api 26 --output "$out_dir/dex" "${class_files[@]}"
cp "$out_dir/resources.apk" "$out_dir/unsigned.apk"
python3 - "$out_dir" <<'PY'
import sys,zipfile,pathlib
p=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(p/'unsigned.apk','a',zipfile.ZIP_DEFLATED) as z:
 for f in (p/'dex').glob('*.dex'):z.write(f,f.name)
PY
"$tools_dir/zipalign" -f -p 4 "$out_dir/unsigned.apk" "$out_dir/aligned.apk"
keystore_path="${SATFLOW_KEYSTORE:-$project_dir/app/build/satflow-debug.keystore}"
if [[ ! -f "$keystore_path" ]]; then
 keytool -genkeypair -keystore "$keystore_path" -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Android Debug,O=SATflow,C=US'
fi
"$tools_dir/apksigner" sign --ks "$keystore_path" --ks-pass pass:android --ks-key-alias androiddebugkey --out "$project_dir/dist/SATflow.apk" "$out_dir/aligned.apk"
"$tools_dir/apksigner" verify --verbose "$project_dir/dist/SATflow.apk"
"$tools_dir/aapt" dump badging "$project_dir/dist/SATflow.apk" | head -n 5
echo "Built $project_dir/dist/SATflow.apk"
