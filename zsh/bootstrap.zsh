#!/bin/zsh

echo "BOOTSTRAPPING SEHLLY"

if ! which brew &>/dev/null; then
    # Install homebrew
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Install git
    brew install git
fi

if [[ ! -e ~/.ssh/ ]]; then
    mkdir -p ~/.ssh/
    ssh-keygen -t ecdsa -b 521 -f $HOME/.ssh/id_ecdsa -N ""
    printf "\n"
    cat ~/.ssh/id_ecdsa.pub
    printf "\n"
    read -sk1 "?Add above key to Github. Press any key when finished to continue... "
    printf "\n"
fi

if [[ ! -e ~/shelly ]]; then
    git clone git@github.com:ethanrous/shelly.git ~/shelly
fi

printf "BOOTSTRAPPING COMPLETE. To complete shelly setup:\n\n$ source ~/shelly/zsh/zsh_main && ~/shelly/zsh/setup.zsh\n\n"
