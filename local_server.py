from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

class ReusableServer(HTTPServer):
    allow_reuse_address = True

if __name__ == '__main__':
    server = ReusableServer(("127.0.0.1", 8013), NoCacheHandler)
    server.serve_forever()
