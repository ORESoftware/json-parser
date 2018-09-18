#!/usr/bin/env bash

set -e;

if [ "$skip_postinstall" == "yes" ]; then
    echo "skipping postinstall routine.";
    exit 0;
fi

export FORCE_COLOR=1;
export skip_postinstall="yes";

