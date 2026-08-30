with open('app.js', 'r') as f:
    content = f.read()

target = """    categorySelector.addEventListener('change', () => {
      let currentDays = 14;
      if (categorySelector.value === 'baseline') {
          const activeBtn = document.querySelector('.forecast-preset-group .preset-btn.active');
          if (activeBtn) {
            if (activeBtn.id === 'btn-preset-sat-order' || activeBtn.id === 'btn-preset-thu-order') {
              currentDays = 2;
            } else if (activeBtn.id === 'btn-preset-mon-order') {
              currentDays = 3;
            }
          }
      }
      renderPlotlyForecastingChart(currentDays);
    });"""

replacement = """    categorySelector.addEventListener('change', () => {
      renderPlotlyForecastingChart(14);
    });"""

content = content.replace(target, replacement)

with open('app.js', 'w') as f:
    f.write(content)
print("dropdown fixed part 2.")
