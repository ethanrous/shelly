#!/bin/bash

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

fi

brew install eza btop neovim nvm wezterm ripgrep gh

$SHELLY/shell/zsh/setup.zsh
$SHELLY/shell/bash/setup.bash
