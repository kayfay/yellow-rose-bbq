import re

with open('index.html', 'r') as f:
    content = f.read()

# We want to insert the refresh block at the end of tab-forecasting-analytics.
# Let's find the closing div of tab-forecasting-analytics.
# Based on common structures, it's right before:   </div> <!-- End App Content -->
# Let's search for "End App Content"

refresh_html = """
      <!-- Bottom Refresh Frame -->
      <section class="control-card refresh-frame" style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem;">
        <div class="sync-status-container">
          <span class="sync-badge" style="background: var(--bg-highlight); padding: 4px 8px; border-radius: 4px;">Last Updated: <span id="last-updated-time">--</span></span>
        </div>
        <button id="btn-refresh-analytics" class="footer-btn btn-secondary" style="margin: 0;">
          <span class="btn-icon">↻</span>
          <span class="btn-text">Refresh Data</span>
        </button>
      </section>
"""

if "<!-- End App Content -->" in content:
    # Insert right before the last closing div of the tab.
    # Actually, let's just replace "    </div>\n\n  </div> <!-- End App Content -->"
    parts = content.split("    </div>\n\n  </div> <!-- End App Content -->")
    if len(parts) == 2:
        new_content = parts[0] + refresh_html + "\n    </div>\n\n  </div> <!-- End App Content -->" + parts[1]
        with open('index.html', 'w') as f:
            f.write(new_content)
        print("Success inserting refresh block!")
    else:
        print("Could not split properly.")
else:
    print("Could not find End App Content.")
