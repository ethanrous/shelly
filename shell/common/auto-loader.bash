#!/bin/bash

if [[ $SHELL_NAME == "" ]]; then
	echo "SHELL_NAME NOT SET, EXITING"
	return
fi

export SHELLY="${BASH_SOURCE[0]%/shelly/*}/shelly"

if [[ $SHELLY_DEBUG == "true" ]]; then
    echo "Set \$SHELLY to $SHELLY"
fi

count=0
for f in $SHELLY/shell/common/source/*; do
    ((count++))
    if [[ $SHELLY_DEBUG == "true" ]]; then
        echo "SOURCING $f"
    fi

    source $f
done

source $SHELLY/shell/$SHELL_NAME/main
((count++))

localHost=$(hostname)
machine_specific_path="$SHELLY/shell/common/machines/$localHost"
if [ ! -f $machine_specific_path ]; then
    printf "No config found for this \$HOST ($localHost). Create one? (y/[n])"
	read -n1 ans
	printf "\n"

    if [[ $ans == "y" ]]; then
        touch $machine_specific_path && echo "Created machine specific config at $machine_specific_path"
    fi
    sync
else
    if [[ $SHELLY_DEBUG == "true" ]]; then
        echo "SOURCING $machine_specific_path"
    fi

    source $machine_specific_path && ((count++))
fi


if [[ $SHELLY_DEBUG == "true" ]]; then
    echo "Sourced $count files"
fi
