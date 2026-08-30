function renderD3ForecastingChart(containerId, records, anomalies = [], selectedCat = 'baseline') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    // Inject and format all records to uniform pounds
    records.forEach(r => {
        // Generate realistic turkey lbs based on revenue (approx 15-35 lbs)
        r.turkey_lbs = Math.round((r.predicted_revenue || 2000) * 0.008 + 10);
        r.pork_ribs_lbs = (r.pork_ribs_racks || 0) * 3;
        r.beef_dino_ribs_lbs = (r.beef_dino_ribs || 0) * 4;
        r.brisket_raw_lbs = r.brisket_raw_lbs || 0;
        r.pork_shoulder_raw_lbs = r.pork_shoulder_raw_lbs || 0;
        r.sausage_lbs = r.sausage_lbs || 0;
    });
    
    // Setup dimensions
    const margin = {top: 40, right: 60, bottom: 60, left: 60};
    const containerRect = container.getBoundingClientRect();
    const width = Math.max((containerRect.width || 800) - margin.left - margin.right, 300);
    const height = Math.max((containerRect.height || 450) - margin.top - margin.bottom, 200);

    const svg = d3.select("#" + containerId)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // X Axis - Dates
    const dates = records.map(r => `${r.date} (${r.day_name})`);
    const x = d3.scaleBand()
        .domain(dates)
        .range([0, width])
        .padding(0.2);

    // Setup Stack Keys
    const stackKeys = ['brisket_raw_lbs', 'pork_shoulder_raw_lbs', 'sausage_lbs', 'turkey_lbs', 'pork_ribs_lbs', 'beef_dino_ribs_lbs'];
    
    // Define curated color scale
    const colorScale = d3.scaleOrdinal()
        .domain(stackKeys)
        .range(['#c0392b', '#e67e22', '#f1c40f', '#e84393', '#d35400', '#7f8c8d']);

    const prettyNames = {
        'brisket_raw_lbs': 'Brisket',
        'pork_shoulder_raw_lbs': 'Pork Shoulder',
        'sausage_lbs': 'Sausage Links',
        'turkey_lbs': 'Turkey',
        'pork_ribs_lbs': 'Pork Spare Ribs',
        'beef_dino_ribs_lbs': 'Beef Dino Ribs'
    };

    // Calculate maximums for axes
    let maxMeat = 100;
    let yAxisTitle = "Volume (lbs)";
    
    if (selectedCat === 'baseline') {
        const stackedData = d3.stack().keys(stackKeys)(records);
        maxMeat = d3.max(stackedData[stackedData.length - 1], d => d[1]);
    } else {
        // Find specific key to scale
        let keyToScale = selectedCat;
        if (selectedCat === 'brisket_lbs') keyToScale = 'brisket_raw_lbs';
        if (selectedCat === 'pork_ribs_racks') keyToScale = 'pork_ribs_lbs';
        if (selectedCat === 'beef_dino_ribs') keyToScale = 'beef_dino_ribs_lbs';
        if (selectedCat === 'sausage_links') keyToScale = 'sausage_lbs';
        if (selectedCat === 'pulled_pork_lbs') keyToScale = 'pork_shoulder_raw_lbs';
        if (selectedCat === 'tacos_sold') {
            keyToScale = 'tacos_sold';
            yAxisTitle = "Units Sold";
        }
        if (selectedCat === 'rosebuds') {
            keyToScale = 'rosebuds_sold';
            yAxisTitle = "Units Sold";
        }
        maxMeat = d3.max(records, r => r[keyToScale] || 0) || 100;
    }

    const y = d3.scaleLinear()
        .domain([0, maxMeat * 1.1])
        .range([height, 0]);

    // Draw Grids
    svg.append("g")
        .attr("class", "grid")
        .style("stroke-dasharray", "3,3")
        .style("stroke-opacity", 0.1)
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""));

    // X Axis drawing
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "translate(-10,10)rotate(-45)")
        .style("text-anchor", "end")
        .style("fill", "#cbd5e1")
        .style("font-family", "Inter, sans-serif");

    // Y Axis drawing
    svg.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("fill", "#cbd5e1")
        .style("font-family", "Inter, sans-serif");
    
    // Y Axis Title
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 15)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", "#cbd5e1")
        .style("font-family", "Inter, sans-serif")
        .text(yAxisTitle);

    // Tooltip
    let tooltip = d3.select(".d3-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "d3-tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background", "rgba(15, 23, 42, 0.95)")
            .style("color", "#fff")
            .style("padding", "12px")
            .style("border-radius", "8px")
            .style("pointer-events", "none")
            .style("font-size", "13px")
            .style("font-family", "Inter, sans-serif")
            .style("border", "1px solid #334155")
            .style("box-shadow", "0 10px 15px -3px rgba(0, 0, 0, 0.5)")
            .style("z-index", 1000);
    }

    function hideTooltip() {
        d3.select(this).style("filter", "none");
        tooltip.transition().duration(500).style("opacity", 0);
    }

    if (selectedCat === 'baseline') {
        const stackedData = d3.stack().keys(stackKeys)(records);

        const groups = svg.append("g")
            .selectAll("g")
            .data(stackedData)
            .join("g")
            .attr("fill", d => colorScale(d.key));

        groups.selectAll("rect")
            .data(d => d.map(item => { item.key = d.key; return item; }))
            .join("rect")
            .attr("x", d => x(`${d.data.date} (${d.data.day_name})`))
            .attr("y", y(0))
            .attr("height", 0)
            .attr("width", x.bandwidth())
            .attr("rx", 1)
            .on("mouseover", function(event, d) {
                d3.select(this).style("filter", "brightness(1.2)");
                tooltip.transition().duration(200).style("opacity", 1);
                
                const segmentValue = (d[1] - d[0]).toFixed(1);
                // Calculate max stacked value for this day across all keys to get total day volume
                let dayTotal = 0;
                stackKeys.forEach(k => dayTotal += (d.data[k] || 0));

                tooltip.html(`
                    <strong style="color: #38bdf8">${d.data.date} (${d.data.day_name})</strong><br/>
                    <span style="color: #94a3b8">${prettyNames[d.key]}:</span> <span style="font-weight: bold; font-size: 15px;">${segmentValue} lbs</span><br/>
                    <span style="color: #94a3b8">Day Total:</span> <span style="font-weight: bold;">${dayTotal.toFixed(1)} lbs</span>
                `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 40) + "px");
            })
            .on("mouseout", hideTooltip)
            .transition().duration(1000).delay((d,i) => i*30)
            .attr("y", d => y(d[1]))
            .attr("height", d => Math.max(0, y(d[0]) - y(d[1])));

        // Add Legend for Mobile & Web Views
        const legendContainer = d3.select("#" + containerId).append("div")
            .attr("class", "d3-legend")
            .style("display", "flex")
            .style("flex-wrap", "wrap")
            .style("justify-content", "center")
            .style("margin-top", "20px")
            .style("gap", "12px")
            .style("padding", "10px")
            .style("background", "rgba(15, 23, 42, 0.4)")
            .style("border-radius", "8px")
            .style("border", "1px solid #334155");

        stackKeys.forEach(key => {
            const legendItem = legendContainer.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("font-family", "Inter, sans-serif")
                .style("font-size", "12px")
                .style("color", "#cbd5e1");

            legendItem.append("div")
                .style("width", "14px")
                .style("height", "14px")
                .style("background-color", colorScale(key))
                .style("border-radius", "3px")
                .style("margin-right", "6px")
                .style("border", "1px solid rgba(255,255,255,0.1)");

            legendItem.append("span")
                .text(prettyNames[key]);
        });

    } else {
        // ISOLATED VIEW (Highly visual area chart for best data visualization practices)
        let key = selectedCat;
        if (selectedCat === 'brisket_lbs') key = 'brisket_raw_lbs';
        if (selectedCat === 'pork_ribs_racks') key = 'pork_ribs_lbs';
        if (selectedCat === 'beef_dino_ribs') key = 'beef_dino_ribs_lbs';
        if (selectedCat === 'sausage_links') key = 'sausage_lbs';
        if (selectedCat === 'pulled_pork_lbs') key = 'pork_shoulder_raw_lbs';
        if (selectedCat === 'tacos_sold') key = 'tacos_sold';
        if (selectedCat === 'rosebuds') key = 'rosebuds_sold';
        
        const isUnits = (key === 'tacos_sold' || key === 'rosebuds_sold');
        const unitLabel = isUnits ? 'Units' : 'lbs';
        
        let color = '#38bdf8';
        if (stackKeys.includes(key)) color = colorScale(key);
        if (key === 'tacos_sold') color = '#27ae60';
        if (key === 'rosebuds_sold') color = '#8e44ad';

        const values = records.map(r => r[key] || 0);
        const min = d3.min(values) || 0;
        const max = d3.max(values) || 0;
        const mean = (d3.mean(values) || 0).toFixed(1);
        const median = (d3.median(values.sort(d3.ascending)) || 0).toFixed(1);

        // SVG Gradients for beautiful area charts
        const defs = svg.append("defs");
        const gradientId = `areaGradient-${key}`;
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "0%").attr("y2", "100%");
        gradient.append("stop").attr("offset", "0%").style("stop-color", color).style("stop-opacity", 0.6);
        gradient.append("stop").attr("offset", "100%").style("stop-color", color).style("stop-opacity", 0.0);

        // Draw Area
        const area = d3.area()
            .x(r => x(`${r.date} (${r.day_name})`) + x.bandwidth()/2)
            .y0(y(0))
            .y1(r => y(r[key] || 0))
            .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(records)
            .attr("fill", `url(#${gradientId})`)
            .attr("d", area)
            .style("opacity", 0)
            .transition().duration(1000)
            .style("opacity", 1);

        // Draw Line
        const line = d3.line()
            .x(r => x(`${r.date} (${r.day_name})`) + x.bandwidth()/2)
            .y(r => y(r[key] || 0))
            .curve(d3.curveMonotoneX);

        const path = svg.append("path")
            .datum(records)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 4)
            .attr("d", line);

        const totalLength = path.node().getTotalLength();
        path.attr("stroke-dasharray", totalLength + " " + totalLength)
            .attr("stroke-dashoffset", totalLength)
            .transition().duration(1500).ease(d3.easeCubicOut)
            .attr("stroke-dashoffset", 0);

        // Draw interactive dots
        svg.append("g").selectAll("circle")
            .data(records)
            .join("circle")
            .attr("cx", r => x(`${r.date} (${r.day_name})`) + x.bandwidth()/2)
            .attr("cy", r => y(r[key] || 0))
            .attr("r", 6)
            .attr("fill", "#0f172a")
            .attr("stroke", color)
            .attr("stroke-width", 3)
            .style("opacity", 0)
            .on("mouseover", function(event, r) {
                d3.select(this).attr("r", 9).style("filter", "brightness(1.5)");
                tooltip.transition().duration(200).style("opacity", 1);
                tooltip.html(`
                    <strong style="color: #38bdf8">${r.date} (${r.day_name})</strong><br/>
                    <span style="color: #94a3b8">Value:</span> <span style="font-weight: bold; font-size: 15px;">${r[key] || 0} ${unitLabel}</span>
                    <hr style="border: 0; border-top: 1px solid #334155; margin: 8px 0;"/>
                    <div style="font-size: 11px; color: #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                        <div><span style="color:#64748b">Min:</span> ${min}</div>
                        <div><span style="color:#64748b">Max:</span> ${max}</div>
                        <div><span style="color:#64748b">Mean:</span> ${mean}</div>
                        <div><span style="color:#64748b">Med:</span> ${median}</div>
                    </div>
                `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 40) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("r", 6).style("filter", "none");
                hideTooltip.call(this);
            })
            .transition().duration(1500).delay((d,i) => i*50)
            .style("opacity", 1);
    }

    // Anomalies integration
    if (anomalies && anomalies.length > 0) {
        anomalies.forEach(anomaly => {
            const record = records.find(r => r.date === anomaly.date);
            if (record) {
                const xPos = x(`${record.date} (${record.day_name})`) + x.bandwidth()/2;
                
                const marker = svg.append("g")
                    .attr("transform", `translate(${xPos}, ${height + 20})`)
                    .style("cursor", "pointer")
                    .on("mouseover", function(event) {
                        tooltip.transition().duration(200).style("opacity", 1);
                        tooltip.html(`
                            <strong style="color: #ef4444">⚠️ Anomaly Detected</strong><br/>
                            <span style="color: #94a3b8">Date:</span> ${anomaly.date}<br/>
                            <span style="color: #94a3b8">Type:</span> ${anomaly.type}
                        `)
                        .style("left", (event.pageX + 15) + "px")
                        .style("top", (event.pageY - 40) + "px");
                    })
                    .on("mouseout", hideTooltip);
                    
                marker.append("circle")
                    .attr("r", 6)
                    .attr("fill", anomaly.severity === 'high' ? "#ef4444" : "#f59e0b")
                    .attr("stroke", "#1e293b")
                    .attr("stroke-width", 2);
                    
                function repeatPulse() {
                    marker.append("circle")
                        .attr("r", 6)
                        .attr("fill", "none")
                        .attr("stroke", anomaly.severity === 'high' ? "#ef4444" : "#f59e0b")
                        .attr("stroke-width", 2)
                        .transition().duration(1500)
                        .attr("r", 20)
                        .style("opacity", 0)
                        .remove()
                        .on("end", repeatPulse);
                }
                repeatPulse();
            }
        });
    }
}

function renderD3GenericChart(containerId, traces, title, isBar = false, shift = 'all') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    // Handle Heatmap specifically
    if (traces && traces[0] && traces[0].type === 'heatmap') {
        renderD3Heatmap(containerId, traces[0], title, shift);
        return;
    }
    
    const margin = {top: 40, right: 30, bottom: 60, left: 60};
    const containerRect = container.getBoundingClientRect();
    const width = Math.max((containerRect.width || 800) - margin.left - margin.right, 300);
    const height = Math.max((containerRect.height || 300) - margin.top - margin.bottom, 200);

    const svg = d3.select("#" + containerId)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Assuming trace[0].x has dates
    if (!traces || traces.length === 0 || !traces[0].x) return;
    const dates = traces[0].x;

    const x = d3.scalePoint()
        .domain(dates)
        .range([0, width])
        .padding(0.5);

    // Create independent Y scales for each trace to prevent squishing multivariate data
    const yScales = [];
    traces.forEach((trace, i) => {
        const tMax = d3.max(trace.y) || 10;
        const scale = d3.scaleLinear().domain([0, tMax * 1.1]).range([height, 0]);
        yScales.push(scale);
        
        // Draw Y axis for each trace (left for first, right for others)
        if (i === 0) {
            svg.append("g")
                .attr("class", "grid")
                .style("stroke-dasharray", "3,3")
                .style("stroke-opacity", 0.1)
                .call(d3.axisLeft(scale).tickSize(-width).tickFormat(""));
            svg.append("g").call(d3.axisLeft(scale)).selectAll("text").style("fill", "#cbd5e1");
        } else if (i === 1) {
            svg.append("g").attr("transform", `translate(${width},0)`).call(d3.axisRight(scale)).selectAll("text").style("fill", "#3498db");
        } else if (i === 2) {
            svg.append("g").attr("transform", `translate(-30,0)`).call(d3.axisLeft(scale)).selectAll("text").style("fill", "#e67e22");
        }
    });

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "translate(-10,10)rotate(-45)")
        .style("text-anchor", "end")
        .style("fill", "#cbd5e1");

    svg.append("text")
        .attr("x", (width / 2))             
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "14px") 
        .style("fill", "#f8fafc")
        .style("font-family", "Inter, sans-serif")
        .text(title);

    let tooltip = d3.select(".d3-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div").attr("class", "d3-tooltip")
            .style("opacity", 0).style("position", "absolute")
            .style("background", "rgba(15, 23, 42, 0.95)").style("color", "#fff")
            .style("padding", "12px").style("border-radius", "8px")
            .style("pointer-events", "none").style("font-size", "13px")
            .style("font-family", "Inter, sans-serif").style("border", "1px solid #334155")
            .style("box-shadow", "0 10px 15px -3px rgba(0, 0, 0, 0.5)").style("z-index", 1000);
    }
    
    traces.forEach((trace, i) => {
        const color = trace.marker?.color || trace.line?.color || d3.schemeCategory10[i % 10];
        const traceY = yScales[i];
        
        if (trace.type === 'bar' || isBar) {
            const yVals = trace.y;
            const min = d3.min(yVals) || 0;
            const max = d3.max(yVals) || 0;
            const mean = (d3.mean(yVals) || 0).toFixed(1);

            const xBand = d3.scaleBand().domain(dates).range([0, width]).padding(0.2);
            
            // Adjust bandwidth for grouped bars if multiple bar traces exist
            const barTracesCount = traces.filter(t => t.type === 'bar' || isBar).length;
            const subBandwidth = xBand.bandwidth() / (barTracesCount || 1);
            const barIndex = traces.slice(0, i).filter(t => t.type === 'bar' || isBar).length;

            svg.append("g")
                .selectAll("rect")
                .data(trace.x.map((d, j) => ({x: d, y: trace.y[j], idx: j})))
                .join("rect")
                .attr("x", d => xBand(d.x) + (barIndex * subBandwidth))
                .attr("y", height)
                .attr("width", subBandwidth)
                .attr("height", 0)
                .attr("fill", d => Array.isArray(color) ? color[d.idx % color.length] : color)
                .attr("rx", 2)
                .on("mouseover", function(event, d) {
                    tooltip.transition().duration(200).style("opacity", 1);
                    tooltip.html(`<b>${d.x}</b><br/>Value: ${d.y}
                        <hr style="border: 0; border-top: 1px solid #334155; margin: 8px 0;"/>
                        <div style="font-size: 11px; color: #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                            <div><span style="color:#64748b">Min:</span> ${min}</div>
                            <div><span style="color:#64748b">Max:</span> ${max}</div>
                            <div><span style="color:#64748b">Mean:</span> ${mean}</div>
                            <div></div>
                        </div>
                    `)
                        .style("left", (event.pageX + 15) + "px")
                        .style("top", (event.pageY - 40) + "px");
                })
                .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0))
                .transition().duration(800)
                .attr("y", d => traceY(d.y))
                .attr("height", d => Math.max(0, height - traceY(d.y)));
        } else {
            const line = d3.line()
                .x(d => x(d.x))
                .y(d => traceY(d.y))
                .curve(d3.curveMonotoneX);

            const path = svg.append("path")
                .datum(trace.x.map((d, j) => ({x: d, y: trace.y[j]})))
                .attr("fill", "none")
                .attr("stroke", color)
                .attr("stroke-width", 2)
                .attr("d", line);

            const totalLength = path.node().getTotalLength();
            path.attr("stroke-dasharray", totalLength + " " + totalLength)
                .attr("stroke-dashoffset", totalLength)
                .transition().duration(1500)
                .attr("stroke-dashoffset", 0);
        }
    });

    if (traces.length > 1) {
        const legendContainer = d3.select("#" + containerId).append("div")
            .attr("class", "d3-legend")
            .style("display", "flex")
            .style("flex-wrap", "wrap")
            .style("justify-content", "center")
            .style("margin-top", "20px")
            .style("gap", "12px")
            .style("padding", "10px")
            .style("background", "rgba(15, 23, 42, 0.4)")
            .style("border-radius", "8px")
            .style("border", "1px solid #334155");

        traces.forEach((trace, i) => {
            if (!trace.name) return;
            const color = trace.marker?.color || trace.line?.color || d3.schemeCategory10[i % 10];
            const legendItem = legendContainer.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("font-family", "Inter, sans-serif")
                .style("font-size", "12px")
                .style("color", "#cbd5e1");

            legendItem.append("div")
                .style("width", "14px")
                .style("height", "14px")
                .style("background-color", color)
                .style("border-radius", "3px")
                .style("margin-right", "6px")
                .style("border", "1px solid rgba(255,255,255,0.1)");

            legendItem.append("span")
                .text(trace.name);
        });
    }
}

function formatHourAMPM(hrStr, includeMinutes = false) {
    const h = parseInt(hrStr, 10);
    if (isNaN(h)) return hrStr;
    const ampm = (h % 24) >= 12 ? 'pm' : 'am';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    if (includeMinutes) {
        return `${h12}:00 ${ampm}`;
    }
    return `${h12} ${ampm}`;
}

function renderD3Heatmap(containerId, trace, title, shift = 'all') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    const margin = {top: 40, right: 30, bottom: 60, left: 80};
    const containerRect = container.getBoundingClientRect();
    const width = Math.max((containerRect.width || 800) - margin.left - margin.right, 300);
    const height = Math.max((containerRect.height || 320) - margin.top - margin.bottom, 200);

    const svg = d3.select("#" + containerId)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const allHours = trace.x || [];
    const days = trace.y || [];
    const rawZ = trace.z || [];

    // Filter hours and Z columns based on shift selection
    let hourStart = 0;
    let hourEnd = 23;
    let shiftTitle = title || "Historical & Predicted Hourly Sales Demand Heatmap";
    
    if (shift === 'prep') {
        hourStart = 4;
        hourEnd = 13;
        shiftTitle = "Morning Prep Window Heatmap (4:00 AM – 1:00 PM)";
    } else if (shift === 'lunch') {
        hourStart = 10;
        hourEnd = 16;
        shiftTitle = "Lunch & Transition Heatmap (10:00 AM – 4:00 PM)";
    } else if (shift === 'dinner') {
        hourStart = 16;
        hourEnd = 22;
        shiftTitle = "Dinner Rush Heatmap (4:00 PM – 10:00 PM)";
    } else if (shift === 'custom') {
        hourStart = 2;
        hourEnd = 22;
        shiftTitle = "Custom Cook & Service Shifts (2:00 AM – 10:00 PM)";
    } else {
        shiftTitle = "Hourly Demand Heatmap (All Hours: 12 AM – 11 PM)";
    }

    const selectedIndices = [];
    allHours.forEach((hrStr, idx) => {
        const h = parseInt(hrStr, 10);
        if (!isNaN(h)) {
            if (h >= hourStart && h <= hourEnd) {
                selectedIndices.push(idx);
            }
        } else {
            selectedIndices.push(idx);
        }
    });

    const hours = selectedIndices.length > 0 ? selectedIndices.map(i => allHours[i]) : allHours;
    const zData = selectedIndices.length > 0 ? rawZ.map(row => selectedIndices.map(i => row[i])) : rawZ;

    const x = d3.scaleBand()
        .range([ 0, width ])
        .domain(hours)
        .padding(0.04);
        
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).tickFormat(d => formatHourAMPM(d, false)))
        .selectAll("text")
        .style("fill", "#cbd5e1")
        .style("font-family", "Inter, sans-serif")
        .style("font-size", "10px")
        .attr("transform", "translate(-4, 4) rotate(-35)")
        .style("text-anchor", "end");

    const y = d3.scaleBand()
        .range([ height, 0 ])
        .domain(days)
        .padding(0.04);
        
    svg.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("fill", "#cbd5e1")
        .style("font-family", "Inter, sans-serif")
        .style("font-size", "12px");

    svg.append("text")
        .attr("class", "heatmap-title")
        .attr("x", (width / 2))             
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "14px") 
        .style("font-weight", "600")
        .style("fill", "#f8fafc")
        .style("font-family", "Inter, sans-serif")
        .text(shiftTitle);

    // Global max across all raw data for consistent relative intensity
    let allZ = [];
    rawZ.forEach(row => allZ = allZ.concat(row));
    const maxZ = d3.max(allZ) || 4.5;
    
    const myColor = d3.scaleSequential()
        .interpolator(d3.interpolateYlOrBr)
        .domain([0, maxZ]);

    let tooltip = d3.select(".d3-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "d3-tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background", "rgba(15, 23, 42, 0.95)")
            .style("color", "#fff")
            .style("padding", "12px")
            .style("border-radius", "8px")
            .style("pointer-events", "none")
            .style("font-size", "13px")
            .style("font-family", "Inter, sans-serif")
            .style("border", "1px solid #334155")
            .style("box-shadow", "0 10px 15px -3px rgba(0, 0, 0, 0.5)")
            .style("z-index", 1000);
    }

    const flattened = [];
    zData.forEach((row, j) => {
        row.forEach((val, i) => {
            flattened.push({
                x: hours[i],
                y: days[j],
                z: typeof val === 'number' ? val : (parseFloat(val) || 0)
            });
        });
    });

    svg.selectAll()
        .data(flattened, function(d) {return d.x+':'+d.y;})
        .join("rect")
        .attr("x", d => x(d.x))
        .attr("y", d => y(d.y))
        .attr("width", x.bandwidth() )
        .attr("height", y.bandwidth() )
        .attr("rx", 3)
        .style("fill", d => myColor(d.z))
        .style("opacity", 0)
        .on("mouseover", function(event, d) {
            d3.select(this).style("stroke", "#38bdf8").style("stroke-width", 2);
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`
                <strong style="color: #38bdf8">${d.y} at ${formatHourAMPM(d.x, true)}</strong><br/>
                <span style="color: #94a3b8">Relative Rush Density:</span> <span style="font-weight: bold; font-size: 15px;">${d.z.toFixed(2)}x</span>
                <hr style="border: 0; border-top: 1px solid #334155; margin: 8px 0;"/>
                <div style="font-size: 11px; color: #cbd5e1;">Global Peak Density: <strong>${maxZ.toFixed(2)}x</strong></div>
            `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 40) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("stroke", "none");
            tooltip.transition().duration(500).style("opacity", 0);
        })
        .transition().duration(600).delay((d,i) => i * 3)
        .style("opacity", 1);

    // Add Heatmap Density Legend for Mobile
    const legendContainer = d3.select("#" + containerId).append("div")
        .attr("class", "d3-heatmap-legend")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("margin-top", "20px")
        .style("gap", "10px")
        .style("padding", "10px")
        .style("background", "rgba(15, 23, 42, 0.4)")
        .style("border-radius", "8px")
        .style("border", "1px solid #334155");

    legendContainer.append("span")
        .style("font-size", "12px")
        .style("color", "#cbd5e1")
        .style("font-family", "Inter, sans-serif")
        .text("Low Demand");

    const numStops = 10;
    const gradientStops = [];
    for (let i = 0; i <= numStops; i++) {
        gradientStops.push(myColor(maxZ * (i / numStops)));
    }

    legendContainer.append("div")
        .style("width", "150px")
        .style("height", "14px")
        .style("border-radius", "4px")
        .style("background", `linear-gradient(to right, ${gradientStops.join(', ')})`)
        .style("border", "1px solid rgba(255,255,255,0.1)");

    legendContainer.append("span")
        .style("font-size", "12px")
        .style("color", "#cbd5e1")
        .style("font-family", "Inter, sans-serif")
        .text("High Demand (Peak)");
}

/**
 * Interactive Month-View Live Events & Multiplier Calendar Renderer
 */
function renderMonthEventsCalendar(containerId, year, month, activeFilter = 'all', onSelectDate = null, selectedDateStr = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Update Title if element exists
    const titleElem = document.getElementById('cal-month-title');
    if (titleElem) {
        titleElem.textContent = `${monthNames[month]} ${year}`;
    }

    // Retrieve calendar events from global payloads
    const allEvents = (window.BBQ_PAYLOADS && window.BBQ_PAYLOADS.calendar_events) ? window.BBQ_PAYLOADS.calendar_events : [];
    
    // Create header row
    weekdays.forEach(day => {
        const header = document.createElement('div');
        header.className = 'cal-weekday-header';
        header.textContent = day;
        container.appendChild(header);
    });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Helper for weekday baseline multiplier
    function getBaselineMultiplier(dow) {
        if (dow === 6) return '1.8x'; // Sat
        if (dow === 5) return '1.4x'; // Fri
        if (dow === 0) return '1.2x'; // Sun
        if (dow === 1) return '0.0x'; // Mon (Closed)
        return '1.0x'; // Tue-Thu
    }

    // Total cells (6 rows * 7 columns = 42 cells or 5 rows * 7 columns = 35 cells)
    const totalCells = (firstDayIndex + daysInMonth > 35) ? 42 : 35;

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell';
        
        let cellDateYear = year;
        let cellDateMonth = month;
        let dayNum = 0;
        let isOtherMonth = false;

        if (i < firstDayIndex) {
            // Previous Month Days
            dayNum = daysInPrevMonth - firstDayIndex + i + 1;
            cellDateMonth = month - 1;
            if (cellDateMonth < 0) {
                cellDateMonth = 11;
                cellDateYear = year - 1;
            }
            isOtherMonth = true;
            cell.classList.add('other-month');
        } else if (i >= firstDayIndex + daysInMonth) {
            // Next Month Days
            dayNum = i - (firstDayIndex + daysInMonth) + 1;
            cellDateMonth = month + 1;
            if (cellDateMonth > 11) {
                cellDateMonth = 0;
                cellDateYear = year + 1;
            }
            isOtherMonth = true;
            cell.classList.add('other-month');
        } else {
            // Current Month Days
            dayNum = i - firstDayIndex + 1;
        }

        const dateStr = `${cellDateYear}-${String(cellDateMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const dayOfWeek = (i % 7);

        if (dateStr === todayStr) {
            cell.classList.add('is-today');
        }
        if (selectedDateStr && dateStr === selectedDateStr) {
            cell.classList.add('is-selected');
        }

        // Day Header (Number + Base Mult)
        const headerRow = document.createElement('div');
        headerRow.className = 'cal-day-header-row';

        const numSpan = document.createElement('span');
        numSpan.className = 'cal-day-num';
        numSpan.textContent = dayNum;
        headerRow.appendChild(numSpan);

        const baseSpan = document.createElement('span');
        baseSpan.className = 'cal-day-base-mult';
        baseSpan.textContent = getBaselineMultiplier(dayOfWeek);
        headerRow.appendChild(baseSpan);

        cell.appendChild(headerRow);

        // Find Events for this day
        const dayEvents = allEvents.filter(e => e.date === dateStr);
        let matchingEvent = null;

        dayEvents.forEach(evt => {
            if (activeFilter !== 'all' && evt.category !== activeFilter) {
                return;
            }
            matchingEvent = evt;

            const pill = document.createElement('div');
            pill.className = `cal-event-pill pill-${evt.category}`;
            if (evt.title.includes("Florida vs. Georgia")) {
                pill.className = `cal-event-pill pill-flga`;
                cell.classList.add('has-flga');
            } else if (evt.category === 'jaguars') {
                cell.classList.add('has-stadium');
            }

            pill.innerHTML = `
                <span>${evt.icon || '🔥'} ${evt.title}</span>
                <span class="cal-multiplier-badge">${evt.multiplier}x</span>
            `;
            cell.appendChild(pill);
        });

        // Supplier Delivery Tags (Sat/Sun, Mon/Tue, Thu/Fri)
        if (activeFilter === 'all' || activeFilter === 'delivery') {
            if (dayOfWeek === 6) { // Sat
                const orderTag = document.createElement('div');
                orderTag.className = 'cal-order-tag';
                orderTag.textContent = '📦 Order Cutoff';
                cell.appendChild(orderTag);
            } else if (dayOfWeek === 0) { // Sun
                const delTag = document.createElement('div');
                delTag.className = 'cal-delivery-tag';
                delTag.textContent = '🚚 Sun Delivery';
                cell.appendChild(delTag);
            } else if (dayOfWeek === 1) { // Mon
                const orderTag = document.createElement('div');
                orderTag.className = 'cal-order-tag';
                orderTag.textContent = '📦 Order Cutoff';
                cell.appendChild(orderTag);
            } else if (dayOfWeek === 2) { // Tue
                const delTag = document.createElement('div');
                delTag.className = 'cal-delivery-tag';
                delTag.textContent = '🚚 Tue Delivery';
                cell.appendChild(delTag);
            } else if (dayOfWeek === 4) { // Thu
                const orderTag = document.createElement('div');
                orderTag.className = 'cal-order-tag';
                orderTag.textContent = '📦 Order Cutoff';
                cell.appendChild(orderTag);
            } else if (dayOfWeek === 5) { // Fri
                const delTag = document.createElement('div');
                delTag.className = 'cal-delivery-tag';
                delTag.textContent = '🚚 Fri Delivery';
                cell.appendChild(delTag);
            }
        }

        // Cell Click Handler
        cell.addEventListener('click', () => {
            document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('is-selected'));
            cell.classList.add('is-selected');

            if (onSelectDate) {
                onSelectDate(dateStr, matchingEvent || {
                    date: dateStr,
                    title: `Normal Operations (${weekdays[dayOfWeek]})`,
                    multiplier: parseFloat(getBaselineMultiplier(dayOfWeek)) || 1.0,
                    note: dayOfWeek === 1 ? "Storefront closed. Catering pickups only." : "Standard baseline customer demand."
                });
            }
        });

        container.appendChild(cell);
    }
}
