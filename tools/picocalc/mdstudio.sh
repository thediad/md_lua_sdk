#!/bin/bash
set -u

base=${MDSTUDIO_BASE:-/data/genesis-dev/dev}
sdk=${MDLUA_SDK_DIR:-$base/genesis/md_lua_sdk}
native=${MDSTUDIO_NATIVE_DIR:-$base/native-toolchain-experiment}
step=$native/genesis-step.sh
editor=$native/mdedit-session.sh
build_log=${MDRUN_LOG:-/home/pico/.mdrun-last.log}
check_log=${MDCHECK_LOG:-/home/pico/.mdcheck-last.log}
if [ "$#" -gt 1 ]; then
    echo 'Usage: mdstudio [project-name-or-absolute-directory]' >&2
    exit 2
fi
project_label=${1:-hello}
project_args=()
if [ "$#" -eq 1 ]; then
    project_args=("$1")
fi
if [ ! -r "$sdk/bin/mdlua.js" ] || [ ! -r "$step" ] || [ ! -r "$editor" ]; then
    echo 'Genesis development volume or MDStudio helpers are unavailable.' >&2
    exit 2
fi

pause_for_key() {
    printf '\nPress Enter to return to MDStudio...'
    IFS= read -r _unused
}

show_log() {
    local log=$1
    local label=$2
    if [ ! -s "$log" ]; then
        printf '\nNo %s log exists yet.\n' "$label"
        pause_for_key
        return
    fi
    if command -v less >/dev/null 2>&1; then
        less "$log"
    else
        cat "$log"
        pause_for_key
    fi
}

run_check() {
    printf '\nChecking project...\n'
    sh "$step" check "${project_args[@]}" 2>&1 | tee "$check_log"
    return ${PIPESTATUS[0]}
}

run_build() {
    printf '\nBuilding Genesis ROM with the native PicoCalc toolchain...\n'
    sh "$step" build "${project_args[@]}" 2>&1 | tee "$build_log"
    local rc=${PIPESTATUS[0]}
    if [ "$rc" -eq 0 ]; then
        printf 'Build complete.\n'
    fi
    return "$rc"
}

while true; do
    clear
    printf '%s\n' 'Mega Drive Lua Studio' '---------------------'
    printf 'Project: %s\n\n' "$project_label"
    printf '%s\n' \
        '1  Edit code (Ctrl+X returns)' \
        '2  Check project' \
        '3  Build ROM' \
        '4  Build and run' \
        '5  API help' \
        '6  Last build log' \
        '7  Project information' \
        '8  Last check log' \
        'Q  Quit'
    printf '\nChoice: '
    if ! IFS= read -r choice; then
        exit 0
    fi
    case "$choice" in
        1|e|E) sh "$editor" "${project_args[@]}" ;;
        2|c|C) run_check; pause_for_key ;;
        3|b|B) run_build; pause_for_key ;;
        4|r|R)
            if run_build; then
                sh "$step" play "${project_args[@]}"
            else
                pause_for_key
            fi ;;
        5|h|H) node "$sdk/bin/mdapi-browser.mjs" ;;
        6|l|L) show_log "$build_log" build ;;
        7|p|P) sh "$step" info "${project_args[@]}"; pause_for_key ;;
        8) show_log "$check_log" check ;;
        q|Q|0) exit 0 ;;
        *) printf '\nUnknown choice.\n'; pause_for_key ;;
    esac
done
