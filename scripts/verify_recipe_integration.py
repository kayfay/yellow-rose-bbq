import json
import sys
import re

def main():
    with open('app.js', 'r') as f:
        content = f.read()
    
    if "'mexican-chorizo': {" not in content:
        print("ERROR: mexican-chorizo recipe not found in app.js")
        sys.exit(1)
        
    with open('index.html', 'r') as f:
        html_content = f.read()
        
    if 'data-recipe="mexican-chorizo"' not in html_content:
        print("ERROR: mexican-chorizo pill not found in index.html")
        sys.exit(1)
        
    print("SUCCESS: Mexican Chorizo integrated cleanly.")
    sys.exit(0)

if __name__ == "__main__":
    main()
