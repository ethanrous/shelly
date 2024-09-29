#!/bin/zsh

if [ ! -f ~/.zshrc ]; then
    echo "Making ~/.zshrc"
    echo "source ~/shelly/zsh/zsh_main" > ~/.zshrc
fi

if [[ "$SHELLY" == "" ]]; then
    echo "\$SHELLY is not set, load the shelly environment first"
    exit 1
fi

if [ ! -d ~/.config ]; then
    echo "Making ~/.config"
    mkdir ~/.config
fi

rm -rf ~/.config/nvim
cp -r $SHELLY/nvim ~/.config/nvim

if [[ "$( ls -i ~/shelly/tmux/tmux.conf | awk '{print $1}' )" != "$( ls -i ~/.tmux.conf | awk '{print $1}' )" ]]; then
    echo "tmux.conf is not the same as the one in shelly, linking from shelly..."
    rm -f ~/.tmux.conf
    ln $SHELLY/tmux/tmux.conf ~/.tmux.conf
fi

if [ ! -f "~/.config/alacritty" ]; then
    mkdir -p ~/.config/alacritty
fi

if [[ "$( ls -i ~/shelly/alacritty/alacritty.toml | awk '{print $1}' )" != "$( ls -i ~/.config/alacritty/alacritty.toml | awk '{print $1}' )" ]]; then
    echo "alacritty.toml is not the same as the one in shelly, linking from shelly..."
    rm -f ~/.config/alacritty/alacritty.toml
    ln $SHELLY/alacritty/alacritty.toml ~/.config/alacritty/alacritty.toml
fi
