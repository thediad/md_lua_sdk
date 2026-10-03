#!/bin/sh
set -eu

base=/data/genesis-dev/dev
sdk="$base/genesis/md_lua_sdk"
native="$base/native-toolchain-experiment"

action=${1:-}
shift

if [ "$#" -gt 1 ]; then
    echo "Usage: md$action [project-name-or-absolute-directory]" >&2
    exit 2
fi

if [ ! -f "$sdk/bin/mdlua.js" ]; then
    echo 'Genesis development volume is unavailable. Restore its existing mount first.' >&2
    exit 2
fi

if [ "$#" -eq 0 ]; then
    project="$sdk/examples/hello"
else
    case "$1" in
        /*) project=${1%/} ;;
        *[!a-zA-Z0-9_-]*|'')
            echo 'Use a simple project name or an absolute directory path.' >&2
            exit 2
            ;;
        *) project="$base/projects/$1" ;;
    esac
fi

manifest="$project/mdlua.json"

if [ -f "$manifest" ]; then
    cache=${MDEDIT_RESOLVE_CACHE:-/home/pico/.mdedit-resolved}
    fingerprint=$(sha256sum "$manifest")
    fingerprint=${fingerprint%% *}
    cached_manifest=
    cached_fingerprint=
    source=
    rom=
    if [ -f "$cache" ]; then
        {
            IFS= read -r cached_manifest || true
            IFS= read -r cached_fingerprint || true
            IFS= read -r source || true
            IFS= read -r rom || true
        } < "$cache"
    fi
    if [ "$cached_manifest" != "$manifest" ] ||
       [ "$cached_fingerprint" != "$fingerprint" ] ||
       [ -z "$source" ] || [ -z "$rom" ]; then
        cache_tmp="$cache.tmp.$$"
        trap 'rm -f "$cache_tmp"' EXIT HUP INT TERM
        node -e '
            const fs=require("fs"), path=require("path");
            const f=process.argv[1];
            const fingerprint=process.argv[2];
            const c=JSON.parse(fs.readFileSync(f,"utf8"));
            console.log(f);
            console.log(fingerprint);
            console.log(path.resolve(path.dirname(f), c.entry || "main.lua"));
            console.log(path.resolve(path.dirname(f), c.out || "game.bin"));
        ' "$manifest" "$fingerprint" > "$cache_tmp"
        mv "$cache_tmp" "$cache"
        trap - EXIT HUP INT TERM
        {
            IFS= read -r cached_manifest
            IFS= read -r cached_fingerprint
            IFS= read -r source
            IFS= read -r rom
        } < "$cache"
    fi
    manifest_build=1
else
    source="$project/main.lua"
    rom="$project/$(basename "$project").bin"
    manifest_build=0
fi

case "$action" in
    info)
        printf 'Source: %s\nROM: %s\nManifest: %s\n' "$source" "$rom" "$manifest"
        ;;
    edit)
        if [ ! -f "$source" ]; then
            echo "Source not found: $source" >&2
            exit 2
        fi
        export MDEDIT_SOURCE="$source" MDEDIT_ROM="$rom" MDEDIT_MANIFEST="$manifest"
        if [ "${MDEDIT_BASIC:-0}" = 1 ]; then exec nano "$source"; fi
        exec nano --rcfile "$native/mdedit.nanorc" "$source"
        ;;
    build)
        if [ ! -f "$source" ]; then
            echo "Source not found: $source" >&2
            exit 2
        fi
        if [ "$manifest_build" -eq 1 ]; then
            export MDLUA_NATIVE_TOOLCHAIN="$native/m68k-elf-armhf"
            export MDLUA_NATIVE_WORKDIR="$native"
            cd "$sdk"
            exec node bin/mdlua.js build --project "$manifest"
        fi
        exec sh "$native/build-native.sh" "$source" -o "$rom"
        ;;
    check)
        if [ ! -f "$source" ]; then
            echo "Source not found: $source" >&2
            exit 2
        fi
        cd "$sdk"
        if [ "$manifest_build" -eq 1 ]; then
            exec node bin/mdlua.js check --project "$manifest"
        fi
        exec node bin/mdlua.js check "$source"
        ;;
    play) exec sh "$base/picodrive-native/run.sh" "$rom" ;;
    *) echo 'Unknown Genesis action.' >&2; exit 2 ;;
esac
