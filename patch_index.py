import re

with open('index.html', 'r') as f:
    content = f.read()

# 1. Add buttons
buttons_target = """          <button type="button" class="preset-btn" id="btn-subtab-event">Live Event Correlation</button>
        </div>"""
buttons_replacement = """          <button type="button" class="preset-btn" id="btn-subtab-event">Live Event Correlation</button>
          <button type="button" class="preset-btn" id="btn-subtab-advanced">Advanced Analytics</button>
        </div>"""

content = content.replace(buttons_target, buttons_replacement)

# 2. Add subtab content
target_content = """        <!-- Interactive Month-View Live Events & Multiplier Calendar -->"""

advanced_content = """
      <!-- TAB 4 VIEW: Advanced Analytics -->
      <div id="subtab-view-advanced" style="display: none;">
        <section class="control-card marketing-card">
          <h2 class="section-title">📊 Advanced Data Correlations</h2>
          <div>
            <h3>1. Market Basket Analysis (Top Pairings)</h3>
            <ul id="market-basket-list">
              <!-- populated by js -->
            </ul>
            
            <h3>2. Weather & Event Interaction</h3>
            <ul id="interaction-list">
               <!-- populated by js -->
            </ul>
            
            <h3>3. Order Type Segmentation</h3>
            <div id="order-type-list">
              <!-- populated by js -->
            </div>
            
            <h3>5. Cannibalization (Dino Ribs vs Pork Ribs)</h3>
            <ul id="cannibalization-list">
            </ul>
            
            <h3>6. Payday Effect</h3>
            <ul id="payday-list">
            </ul>
          </div>
        </section>

        <section class="chart-section">
          <h2 class="section-title">4. Sell-Out / Stock Depletion Prediction</h2>
          <div class="chart-card">
            <div id="plotly-sellout-chart"></div>
          </div>
        </section>
      </div>

        <!-- Interactive Month-View Live Events & Multiplier Calendar -->"""

content = content.replace(target_content, advanced_content)

with open('index.html', 'w') as f:
    f.write(content)
print("index.html patched.")
