#!/usr/local/bin/python3

import sys
import urllib.parse

if len(sys.argv) > 1:
    toEncode = sys.argv[1]
    encoded = urllib.parse.quote(toEncode)
    print(encoded)
