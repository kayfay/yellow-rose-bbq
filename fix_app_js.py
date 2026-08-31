import re

with open("app.js", "r") as f:
    content = f.read()

target = """    // Match the active selected date
    let matchedRecord = records.find(r => r.date === targetDateInput);
    if (!matchedRecord) {
      matchedRecord = records.find(r => r.day_name === shortDayStr) || records[0];
    }

    const startIndex = records.findIndex(r => r.date === targetDateInput);
    const validStartIndex = startIndex >= 0 ? startIndex : 0;
    const slicedRecords = records.slice(validStartIndex, validStartIndex + daysCount);

    const catSelector = document.getElementById('category-selector');
    const selectedCat = catSelector ? catSelector.value : 'baseline';

    const bRaw = matchedRecord.brisket_raw_lbs || 0;
    const bCooked = Math.round(bRaw * 0.4);
    const pRaw = matchedRecord.pork_shoulder_raw_lbs || 0;
    const pCooked = Math.round(pRaw * 0.4);
    const totalRaw = Math.round(bRaw + pRaw);
    const totalCooked = bCooked + pCooked;

    let insightStr = '';
    if (matchedRecord.is_historical) {
      insightStr = `Historical Record for ${matchedRecord.day_name} (${matchedRecord.date}): The pit moved ~${bRaw.toFixed(1)} lbs raw brisket (~${bCooked} lbs cooked yield) and ~${pRaw.toFixed(1)} lbs raw pork shoulder (~${pCooked} lbs cooked yield) [~${totalRaw} lbs total raw / ~${totalCooked} lbs total cooked meat]. Actual verified line items sold included ${matchedRecord.tacos_sold} Tacos and ${matchedRecord.rosebuds_sold} Rosebuds, driving $${matchedRecord.actual_revenue.toLocaleString()} in gross revenue.`;
    } else {
      insightStr = `The forecast for ${matchedRecord.day_name} (${matchedRecord.date}) dictates prepping ~${bRaw.toFixed(1)} lbs raw brisket (~${bCooked} lbs cooked yield) and ~${pRaw.toFixed(1)} lbs raw pork shoulder (~${pCooked} lbs cooked yield) [~${totalRaw} lbs total raw / ~${totalCooked} lbs total cooked meat]. Because brisket and pork lose ~60% of their weight during the long smoke, and composed items like Tacos (${matchedRecord.tacos_sold} projected) and Rosebuds (${matchedRecord.rosebuds_sold} projected) pull directly from this yield, prepping these exact amounts mathematically ensures we hit our target sell-out time right at 9:00 PM closing.`;
    }"""

replacement = """    // Match the active selected date
    let matchedRecord = records.find(r => r.date === targetDateInput);
    if (!matchedRecord) {
      // Calculate an average for that day of the week based on history.
      const histDays = records.filter(r => r.day_name === shortDayStr && r.is_historical);
      
      if (histDays.length > 0) {
        // Filter out outliers using IQR on predicted_revenue
        const revs = histDays.map(r => r.predicted_revenue || 0).sort((a, b) => a - b);
        const q1 = revs[Math.floor((revs.length / 4))];
        const q3 = revs[Math.ceil((revs.length * (3 / 4))) - 1];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        const validDays = histDays.filter(r => (r.predicted_revenue || 0) >= lowerBound && (r.predicted_revenue || 0) <= upperBound);
        const daysToAverage = validDays.length > 0 ? validDays : histDays;
        
        // Calculate averages
        matchedRecord = {
          date: targetDateInput,
          day_name: shortDayStr,
          is_historical: false,
          is_fallback_average: true,
          predicted_revenue: daysToAverage.reduce((sum, r) => sum + (r.predicted_revenue || 0), 0) / daysToAverage.length,
          brisket_raw_lbs: daysToAverage.reduce((sum, r) => sum + (r.brisket_raw_lbs || 0), 0) / daysToAverage.length,
          pork_shoulder_raw_lbs: daysToAverage.reduce((sum, r) => sum + (r.pork_shoulder_raw_lbs || 0), 0) / daysToAverage.length,
          sausage_lbs: daysToAverage.reduce((sum, r) => sum + (r.sausage_lbs || 0), 0) / daysToAverage.length,
          tacos_sold: Math.round(daysToAverage.reduce((sum, r) => sum + (r.tacos_sold || 0), 0) / daysToAverage.length),
          rosebuds_sold: Math.round(daysToAverage.reduce((sum, r) => sum + (r.rosebuds_sold || 0), 0) / daysToAverage.length),
          pork_ribs_racks: daysToAverage.reduce((sum, r) => sum + (r.pork_ribs_racks || 0), 0) / daysToAverage.length,
          beef_dino_ribs: daysToAverage.reduce((sum, r) => sum + (r.beef_dino_ribs || 0), 0) / daysToAverage.length,
          actual_revenue: daysToAverage.reduce((sum, r) => sum + (r.actual_revenue || 0), 0) / daysToAverage.length
        };

        // Factor in live events
        const JAGS_HOME_GAMES = ["2026-09-13", "2026-09-27", "2026-10-18", "2026-11-01", "2026-11-22", "2026-12-06", "2026-12-20"];
        const HARDCODED_HOLIDAYS = ["2026-01-01", "2026-05-25", "2026-07-04", "2026-09-07", "2026-11-26", "2026-12-25", "2027-01-01", "2027-05-31", "2027-07-04", "2027-09-06", "2027-11-25", "2027-12-25"];
        
        let eventMultiplier = 1.0;
        let eventStr = '';
        if (JAGS_HOME_GAMES.includes(targetDateInput)) {
           eventMultiplier = 3.5; 
           eventStr = 'Jaguars Game';
        } else if (HARDCODED_HOLIDAYS.includes(targetDateInput)) {
           eventMultiplier = 0.7;
           eventStr = 'Holiday';
        }

        // Factor in weather
        let weatherMultiplier = 1.0;
        let weatherStr = '';
        try {
           const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=30.3322&longitude=-81.6557&daily=temperature_2m_max,precipitation_sum&timezone=America/New_York&start_date=${targetDateInput}&end_date=${targetDateInput}`);
           if (weatherRes.ok) {
             const weatherData = await weatherRes.json();
             if (weatherData.daily && weatherData.daily.precipitation_sum && weatherData.daily.precipitation_sum[0] > 10.0) {
                 weatherMultiplier = 1.21;
                 weatherStr = 'Heavy Rain';
             } else if (weatherData.daily && weatherData.daily.temperature_2m_max && weatherData.daily.temperature_2m_max[0] > 90.0) {
                 weatherMultiplier = 0.942;
                 weatherStr = 'Extreme Heat';
             }
           }
        } catch (e) {
           console.log("Could not fetch weather for fallback average");
        }

        const totalMultiplier = eventMultiplier * weatherMultiplier;
        if (totalMultiplier !== 1.0) {
            matchedRecord.predicted_revenue *= totalMultiplier;
            matchedRecord.brisket_raw_lbs *= totalMultiplier;
            matchedRecord.pork_shoulder_raw_lbs *= totalMultiplier;
            matchedRecord.sausage_lbs *= totalMultiplier;
            matchedRecord.tacos_sold = Math.round(matchedRecord.tacos_sold * totalMultiplier);
            matchedRecord.rosebuds_sold = Math.round(matchedRecord.rosebuds_sold * totalMultiplier);
            matchedRecord.pork_ribs_racks *= totalMultiplier;
            matchedRecord.beef_dino_ribs *= totalMultiplier;
            matchedRecord.insightSuffix = ` (Adjusted x${totalMultiplier.toFixed(2)} for ${eventStr}${eventStr && weatherStr ? ' and ' : ''}${weatherStr})`;
        }
      } else {
        matchedRecord = records.find(r => r.day_name === shortDayStr) || records[0];
      }
    }

    const startIndex = records.findIndex(r => r.date === targetDateInput);
    const validStartIndex = startIndex >= 0 ? startIndex : 0;
    const slicedRecords = records.slice(validStartIndex, validStartIndex + daysCount);

    const catSelector = document.getElementById('category-selector');
    const selectedCat = catSelector ? catSelector.value : 'baseline';

    const bRaw = matchedRecord.brisket_raw_lbs || 0;
    const bCooked = Math.round(bRaw * 0.4);
    const pRaw = matchedRecord.pork_shoulder_raw_lbs || 0;
    const pCooked = Math.round(pRaw * 0.4);
    const totalRaw = Math.round(bRaw + pRaw);
    const totalCooked = bCooked + pCooked;

    let insightStr = '';
    if (matchedRecord.is_historical) {
      insightStr = `Historical Record for ${matchedRecord.day_name} (${matchedRecord.date}): The pit moved ~${bRaw.toFixed(1)} lbs raw brisket (~${bCooked} lbs cooked yield) and ~${pRaw.toFixed(1)} lbs raw pork shoulder (~${pCooked} lbs cooked yield) [~${totalRaw} lbs total raw / ~${totalCooked} lbs total cooked meat]. Actual verified line items sold included ${matchedRecord.tacos_sold} Tacos and ${matchedRecord.rosebuds_sold} Rosebuds, driving $${matchedRecord.actual_revenue.toLocaleString()} in gross revenue.`;
    } else if (matchedRecord.is_fallback_average) {
      insightStr = `Historical Average for ${matchedRecord.day_name} (${matchedRecord.date}): Prepping ~${bRaw.toFixed(1)} lbs raw brisket (~${bCooked} lbs cooked yield) and ~${pRaw.toFixed(1)} lbs raw pork shoulder (~${pCooked} lbs cooked yield) [~${totalRaw} lbs total raw / ~${totalCooked} lbs total cooked meat]. Tacos (${matchedRecord.tacos_sold} projected) and Rosebuds (${matchedRecord.rosebuds_sold} projected).`;
      if (matchedRecord.insightSuffix) insightStr += matchedRecord.insightSuffix;
    } else {
      insightStr = `The forecast for ${matchedRecord.day_name} (${matchedRecord.date}) dictates prepping ~${bRaw.toFixed(1)} lbs raw brisket (~${bCooked} lbs cooked yield) and ~${pRaw.toFixed(1)} lbs raw pork shoulder (~${pCooked} lbs cooked yield) [~${totalRaw} lbs total raw / ~${totalCooked} lbs total cooked meat]. Because brisket and pork lose ~60% of their weight during the long smoke, and composed items like Tacos (${matchedRecord.tacos_sold} projected) and Rosebuds (${matchedRecord.rosebuds_sold} projected) pull directly from this yield, prepping these exact amounts mathematically ensures we hit our target sell-out time right at 9:00 PM closing.`;
    }"""

if target in content:
    new_content = content.replace(target, replacement)
    with open("app.js", "w") as f:
        f.write(new_content)
    print("Successfully replaced.")
else:
    print("Target not found. Please check exact string.")
