from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys

class NoCacheHandler(SimpleHTTPRequestHandler):
    BLOCKED_EXTENSIONS = (
        ".env", ".db", ".sqlite", ".csv", ".xlsx", ".xls", ".enc",
        ".tar.gz", ".zip", ".7z", ".bak", ".orig", ".py", ".sh", ".log"
    )
    BLOCKED_DIRS = {"data", "backups", "backup_db", "archive", "agent", ".loop"}

    def do_GET(self):
        parts = [seg for seg in self.path.split("?")[0].split("/") if seg]
        if any(seg in self.BLOCKED_DIRS or seg.startswith(".") for seg in parts) or self.path.split("?")[0].lower().endswith(self.BLOCKED_EXTENSIONS):
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
