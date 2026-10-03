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
manifest=$(sh "$step" info "${project_args[@]}" | sed -n 's/^Manifest: //p')
if [ -z "$manifest" ]; then
    echo 'Unable to resolve the project manifest.' >&2
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

project_command() {
    (cd "$(dirname "$manifest")" && node "$sdk/bin/mdlua.js" project "$@" --project "$manifest")
}

inspect_command() {
    (cd "$(dirname "$manifest")" && node "$sdk/bin/mdlua.js" inspect "$1" --project "$manifest")
}

preview_sheet() {
    local preview_log=/home/pico/.mdpreview-last.log
    printf '\nBuilding visual sheet inspector...\n'
    (cd "$(dirname "$manifest")" && \
        MDLUA_NATIVE_TOOLCHAIN="$native/m68k-elf-armhf" \
        MDLUA_NATIVE_WORKDIR="$native" \
        node "$sdk/bin/mdlua.js" preview sheet --project "$manifest") 2>&1 | tee "$preview_log"
    local rc=${PIPESTATUS[0]}
    if [ "$rc" -ne 0 ]; then return "$rc"; fi
    local preview_rom
    preview_rom=$(sed -n 's/^Preview ROM: //p' "$preview_log" | tail -n 1)
    if [ -z "$preview_rom" ] || [ ! -f "$preview_rom" ]; then
        echo 'Preview ROM path was not produced.' >&2
        return 1
    fi
    sh "$base/picodrive-native/run.sh" "$preview_rom"
}

asset_menu() {
    while true; do
        clear
        printf '%s\n' 'Project assets' '--------------'
        printf '%s\n' \
            '1  Show registered assets' \
            '2  Register one sheet/map/gff/spriteVariants file' \
            '3  Remove one sheet/map/gff/spriteVariants entry' \
            '4  Add music file' \
            '5  Remove music by number' \
            '6  Add SFX file' \
            '7  Remove SFX by number' \
            '8  Inspect sprite sheet' \
            '9  Inspect tile map' \
            '10 Visual sprite-sheet preview' \
            'B  Back'
        printf '\nChoice: '
        IFS= read -r asset_choice || return
        case "$asset_choice" in
            1) project_command show; pause_for_key ;;
            2)
                printf 'Type (sheet/map/gff/spriteVariants): '
                IFS= read -r asset_type || return
                printf 'Existing asset path: '
                IFS= read -r asset_path || return
                project_command set "$asset_type" "$asset_path"
                pause_for_key ;;
            3)
                printf 'Type (sheet/map/gff/spriteVariants): '
                IFS= read -r asset_type || return
                project_command unset "$asset_type"
                pause_for_key ;;
            4|6)
                [ "$asset_choice" = 4 ] && asset_type=music || asset_type=sfx
                printf 'Existing %s path: ' "$asset_type"
                IFS= read -r asset_path || return
                project_command add "$asset_type" "$asset_path"
                pause_for_key ;;
            5|7)
                [ "$asset_choice" = 5 ] && asset_type=music || asset_type=sfx
                project_command show
                printf '\n%s number to remove: ' "$asset_type"
                IFS= read -r asset_number || return
                project_command remove "$asset_type" "$asset_number"
                pause_for_key ;;
            8) inspect_command sheet; pause_for_key ;;
            9) inspect_command map; pause_for_key ;;
            10) preview_sheet || pause_for_key ;;
            b|B|0) return ;;
            *) printf '\nUnknown choice.\n'; pause_for_key ;;
        esac
    done
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
        '9  Project assets' \
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
        9|a|A) asset_menu ;;
        q|Q|0) exit 0 ;;
        *) printf '\nUnknown choice.\n'; pause_for_key ;;
    esac
done
