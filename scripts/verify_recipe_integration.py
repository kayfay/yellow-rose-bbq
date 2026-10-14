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

    # Verify that all pepper and bbq-rub spices include gramEq in app.js
    spice_matches = re.findall(r"\{\s*id:\s*'(?:pepper|bbq-rub)'[^}]+\}", content)
    assert len(spice_matches) > 0, "No spices found"
    for match in spice_matches:
        if 'gramEq:' not in match:
            print(f"ERROR: Missing gramEq in spice definition: {match}")
            sys.exit(1)
        
    print(f"SUCCESS: Mexican Chorizo and {len(spice_matches)} spice gram equivalents integrated cleanly.")
    sys.exit(0)

if __name__ == "__main__":
    main()
