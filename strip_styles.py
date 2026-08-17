import re

with open('index.html', 'r') as f:
    content = f.read()

# Split the content to isolate the tab-forecasting-analytics section
start_marker = '<div id="tab-forecasting-analytics"'
end_marker = '</div>\n    </div>\n\n  </div> <!-- End App Content -->'
# Wait, let's find a reliable way to isolate it.
parts = content.split('id="tab-forecasting-analytics"')
if len(parts) == 2:
    prefix = parts[0] + 'id="tab-forecasting-analytics"'
    analytics_content = parts[1]
    
    # Strip style="..." using regex
    # Be careful not to remove style="display: none;" from the top-level tab, though that's fine since JS handles it, but let's keep it if it's the very first tag.
    stripped_content = re.sub(r'\sstyle="[^"]*"', '', analytics_content)
    
    new_content = prefix + stripped_content
    with open('index.html', 'w') as f:
        f.write(new_content)
    print("Stripped inline styles from analytics section.")
else:
    print("Could not find tab-forecasting-analytics uniquely.")
