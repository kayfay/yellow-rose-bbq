#!/bin/bash
python3 -m http.server 8011 --bind 127.0.0.1 &
SERVER_PID=$!
sleep 2
npx playwright test
kill -9 $SERVER_PID
