#!/bin/bash
cat << 'PY_EOF' > local_server.py
from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys

class NoCacheHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if any(seg.startswith(".") for seg in self.path.split("/") if seg) or self.path.endswith((".env", ".db", ".sqlite")):
            self.send_response(403)
            self.end_headers()
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:8013")
        super().end_headers()

class ReusableServer(HTTPServer):
    allow_reuse_address = True

if __name__ == '__main__':
    server = ReusableServer(("127.0.0.1", 8013), NoCacheHandler)
    server.serve_forever()
PY_EOF

python3 local_server.py &
SERVER_PID=$!
trap 'kill -9 $SERVER_PID 2>/dev/null' EXIT INT TERM

# Wait for server to become ready
for i in {1..15}; do
  if python3 -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8013", timeout=1)' 2>/dev/null; then
    break
  fi
  sleep 0.3
done

CI=1 npx playwright test --reporter=list "$@"


