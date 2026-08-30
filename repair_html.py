with open('index.html', 'r') as f:
    content = f.read()

start_marker = "      <!-- TAB 4 VIEW: Advanced Analytics -->"
end_marker = "        <!-- Interactive Month-View Live Events & Multiplier Calendar -->"

idx_start = content.find(start_marker)
idx_end = content.find(end_marker)

if idx_start != -1 and idx_end != -1:
    advanced_block = content[idx_start:idx_end]
    content = content[:idx_start] + content[idx_end:]
    
    insert_marker = "      <!-- Bottom Refresh Frame -->"
    idx_insert = content.find(insert_marker)
    
    content = content[:idx_insert] + advanced_block + "\n" + content[idx_insert:]
    
    with open('index.html', 'w') as f:
        f.write(content)
    print("index.html repaired!")
else:
    print("Markers not found!")
