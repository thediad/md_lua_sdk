#!/bin/sh
set -eu
base=/data/genesis-dev/dev
tools="$base/native-toolchain-experiment"
case "${1:-}" in
    -h|--help)
        echo 'Usage: mdedit [--basic] [PROJECT_NAME_OR_ABSOLUTE_DIRECTORY]'
        echo '       mdedit --new NAME'
        echo 'F5 saves and suspends Nano; run mdrun to build and play.'
        echo 'F6 shows API help. F7 checks. F8 suspends for mdapi/mdlookup.'
        echo 'Ctrl+X exits Nano. --basic opens plain Nano without shortcuts.'
        exit 0 ;;
    --basic) export MDEDIT_BASIC=1; shift ;;
    --new)
        [ "$#" -eq 2 ] || { echo 'Usage: mdedit --new NAME' >&2; exit 2; }
        case "$2" in
            ''|[!a-z0-9]*|*[!a-z0-9_-]*) echo 'Use lowercase letters, digits, underscore or hyphen; start with a letter or digit.' >&2; exit 2 ;;
        esac
        [ -f "$base/genesis/md_lua_sdk/bin/mdlua.js" ] || { echo 'Mount the existing development volume first.' >&2; exit 2; }
        mkdir -p "$base/projects"
        project="$base/projects/$2"
        mkdir "$project" || { echo 'Project already exists or cannot be created; nothing overwritten.' >&2; exit 2; }
        cp "$tools/mdedit-template.lua" "$project/main.lua"
        set -- "$2"
        ;;
esac
state=/home/pico/.mdedit-project
if [ "$#" -eq 0 ]; then
    printf "%s\n" "hello" > "$state"
else
    printf "%s\n" "$1" > "$state"
fi
exec sh "$tools/genesis-step.sh" edit "$@"
