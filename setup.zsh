#!/bin/zsh

if [ ! -f "~/.zshrc" ]; then
    touch ~/.zshrc
    echo "source ~/shelly/zsh_main" > ~/.zshrc
    source ~/shelly/zsh_main
fi