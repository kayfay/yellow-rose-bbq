#!/bin/bash
cat << 'PY_EOF' > local_server.py
from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

if __name__ == '__main__':
    server = HTTPServer(("127.0.0.1", 8013), NoCacheHandler)
    server.serve_forever()
PY_EOF

python3 local_server.py &
SERVER_PID=$!
sleep 2
npx playwright test
kill -9 $SERVER_PID
rm local_server.py
