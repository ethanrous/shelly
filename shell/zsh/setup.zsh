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

mkdir -p ~/.claude/skills
symlinkInto $SHELLY/claude/settings.json ~/.claude/settings.json
symlinkInto $SHELLY/claude/rules ~/.claude/rules
symlinkInto $SHELLY/claude/commands ~/.claude/commands
symlinkInto $SHELLY/claude/skills/vue-best-practices ~/.claude/skills/vue-best-practices
