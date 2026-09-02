import re

# 1. Update test_web_security_and_payloads.py with anti-caching and CORS headers
test_file = "clover_api/test_web_security_and_payloads.py"
with open(test_file, 'r') as f:
    content = f.read()

handler_code = """class QuietHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()
        
    def log_message(self, format, *args):
        pass"""

old_handler_code = """class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress HTTP server output logs during test run"""

if old_handler_code in content:
    content = content.replace(old_handler_code, handler_code)
    with open(test_file, 'w') as f:
        f.write(content)
    print("Added security headers to QuietHandler")

# 2. Update app.js fetches to include cache-busting and headers
app_js = "app.js"
if os.path.exists(app_js):
    with open(app_js, 'r') as f:
        app_content = f.read()
    
    # We won't blindly regex app.js if it's 88KB without seeing it, but we can check if it uses fetch
    pass

