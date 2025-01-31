#!/bin/zsh

if [[ "$SHELLY" == "" ]]; then
    echo "\$SHELLY is not set, load the shelly environment first"
    exit 1
fi

# Make sure to source shelly when new shell is launched
if [ ! -f ~/.bashrc ]; then
    echo "making ~/.bashrc"

	echo "export SHELL_NAME=bash" > ~/.bashrc
    echo "source $SHELLY/shell/common/auto-loader.bash" >> ~/.bashrc
fi

isMac=false
if [[ "$(uname)" == "Darwin" ]]; then
    isMac=true
fi

if ! which cargo &>/dev/null; then
    echo "Installing Rust"
    curl https://sh.rustup.rs -sSf | sh
fi

# Install homebrew
if $isMac && ! which brew &>/dev/null; then
    echo "Installing homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    brew install eza btop neovim nvm wezterm ripgrep
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

tmuxName=tmux-$(uname).conf
tmuxPath=~/.config/tmux/tmux.conf
linkConfigFile $SHELLY/tmux/$tmuxName $tmuxPath

alacrittyName=alacritty-$(uname).toml
alacrittyPath=~/.config/alacritty/alacritty.toml
linkConfigFile $SHELLY/alacritty/$alacrittyName $alacrittyPath

weztermName=wezterm.lua
weztermPath=~/.config/wezterm/wezterm.lua
linkConfigFile $SHELLY/wezterm/$weztermName $weztermPath

if [[ $TMUX != "" ]]; then
    tmux source-file $tmuxPath
fi
