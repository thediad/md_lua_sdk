#!/bin/bash
set -u

base=${MDSTUDIO_BASE:-/data/genesis-dev/dev}
sdk=${MDLUA_SDK_DIR:-$base/genesis/md_lua_sdk}
native=${MDSTUDIO_NATIVE_DIR:-$base/native-toolchain-experiment}
step=$native/genesis-step.sh
editor=$native/mdedit-session.sh
build_log=${MDRUN_LOG:-/home/pico/.mdrun-last.log}
check_log=${MDCHECK_LOG:-/home/pico/.mdcheck-last.log}
projects_root=$base/projects
last_project_file=${MDSTUDIO_LAST_PROJECT:-/home/pico/.mdstudio-last-project}
if [ "$#" -gt 1 ]; then
    echo 'Usage: mdstudio [project-name-or-absolute-directory]' >&2
    exit 2
fi
project_label=${1:-hello}
project_args=()
if [ "$#" -eq 1 ]; then
    project_args=("$1")
elif [ -r "$last_project_file" ]; then
    IFS= read -r remembered_project < "$last_project_file" || remembered_project=
    if [ -n "$remembered_project" ] && [ -f "$remembered_project/mdlua.json" ]; then
        project_args=("$remembered_project")
        project_label=$(basename "$remembered_project")
    fi
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
project_directory=$(dirname "$manifest")
last_project_tmp="$last_project_file.tmp.$$"
if printf '%s\n' "$project_directory" > "$last_project_tmp"; then
    mv "$last_project_tmp" "$last_project_file"
else
    rm -f "$last_project_tmp"
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

preview_map() {
    local preview_log=/home/pico/.mdpreview-last.log
    printf '\nBuilding visual map inspector...\n'
    (cd "$(dirname "$manifest")" && \
        MDLUA_NATIVE_TOOLCHAIN="$native/m68k-elf-armhf" \
        MDLUA_NATIVE_WORKDIR="$native" \
        node "$sdk/bin/mdlua.js" preview map --project "$manifest") 2>&1 | tee "$preview_log"
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

preview_audio() {
    local preview_log=/home/pico/.mdpreview-last.log
    printf '\nBuilding audio audition ROM...\n'
    (cd "$(dirname "$manifest")" && \
        MDLUA_NATIVE_TOOLCHAIN="$native/m68k-elf-armhf" \
        MDLUA_NATIVE_WORKDIR="$native" \
        node "$sdk/bin/mdlua.js" preview audio --project "$manifest") 2>&1 | tee "$preview_log"
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

list_projects() {
    local found=0
    local project_manifest
    printf '\nAvailable projects:\n'
    for project_manifest in "$projects_root"/*/mdlua.json; do
        [ -f "$project_manifest" ] || continue
        found=1
        printf '  %s\n' "$(basename "$(dirname "$project_manifest")")"
    done
    if [ "$found" -eq 0 ]; then
        printf '  (none)\n'
    fi
}

valid_project_name() {
    case "$1" in
        *[!a-zA-Z0-9_-]*|'') return 1 ;;
        *) return 0 ;;
    esac
}

read_asset_path() {
    local prompt=$1
    local previous_directory=$PWD
    printf '%s' "$prompt"
    if ! cd "$project_directory"; then
        printf '\nUnable to open the project directory.\n'
        return 1
    fi
    IFS= read -e -r asset_path
    local read_status=$?
    cd "$previous_directory" || return 1
    [ "$read_status" -eq 0 ] && [ -n "$asset_path" ]
}

open_project() {
    local previous_directory=$PWD
    list_projects
    printf '\nProject name (blank cancels): '
    if ! cd "$projects_root"; then
        printf '\nUnable to open the projects directory.\n'
        pause_for_key
        return
    fi
    IFS= read -e -r open_name
    local read_status=$?
    cd "$previous_directory" || return
    [ "$read_status" -eq 0 ] || return
    open_name=${open_name%/}
    [ -n "$open_name" ] || return
    if ! valid_project_name "$open_name"; then
        printf '\nUse letters, numbers, underscore, or hyphen only.\n'
        pause_for_key
        return
    fi
    if [ ! -f "$projects_root/$open_name/mdlua.json" ]; then
        printf '\nProject not found: %s\n' "$open_name"
        pause_for_key
        return
    fi
    exec "$0" "$open_name"
}

new_project() {
    printf '\nNew project name (blank cancels): '
    IFS= read -r new_name || return
    [ -n "$new_name" ] || return
    if ! valid_project_name "$new_name"; then
        printf '\nUse letters, numbers, underscore, or hyphen only.\n'
        pause_for_key
        return
    fi
    mkdir -p "$projects_root"
    if (cd "$projects_root" && node "$sdk/bin/mdlua.js" init "$new_name"); then
        printf '\nProject created: %s\n' "$projects_root/$new_name"
        exec "$0" "$new_name"
    fi
    pause_for_key
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
            '11 Visual tile-map preview' \
            '12 Inspect audio assets' \
            '13 Inspect sprite variants' \
            '14 Audition music and SFX' \
            'B  Back'
        printf '\nChoice: '
        IFS= read -r asset_choice || return
        case "$asset_choice" in
            1) project_command show; pause_for_key ;;
            2)
                printf 'Type (sheet/map/gff/spriteVariants): '
                IFS= read -r asset_type || return
                read_asset_path 'Existing asset path: ' || return
                project_command set "$asset_type" "$asset_path"
                pause_for_key ;;
            3)
                printf 'Type (sheet/map/gff/spriteVariants): '
                IFS= read -r asset_type || return
                project_command unset "$asset_type"
                pause_for_key ;;
            4|6)
                [ "$asset_choice" = 4 ] && asset_type=music || asset_type=sfx
                read_asset_path "Existing $asset_type path: " || return
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
            11) preview_map || pause_for_key ;;
            12) inspect_command audio; pause_for_key ;;
            13) inspect_command variants; pause_for_key ;;
            14) preview_audio || pause_for_key ;;
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
        'N  New project' \
        'O  Open project' \
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
        n|N) new_project ;;
        o|O) open_project ;;
        q|Q|0) exit 0 ;;
        *) printf '\nUnknown choice.\n'; pause_for_key ;;
    esac
done
