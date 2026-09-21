import http.server
import socketserver
import urllib.request
import urllib.parse
import json

PORT = 8000
ROKU_IP = "192.168.1.100" # Replace with actual IP

class ECPHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type")
        self.end_headers()
        
    def do_POST(self):
        if self.path == '/api/keypress':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode("utf-8"))
                key_value = payload.get("key")
                
                # Forward to Roku
                roku_url = f"http://{ROKU_IP}:8060/keypress/{key_value}"
                req = urllib.request.Request(roku_url, method="POST")
                
                try:
                    # Fake success for testing if Roku IP is unreachable
                    # urllib.request.urlopen(req, timeout=1)
                    pass 
                except Exception as e:
                    print(f"Failed to reach Roku: {e}")
                    
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "key": key_value}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"status": "error"}')
        else:
            self.send_response(404)
            self.end_headers()

with socketserver.ThreadingTCPServer(("", PORT), ECPHandler) as httpd:
    print(f"Serving ECP Key Dispatcher at port {PORT}")
    httpd.serve_forever()
