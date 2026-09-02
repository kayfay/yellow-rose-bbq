import os

index_file = "index.html"
with open(index_file, 'r') as f:
    html = f.read()

meta_tags = """
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
"""

if "Cache-Control" not in html:
    html = html.replace("<head>", "<head>" + meta_tags)
    with open(index_file, 'w') as f:
        f.write(html)
    print("Added meta tags to index.html")
else:
    print("Meta tags already present")

