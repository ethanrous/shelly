#!/bin/zsh

# Make sure to source shelly when new shell is launched
if [ ! -f ~/.zshrc ]; then
    echo "making ~/.zshrc"

	echo "export SHELL_NAME=zsh" > ~/.zshrc
    echo "source $SHELLY/shell/zsh/zsh_main" >> ~/.zshrc
fi

if [[ "$SHELLY" == "" ]]; then
    echo "\$SHELLY is not set, load the shelly environment first"
    exit 1
fi

if [ ! -d ~/.config ]; then
    echo "making ~/.config"
    mkdir ~/.config
fi

rm -rf ~/.config/nvim
ln -s $SHELLY/nvim ~/.config/nvim

linkConfigFile() {
    src=$1
    dest=$2

    if [[ ! -e $dest ]] || [[ "$(/bin/ls -i $src | awk '{print $1}')" != "$(/bin/ls -i $dest | awk '{print $1}')" ]]; then
        echo "Linking $dest..."
        rm -f $dest
        mkdir -p $(dirname $dest)
        ln $src $dest

    fi
}

weztermName=wezterm.lua
weztermPath=~/.config/wezterm/wezterm.lua
linkConfigFile $SHELLY/wezterm/$weztermName $weztermPath

# Claude Code config: replace each item under ~/.claude with a symlink into the
# repo. Runtime state (sessions/, history.jsonl, projects/ which contains
# memory, plugins/, etc.) is deliberately left alone.
symlinkInto() {
    src=$1
    dest=$2

    if [[ -L $dest ]] && [[ "$(readlink $dest)" == "$src" ]]; then
        return
    fi
    echo "Symlinking $dest -> $src"
    rm -rf $dest
    mkdir -p $(dirname $dest)
    ln -s $src $dest
}

symlinkInto $SHELLY/claude/settings.json ~/.claude/settings.json
symlinkInto $SHELLY/claude/CLAUDE.md ~/.claude/CLAUDE.md
symlinkInto $SHELLY/claude/commands ~/.claude/commands

# Pi config: link the user-editable files under ~/.pi/agent into the repo.
# Runtime state (auth.json, models-store.json, mcp-*.json, sessions/, missions/,
# npm/, bin/, run-history.jsonl) is deliberately left alone.
symlinkInto $SHELLY/pi/settings.json ~/.pi/agent/settings.json
symlinkInto $SHELLY/pi/AGENTS.md ~/.pi/agent/AGENTS.md
symlinkInto $SHELLY/pi/mcp.json ~/.pi/agent/mcp.json
symlinkInto $SHELLY/pi/models.json ~/.pi/agent/models.json
symlinkInto $SHELLY/pi/keybindings.json ~/.pi/agent/keybindings.json
symlinkInto $SHELLY/pi/hermes-memory-config.json ~/.pi/agent/hermes-memory-config.json
symlinkInto $SHELLY/pi/web-search.json ~/.pi/agent/web-search.json
symlinkInto $SHELLY/pi/pi-blackhole-config.json ~/.pi/agent/pi-blackhole/pi-blackhole-config.json
symlinkInto $SHELLY/pi/extensions ~/.pi/agent/extensions
symlinkInto $SHELLY/pi/skills ~/.pi/agent/skills
symlinkInto $SHELLY/claude/skills ~/.claude/skills
