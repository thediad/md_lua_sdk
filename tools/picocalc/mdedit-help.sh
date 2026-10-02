#!/bin/sh
# Show API help for the identifier selected by Nano, preserving the selection.
set -u

sdk=${MDLUA_SDK_DIR:-/data/genesis-dev/dev/genesis/md_lua_sdk}
log=${MDEDIT_HELP_LOG:-/home/pico/.mdhelp-last.log}
cache=${MDEDIT_HELP_CACHE:-/data/genesis-dev/dev/native-toolchain-experiment/api-help-cache}
selection=$(mktemp /tmp/mdedit-help.XXXXXX)
trap 'rm -f "$selection"' EXIT HUP INT TERM
cat > "$selection"

query=$(tr -cd 'A-Za-z0-9_.' < "$selection")
key=$(printf '%s' "$query" | tr 'A-Z' 'a-z')
if [ -n "$key" ] && [ -f "$cache/$key.txt" ]; then
    cp "$cache/$key.txt" "$log"
elif [ -n "$query" ]; then
    node "$sdk/bin/mdapi.mjs" "$query" > "$log" 2>&1 || true
else
    printf '%s\n' 'No API identifier is under the cursor.' > "$log"
fi

if [ -c /dev/tty ] && ( : > /dev/tty ) 2>/dev/null; then
    printf '\033[2J\033[H' > /dev/tty
    while IFS= read -r line || [ -n "$line" ]; do
        printf '%s\r\n' "$line"
    done < "$log" > /dev/tty
    printf '\r\nReturning to Nano in 8 seconds...' > /dev/tty
    sleep 8
else
    cat "$log" >&2
fi

# Nano's pipe command replaces the selection with stdout. Return the exact
# original bytes; the binding then undoes this transient filter operation.
cat "$selection"
