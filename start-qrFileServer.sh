#!/bin/bash
if [ -z "$1" ]; then
  echo "Usage: $0 path [--readonly] [path2 ... pathN]"
  exit 1
fi

export QR_FILE_SERVER_READONLY=false

export QR_FILE_SERVER_INPUT=""

# make a list of paths that is split with pipe and contained in angle brackets.
for path in "$@"; do
    case "$path" in  
      --readonly)
        QR_FILE_SERVER_READONLY=true
        ;;
    *)
        fullPath=$(echo -n "$(realpath "$path")" | base64)
        # Check if the realpath command succeeded
        if [ -z "$fullPath" ]; then
            echo Cannot get the full path of $path. Try entering the fullpath of that path instead.
            exit 1
        else
            QR_FILE_SERVER_INPUT+="<$fullPath>|"
        fi
        ;;
    esac
done

cd "$(dirname $(realpath "$0"))"

source venv/bin/activate
gunicorn -c qrFileServerConfig.py app:app
