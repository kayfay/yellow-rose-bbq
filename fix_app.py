import re

with open('app.js', 'r') as f:
    content = f.read()

# Make sure we add the deselect to btnSubtabShift
shift_listener_target = """    btnSubtabShift.addEventListener('click', () => {
      btnSubtabShift.classList.add('active');
      btnSubtabArima.classList.remove('active');
      btnSubtabWeather.classList.remove('active');
      btnSubtabEvent.classList.remove('active');
      if (viewShift) viewShift.style.display = 'block';
      if (viewArima) viewArima.style.display = 'none';
      if (viewWeather) viewWeather.style.display = 'none';
      if (viewEvent) viewEvent.style.display = 'none';
      const shiftSelector = document.getElementById('shift-selector');
      renderPlotlyShiftHeatmap(shiftSelector ? shiftSelector.value : 'all');
    });"""

shift_listener_replacement = """    btnSubtabShift.addEventListener('click', () => {
      btnSubtabShift.classList.add('active');
      btnSubtabArima.classList.remove('active');
      btnSubtabWeather.classList.remove('active');
      btnSubtabEvent.classList.remove('active');
      btnSubtabAdvanced.classList.remove('active');
      if (viewShift) viewShift.style.display = 'block';
      if (viewArima) viewArima.style.display = 'none';
      if (viewWeather) viewWeather.style.display = 'none';
      if (viewEvent) viewEvent.style.display = 'none';
      if (viewAdvanced) viewAdvanced.style.display = 'none';
      const shiftSelector = document.getElementById('shift-selector');
      renderPlotlyShiftHeatmap(shiftSelector ? shiftSelector.value : 'all');
    });
    
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
    });"""

content = content.replace(shift_listener_target, shift_listener_replacement)

with open('app.js', 'w') as f:
    f.write(content)
print("app.js fixed.")
