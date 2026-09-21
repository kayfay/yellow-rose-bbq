      const traces = payload.plotly_weather_chart.data;
      // Add date indicators to the traces
      traces.forEach(trace => {
        if (trace.text && Array.isArray(trace.text)) {
          trace.hovertext = trace.text; // Move original HTML text to hovertext
          trace.text = trace.text.map(t => {
            const m = t.match(/<b>(.*?)<\/b>/);
            if (m) {
              const dateParts = m[1].split(', ');
              return dateParts.length > 1 ? dateParts[1].substring(5) : m[1]; // e.g. "07-30"
            }
            return '';
          });
          trace.mode = (trace.mode || 'markers') + '+text';
          trace.textposition = 'top center';
          trace.textfont = { color: 'rgba(255, 255, 255, 0.6)', size: 9 };
        }
      });
