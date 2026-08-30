import re

with open('index.html', 'r') as f:
    content = f.read()

insights_html = """
        <section class="control-card marketing-card" style="margin-bottom: 20px;">
          <h2 class="section-title">💡 Executive Insights Summary</h2>
          <div class="insight-content" style="line-height: 1.6; color: #cbd5e1; padding: 10px 0;">
            <p style="margin-bottom: 12px;"><strong>1. Sell-Out / Stock Depletion Trajectory</strong><br>
            &bull; <strong>The "Taco Rush":</strong> <em>Crispy Quesa Taco Brisket</em> is a volume monster. Trajectory is flat until 2:00 PM, spikes violently, and climbs through 9:00 PM (a heavy dinner item).<br>
            &bull; <strong>Ribs are for Dinner:</strong> <em>Full Rack Pork Spare Ribs</em> register almost no sales before 4:00 PM, selling entirely during the dinner rush.<br>
            &bull; <strong>No Early Sell-Outs:</strong> Crucially, none of the curves go completely flat before 9:00 PM. This means the restaurant is successfully prepping enough to meet demand through closing time without leaving money on the table.</p>

            <p style="margin-bottom: 12px;"><strong>2. Cannibalization (Dino Ribs vs. Pork Ribs)</strong><br>
            Offering <strong>Beef Dino Ribs</strong> as a special definitively cannibalizes normal <strong>Pork Spare Rib</strong> sales, dropping average daily racks sold from <strong>6.2</strong> to <strong>3.9</strong> (-37%). Prep targets for pork should be intentionally reduced on Dino Rib days to prevent waste.</p>

            <p style="margin-bottom: 12px;"><strong>3. Order Type Segmentation</strong><br>
            &bull; <strong>Dine-in (~$44 avg ticket):</strong> Primarily individuals or couples buying single plates and sandwiches.<br>
            &bull; <strong>In-Store Pickup (~$62) & To-Go (~$50):</strong> Higher tickets driven by "Family Meals" (buying meat by the pound to feed a household).</p>

            <p style="margin-bottom: 12px;"><strong>4. Weather & Event Interactions</strong><br>
            While rain kills walk-in traffic (dropping revenue from ~$4.9k to ~$3.4k), <strong>Game Days</strong> trigger massive spikes up to <strong>~$17.3k</strong>. Even if it rains on a Game Day, revenue stays incredibly high (~$13.8k) as customers simply pivot to To-Go orders for watch parties.</p>

            <p><strong>5. The "Payday" Myth</strong><br>
            There is virtually no difference in ticket size between Payday weekends ($44.92) and normal days ($45.91). Yellow Rose BBQ acts as a steady, reliable comfort food staple rather than a transient "payday splurge."</p>
          </div>
        </section>
"""

# Insert right after <div id="subtab-view-advanced" style="display: none;">
target = '<div id="subtab-view-advanced" style="display: none;">'
replacement = target + "\n" + insights_html

if insights_html not in content:
    content = content.replace(target, replacement)
    # bump cache
    content = re.sub(r'v=20260826_11', 'v=20260826_12', content)

    with open('index.html', 'w') as f:
        f.write(content)
    print("index.html patched with insights.")
else:
    print("Insights already present.")
