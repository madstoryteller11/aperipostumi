#!/usr/bin/env bash
set -e
echo "Avvio locale AperiPost(umi) v0.3.1 beta"
(sleep 2; xdg-open "http://localhost:8086/?build=0.3.1-pages-beta" >/dev/null 2>&1 || true) &
python3 -m http.server 8086 --directory www
