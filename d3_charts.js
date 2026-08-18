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
    const width = container.clientWidth - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;

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
        if (selectedCat === 'tacos_brisket' || selectedCat === 'tacos_pork') {
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
            .attr("height", d => y(d[0]) - y(d[1]));

    } else {
        // ISOLATED VIEW (Highly visual area chart for best data visualization practices)
        let key = selectedCat;
        if (selectedCat === 'brisket_lbs') key = 'brisket_raw_lbs';
        if (selectedCat === 'pork_ribs_racks') key = 'pork_ribs_lbs';
        if (selectedCat === 'beef_dino_ribs') key = 'beef_dino_ribs_lbs';
        if (selectedCat === 'sausage_links') key = 'sausage_lbs';
        if (selectedCat === 'pulled_pork_lbs') key = 'pork_shoulder_raw_lbs';
        if (selectedCat === 'tacos_brisket' || selectedCat === 'tacos_pork') key = 'tacos_sold';
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

function renderD3GenericChart(containerId, traces, title, isBar = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    // Handle Heatmap specifically
    if (traces && traces[0] && traces[0].type === 'heatmap') {
        renderD3Heatmap(containerId, traces[0], title);
        return;
    }
    
    const margin = {top: 40, right: 30, bottom: 60, left: 60};
    const width = container.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

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

    // Merge all Y values to find max
    let allY = [];
    traces.forEach(t => allY = allY.concat(t.y));
    const maxY = d3.max(allY) || 100;

    const y = d3.scaleLinear()
        .domain([0, maxY * 1.1])
        .range([height, 0]);

    svg.append("g")
        .attr("class", "grid")
        .style("stroke-dasharray", "3,3")
        .style("stroke-opacity", 0.1)
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""));

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "translate(-10,10)rotate(-45)")
        .style("text-anchor", "end")
        .style("fill", "#cbd5e1");

    svg.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
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
        
        if (trace.type === 'bar' || isBar) {
            const yVals = trace.y;
            const min = d3.min(yVals) || 0;
            const max = d3.max(yVals) || 0;
            const mean = (d3.mean(yVals) || 0).toFixed(1);

            const xBand = d3.scaleBand().domain(dates).range([0, width]).padding(0.2);
            svg.append("g")
                .selectAll("rect")
                .data(trace.x.map((d, j) => ({x: d, y: trace.y[j]})))
                .join("rect")
                .attr("x", d => xBand(d.x))
                .attr("y", height)
                .attr("width", xBand.bandwidth())
                .attr("height", 0)
                .attr("fill", color)
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
                .attr("y", d => y(d.y))
                .attr("height", d => height - y(d.y));
        } else {
            const line = d3.line()
                .x(d => x(d.x))
                .y(d => y(d.y))
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
}

function renderD3Heatmap(containerId, trace, title) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    const margin = {top: 40, right: 30, bottom: 60, left: 60};
    const width = container.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#" + containerId)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const hours = trace.x;
    const days = trace.y;
    const zData = trace.z;

    const x = d3.scaleBand()
        .range([ 0, width ])
        .domain(hours)
        .padding(0.01);
        
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("fill", "#cbd5e1");

    const y = d3.scaleBand()
        .range([ height, 0 ])
        .domain(days)
        .padding(0.01);
        
    svg.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("fill", "#cbd5e1");

    svg.append("text")
        .attr("x", (width / 2))             
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "14px") 
        .style("fill", "#f8fafc")
        .style("font-family", "Inter, sans-serif")
        .text(title);

    // Build color scale
    let allZ = [];
    zData.forEach(row => allZ = allZ.concat(row));
    const maxZ = d3.max(allZ) || 1;
    
    const myColor = d3.scaleSequential()
        .interpolator(d3.interpolateYlOrBr)
        .domain([0, maxZ]);

    let tooltip = d3.select(".d3-tooltip");

    const flattened = [];
    zData.forEach((row, j) => {
        row.forEach((val, i) => {
            flattened.push({
                x: hours[i],
                y: days[j],
                z: val
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
        .style("fill", d => myColor(d.z))
        .style("opacity", 0)
        .on("mouseover", function(event, d) {
            d3.select(this).style("stroke", "white").style("stroke-width", 1);
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`<b>${d.y} at ${d.x}:00</b><br/>Rush Density: ${d.z.toFixed(2)}
                <hr style="border: 0; border-top: 1px solid #334155; margin: 8px 0;"/>
                <div style="font-size: 11px; color: #cbd5e1;">Global Max Density: ${maxZ.toFixed(2)}</div>
            `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 40) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("stroke", "none");
            tooltip.transition().duration(500).style("opacity", 0);
        })
        .transition().duration(1000).delay((d,i) => i * 5)
        .style("opacity", 1);
}
