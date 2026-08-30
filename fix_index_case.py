with open('index.html', 'r') as f:
    content = f.read()

target = '<li><strong>Brisket:</strong> 1 brisket/cryovac &rarr; <strong>2 briskets/case</strong> (~30 lbs).</li>'
replacement = '<li><strong>Brisket:</strong> 1 brisket/cryovac &rarr; <strong>5 briskets/case</strong> (~70 lbs).</li>'

if target in content:
    content = content.replace(target, replacement)
    with open('index.html', 'w') as f:
        f.write(content)
    print("index.html updated to 5 briskets/case")
else:
    print("Target not found in index.html")
