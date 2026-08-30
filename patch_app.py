import re

with open('app.js', 'r') as f:
    content = f.read()

# 1. Add elements
elements_target = """  const btnSubtabShift = document.getElementById('btn-subtab-shift');
  const viewShift = document.getElementById('subtab-view-shift');"""
elements_replacement = """  const btnSubtabShift = document.getElementById('btn-subtab-shift');
  const viewShift = document.getElementById('subtab-view-shift');
  
  const btnSubtabAdvanced = document.getElementById('btn-subtab-advanced');
  const viewAdvanced = document.getElementById('subtab-view-advanced');"""

content = content.replace(elements_target, elements_replacement)

# 2. Modify condition
cond_target = """if (btnSubtabArima && btnSubtabWeather && btnSubtabEvent && btnSubtabShift) {"""
cond_replacement = """if (btnSubtabArima && btnSubtabWeather && btnSubtabEvent && btnSubtabShift && btnSubtabAdvanced) {"""
content = content.replace(cond_target, cond_replacement)

# 3. Add to existing events
def add_deactivations(match):
    return match.group(0) + """
      btnSubtabAdvanced.classList.remove('active');
      if (viewAdvanced) viewAdvanced.style.display = 'none';"""

content = re.sub(r"btnSubtabShift\.classList\.remove\('active'\);\n\s+if \(viewShift\) viewShift\.style\.display = 'none';", add_deactivations, content)
content = re.sub(r"btnSubtabShift\.classList\.remove\('active'\);\n\s+if \(viewEvent\) viewEvent\.style\.display = 'block';", 
                 "btnSubtabAdvanced.classList.remove('active');\n      " + r"btnSubtabShift.classList.remove('active');\n      if (viewEvent) viewEvent.style.display = 'block';", content)

# I'll just write a simpler string replacement
content = content.replace("btnSubtabShift.classList.remove('active');", "btnSubtabShift.classList.remove('active');\n      btnSubtabAdvanced.classList.remove('active');")
content = content.replace("if (viewShift) viewShift.style.display = 'none';", "if (viewShift) viewShift.style.display = 'none';\n      if (viewAdvanced) viewAdvanced.style.display = 'none';")

# 4. Add new event for btnSubtabAdvanced
new_event = """
    btnSubtabAdvanced.addEventListener('click', () => {
      btnSubtabAdvanced.classList.add('active');
      btnSubtabArima.classList.remove('active');
      btnSubtabWeather.classList.remove('active');
      btnSubtabEvent.classList.remove('active');
      btnSubtabShift.classList.remove('active');
      if (viewAdvanced) viewAdvanced.style.display = 'block';
      if (viewArima) viewArima.style.display = 'none';
      if (viewWeather) viewWeather.style.display = 'none';
      if (viewEvent) viewEvent.style.display = 'none';
      if (viewShift) viewShift.style.display = 'none';
      renderAdvancedAnalytics();
    });
"""

content = content.replace("  }\n\n  // Forecast Category Dropdown", new_event + "  }\n\n  // Forecast Category Dropdown")

# 5. Add renderAdvancedAnalytics
render_fn = """
window.renderAdvancedAnalytics = function() {
  const payload = window.BBQ_PAYLOADS.advanced_payload;
  if (!payload) return;

  // 1. Market Basket
  const basketList = document.getElementById('market-basket-list');
  if (basketList) {
    basketList.innerHTML = payload.market_basket.map(item => `<li><strong>${item.pair}</strong>: Bought together ${item.count} times (${item.confidence}% confidence)</li>`).join('');
  }

  // 2. Interaction Modeling
  const interList = document.getElementById('interaction-list');
  if (interList) {
    interList.innerHTML = `
      <li><strong>Normal Day Avg:</strong> $${payload.interaction_modeling.normal.toFixed(2)}</li>
      <li><strong>Jaguars Game (Ideal Weather):</strong> $${payload.interaction_modeling.game_only.toFixed(2)}</li>
      <li><strong>Heavy Rain (No Event):</strong> $${payload.interaction_modeling.rain_only.toFixed(2)}</li>
      <li><strong>Jaguars Game + Heavy Rain:</strong> $${payload.interaction_modeling.game_and_rain.toFixed(2)}</li>
    `;
  }

  // 3. Order Type
  const orderTypeList = document.getElementById('order-type-list');
  if (orderTypeList) {
    orderTypeList.innerHTML = `<ul>` + payload.order_type_segmentation.map(ot => 
      `<li><strong>${ot.order_type}:</strong> ${ot.order_count} orders, $${ot.avg_ticket.toFixed(2)} avg ticket</li>`
    ).join('') + `</ul>`;
  }

  // 5. Cannibalization
  const cannList = document.getElementById('cannibalization-list');
  if (cannList) {
    cannList.innerHTML = `
      <li><strong>Avg Pork Ribs without Dino Ribs:</strong> ${payload.cannibalization.pork_ribs_avg_without_dino}</li>
      <li><strong>Avg Pork Ribs with Dino Ribs:</strong> ${payload.cannibalization.pork_ribs_avg_with_dino}</li>
      <li><strong>Impact on Pork Ribs:</strong> ${payload.cannibalization.impact_pct}%</li>
    `;
  }

  // 6. Payday
  const paydayList = document.getElementById('payday-list');
  if (paydayList) {
    paydayList.innerHTML = `
      <li><strong>Normal Avg Ticket:</strong> $${payload.payday_effect.normal_avg_ticket.toFixed(2)}</li>
      <li><strong>Payday Avg Ticket:</strong> $${payload.payday_effect.payday_avg_ticket.toFixed(2)}</li>
    `;
  }

  // 4. Sell-Out Chart
  if (document.getElementById('plotly-sellout-chart')) {
    Plotly.newPlot('plotly-sellout-chart', payload.sell_out_prediction_chart.data, payload.sell_out_prediction_chart.layout, {responsive: true, displayModeBar: false});
  }
};
"""
content = content + render_fn

with open('app.js', 'w') as f:
    f.write(content)
print("app.js patched.")
