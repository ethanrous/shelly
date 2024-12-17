#!/bin/zsh

if [ ! -f ~/.zshrc ]; then
    echo "making ~/.zshrc"
    echo "source ~/shelly/zsh/zsh_main" > ~/.zshrc
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

tmuxName="tmux-$(uname).conf"
if [[ "$( ls -i $SHELLY/tmux/$tmuxName | awk '{print $1}' )" != "$( ls -i ~/.config/tmux/tmux.conf | awk '{print $1}' )" ]]; then
    echo "tmux.conf is not the same as the one in shelly, linking from shelly..."
    rm -f ~/.config/tmux/tmux.conf
	mkdir -p ~/.config/tmux
    ln $SHELLY/tmux/$tmuxName ~/.config/tmux/tmux.conf
 
fi

if [[ ! -L ~/.config/alacritty ]] || [[ ! -e ~/.config/alacritty ]]; then
    rm -rf ~/.config/alacritty
    echo "Linking ~/.config/alacritty"
    ln -s $SHELLY/alacritty ~/.config/alacritty
fi

alacrittyName="alacritty-$(uname).toml"
if [[ "$( ls -i $SHELLY/alacritty/$alacrittyName | awk '{print $1}' )" != "$( ls -i ~/.config/alacritty/alacritty.toml | awk '{print $1}' )" ]]; then
    echo "Using $alacrittyName as alacritty config, linking..."
    rm -f ~/.config/alacritty/alacritty.toml
    ln $SHELLY/alacritty/$alacrittyName ~/.config/alacritty/alacritty.toml
fi

if [[ $TMUX != "" ]]; then
    tmux source-file ~/.tmux.conf
fi
