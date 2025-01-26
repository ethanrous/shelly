#!/bin/zsh

if ! which brew &>/dev/null; then
    # Install homebrew
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Install git
    brew install git
fi

if [[ ! -e ~/.ssh/ ]]; then
    ssh-keygen -t ecdsa -b 521
    cat ~/.ssh/id_ecdsa.pub

    printf "\n\n Add above key to github...\n"
    read -sk1 "?Press any key when finished to continue: "
fi

if [[ ! -e ~/shelly ]]; then
    git clone git@github.com:ethanrous/shelly.git ~/shelly
fi

cd ~/shelly
source ./zsh/zsh_main
./zsh/setup.zsh
