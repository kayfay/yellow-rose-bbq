import http.server
import re
import socketserver
import urllib.request
import urllib.parse
import json

PORT = 8000
ROKU_IP = "192.168.1.100"
VALID_KEY_RE = re.compile(r"^[A-Za-z0-9_]{1,32}$")
BLOCKED_EXTENSIONS = (".env", ".db", ".sqlite", ".py", ".sh", ".csv", ".xlsx", ".tar.gz")


class ECPHandler(http.server.SimpleHTTPRequestHandler):
    def _is_forbidden_path(self) -> bool:
        parsed = urllib.parse.urlparse(self.path).path
        parts = [p for p in parsed.split("/") if p]
        if any(p.startswith(".") for p in parts):
            return True
        if parsed.lower().endswith(BLOCKED_EXTENSIONS):
            return True
        return False

    def do_GET(self):
        if self._is_forbidden_path():
            self.send_response(403)
            self.end_headers()
            return
        super().do_GET()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:8000")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/keypress":
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(min(content_length, 4096))

            try:
                payload = json.loads(post_data.decode("utf-8"))
                key_value = str(payload.get("key") or "")
                if not VALID_KEY_RE.match(key_value):
                    raise ValueError("Invalid key format")

                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:8000")
                self.send_header("Content-type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "key": key_value}).encode())
            except Exception:
                self.send_response(400)
                self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:8000")
                self.end_headers()
                self.wfile.write(b'{"status": "error"}')
        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), ECPHandler) as httpd:
        print(f"Serving ECP Key Dispatcher at 127.0.0.1:{PORT}")
        httpd.serve_forever()
