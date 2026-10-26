import re

with open('app.js', 'r') as f:
    content = f.read()

target = """// Revert KPI Cards to strictly represent the Target (Start) Date.
    // Date ranges (aggregates) obscure daily operational prep requirements.
    const targetRecord = slicedRecords[0];
    const bRaw = targetRecord.brisket_raw_lbs || 0;
    const pRaw = targetRecord.pork_shoulder_raw_lbs || 0;
    const bCooked = Math.round(bRaw * 0.4);
    const pCooked = Math.round(pRaw * 0.4);
    const totalRaw = Math.round(bRaw + pRaw);
    const totalCooked = bCooked + pCooked;
    const totalTacos = Math.round(targetRecord.tacos_sold || 0);
    const totalRosebuds = Math.round(targetRecord.rosebuds_sold || 0);
    const totalRev = Math.round(targetRecord.predicted_revenue || 0);

    let insightStr = `Target Day Forecast (${targetRecord.date}): Ordering targets dictate prepping ~${bRaw.toFixed(1)} lbs raw brisket (~${bCooked} lbs cooked yield) and ~${pRaw.toFixed(1)} lbs raw pork shoulder (~${pCooked} lbs cooked yield) [~${totalRaw} lbs total raw / ~${totalCooked} lbs total cooked]. Because brisket and pork lose ~60% of their weight during the long smoke, and composed items like Tacos (${totalTacos} projected) and Rosebuds (${totalRosebuds} projected) pull directly from this yield, prepping these exact amounts mathematically ensures we hit our target sell-out time right at 9:00 PM closing.`;

    if (selectedCat !== 'baseline' && catSelector) {
      const selectedText = catSelector.options[catSelector.selectedIndex].text;
      insightStr = `Isolated Analysis (${targetRecord.date}): The forecast model dictates carefully tracking "${selectedText}" volumes independently to isolate its specific peak demand windows. Ensure procurement aligns with these exact projections to minimize waste and optimize pit capacity.`;
    }

    const insightSpan = document.getElementById('dynamic-insight-string');
    if (insightSpan) {
      insightSpan.textContent = insightStr;
    }

    const bVal = Math.round(bRaw);
    const pVal = Math.round(pRaw);
    const sVal = Math.round(targetRecord.sausage_lbs || 0);
    const rVal = Math.round(targetRecord.pork_ribs_racks || 0);
    const drVal = Math.round(targetRecord.beef_dino_ribs || 0);
    const tVal = totalRev ? Math.round(totalRev * 0.008 + 10) : 0;
    const rbVal = totalRosebuds;
    const tacoVal = totalTacos;
    const predRev = totalRev;"""

replacement = """// KPI Cards Logic - Sum if date range provided, otherwise just the target date
    const startDateVal = document.getElementById('forecast-start-date')?.value;
    const endDateVal = document.getElementById('forecast-end-date')?.value;
    const isRangeSelected = startDateVal && endDateVal && (startDateVal !== endDateVal);
    
    let bRaw = 0, pRaw = 0, sVal = 0, rVal = 0, drVal = 0, totalTacos = 0, totalRosebuds = 0, totalRev = 0, tVal = 0;
    
    if (isRangeSelected) {
      slicedRecords.forEach(r => {
        bRaw += r.brisket_raw_lbs || 0;
        pRaw += r.pork_shoulder_raw_lbs || 0;
        sVal += Math.round(r.sausage_lbs || 0);
        rVal += Math.round(r.pork_ribs_racks || 0);
        drVal += Math.round(r.beef_dino_ribs || 0);
        totalTacos += Math.round(r.tacos_sold || 0);
        totalRosebuds += Math.round(r.rosebuds_sold || 0);
        totalRev += Math.round(r.predicted_revenue || 0);
        tVal += (r.predicted_revenue ? Math.round((r.predicted_revenue || 0) * 0.008 + 10) : 0);
      });
    } else {
      const targetRecord = slicedRecords[0];
      bRaw = targetRecord.brisket_raw_lbs || 0;
      pRaw = targetRecord.pork_shoulder_raw_lbs || 0;
      sVal = Math.round(targetRecord.sausage_lbs || 0);
      rVal = Math.round(targetRecord.pork_ribs_racks || 0);
      drVal = Math.round(targetRecord.beef_dino_ribs || 0);
      totalTacos = Math.round(targetRecord.tacos_sold || 0);
      totalRosebuds = Math.round(targetRecord.rosebuds_sold || 0);
      totalRev = Math.round(targetRecord.predicted_revenue || 0);
      tVal = totalRev ? Math.round(totalRev * 0.008 + 10) : 0;
    }

    const bCooked = Math.round(bRaw * 0.4);
    const pCooked = Math.round(pRaw * 0.4);
    const totalRaw = Math.round(bRaw + pRaw);
    const totalCooked = bCooked + pCooked;

    let insightStr = `Target Forecast (${isRangeSelected ? startDateVal + ' to ' + endDateVal : slicedRecords[0].date}): Ordering targets dictate prepping ~${bRaw.toFixed(1)} lbs raw brisket (~${bCooked} lbs cooked yield) and ~${pRaw.toFixed(1)} lbs raw pork shoulder (~${pCooked} lbs cooked yield) [~${totalRaw} lbs total raw / ~${totalCooked} lbs total cooked]. Because brisket and pork lose ~60% of their weight during the long smoke, and composed items like Tacos (${totalTacos} projected) and Rosebuds (${totalRosebuds} projected) pull directly from this yield, prepping these exact amounts mathematically ensures we hit our target sell-out time right at 9:00 PM closing.`;

    if (selectedCat !== 'baseline' && catSelector) {
      const selectedText = catSelector.options[catSelector.selectedIndex].text;
      insightStr = `Isolated Analysis (${isRangeSelected ? 'Range' : slicedRecords[0].date}): The forecast model dictates carefully tracking "${selectedText}" volumes independently to isolate its specific peak demand windows. Ensure procurement aligns with these exact projections to minimize waste and optimize pit capacity.`;
    }

    const insightSpan = document.getElementById('dynamic-insight-string');
    if (insightSpan) {
      insightSpan.textContent = insightStr;
    }

    const bVal = Math.round(bRaw);
    const pVal = Math.round(pRaw);
    const rbVal = totalRosebuds;
    const tacoVal = totalTacos;
    const predRev = totalRev;"""

if target in content:
    with open('app.js', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Fixed KPI sums logic.")
else:
    print("Could not find KPI sums target in app.js")
