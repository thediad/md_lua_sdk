#!/bin/sh
# Run mdlua check from Nano without inserting command output into the buffer.
set -u

sdk=${MDLUA_SDK_DIR:-/data/genesis-dev/dev/genesis/md_lua_sdk}
log=${MDEDIT_CHECK_LOG:-/home/pico/.mdcheck-last.log}
source=${MDEDIT_SOURCE:-}
manifest=${MDEDIT_MANIFEST:-}

if [ -z "$manifest" ] && [ -n "$source" ]; then
    candidate=$(dirname "$source")/mdlua.json
    if [ -f "$candidate" ]; then manifest=$candidate; fi
fi

if [ -n "$manifest" ] && [ -f "$manifest" ]; then
    set -- --project "$manifest"
elif [ -n "$source" ] && [ -f "$source" ]; then
    set -- "$source"
else
    printf '%s\n' 'mdedit check: editor source is unavailable.' > "$log"
    rc=2
    set --
fi

if [ "$#" -gt 0 ]; then
    node "$sdk/bin/mdlua-launch.mjs" check "$@" > "$log" 2>&1
    rc=$?
fi

if [ -t 0 ] && [ -w /dev/tty ]; then
    printf '\033[2J\033[H' > /dev/tty
    cat "$log" > /dev/tty
    printf '\nReturning to Nano in 6 seconds...' > /dev/tty
    sleep 6
else
    cat "$log" >&2
fi

exit "$rc"
