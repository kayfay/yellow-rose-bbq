function d3EscapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

function isMobileViewport() {
    return typeof window !== 'undefined' && window.innerWidth < 768;
}

function enforceMobileTouchSafety(container, svgNode) {
    const mobile = isMobileViewport();
    if (container) {
        container.style.touchAction = 'pan-y';
        container.style.pointerEvents = mobile ? 'none' : '';
        if (mobile) {
            container.classList.add('mobile-touch-safe-chart');
            container.setAttribute('data-mobile-static', 'true');
        } else {
            container.classList.remove('mobile-touch-safe-chart');
            container.removeAttribute('data-mobile-static');
        }
    }
    if (svgNode) {
        svgNode.style.touchAction = 'pan-y';
        svgNode.style.pointerEvents = mobile ? 'none' : 'auto';
    }
}

function injectMobileFaceCallouts(container, peakLabel, lowLabel, nowLabel) {
    if (!container) return;
    const existing = container.querySelector('.mobile-chart-face-badges');
    if (existing) existing.remove();
    const bar = document.createElement('div');
    bar.className = 'mobile-chart-face-badges';
    bar.innerHTML = `
        <span class="mobile-face-badge badge-peak">▲ PEAK: ${d3EscapeHTML(peakLabel)}</span>
        <span class="mobile-face-badge badge-low">▼ LOW: ${d3EscapeHTML(lowLabel)}</span>
        <span class="mobile-face-badge badge-now">● CURRENT: ${d3EscapeHTML(nowLabel)}</span>
    `;
    container.insertBefore(bar, container.firstChild);
}

function renderD3ForecastingChart(containerId, records, anomalies = [], selectedCat = 'baseline') {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!Array.isArray(records) || records.length === 0) return;

    const isMobile = isMobileViewport();

    // Format records into a cloned array without mutating the read-only input payload
    const formattedRecords = records.map(r => {
        if (!r) return null;
        let tRaw = r.turkey_raw_lbs;
        let tCooked = r.turkey_cooked_lbs || r.turkey_lbs;
        if (tRaw === undefined) {
            if (r.is_closed || r.day_name === 'Mon') {
                tRaw = 0;
                tCooked = 0;
            } else {
                const baselines = { 'Tue': 6.2, 'Wed': 7.2, 'Thu': 7.0, 'Fri': 11.5, 'Sat': 12.9, 'Sun': 8.9 };
                const baseCooked = baselines[r.day_name] || 6.0;
                const rev = r.predicted_revenue || 0;
                const benchmark = ['Fri', 'Sat', 'Sun'].includes(r.day_name) ? 3500 : 2800;
                const revMultiplier = rev > 0 ? Math.min(1.10, Math.max(0.90, rev / benchmark)) : 1.0;
                tCooked = Math.round(baseCooked * revMultiplier * 1.10 * 10) / 10;
                tRaw = Math.round((tCooked / 0.70) * 10) / 10;
            }
        }
        return {
            ...r,
            turkey_lbs: tRaw || (tCooked ? Math.round(tCooked / 0.70) : 0),
            pork_ribs_lbs: (r.pork_ribs_racks || 0) * 5,
            beef_dino_ribs_lbs: (r.beef_dino_ribs || 0) * 4,
            brisket_raw_lbs: r.brisket_raw_lbs || 0,
            pork_shoulder_raw_lbs: r.pork_shoulder_raw_lbs || 0,
            sausage_lbs: r.sausage_lbs || 0
        };
    }).filter(Boolean);

    if (formattedRecords.length === 0) return;

    // Remove duplicate legends/strips from prior renders while preserving SVG in-place
    d3.select("#" + containerId).selectAll(".d3-legend, .d3-mobile-summary-strip").remove();

    const margin = isMobile
        ? { top: 32, right: 20, bottom: 58, left: 48 }
        : { top: 40, right: 48, bottom: 64, left: 64 };
    const containerRect = container.getBoundingClientRect();
    const rawW = containerRect.width || (isMobile ? 340 : 800);
    const rawH = containerRect.height || (isMobile ? 280 : 380);
    const width = Math.max(rawW - margin.left - margin.right, 240);
    const height = Math.max(rawH - margin.top - margin.bottom, 180);

    let svgSelect = d3.select("#" + containerId).select("svg.d3-forecasting-svg");
    let svg;
    if (svgSelect.empty()) {
        container.innerHTML = '';
        svgSelect = d3.select("#" + containerId)
            .append("svg")
            .attr("class", "d3-forecasting-svg")
            .style("width", "100%")
            .style("height", "auto");
        svg = svgSelect.append("g")
            .attr("class", "d3-chart-root");
    } else {
        svg = svgSelect.select("g.d3-chart-root");
        svg.selectAll("*").remove();
    }

    svgSelect.attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);
    svg.attr("transform", `translate(${margin.left},${margin.top})`);
    enforceMobileTouchSafety(container, svgSelect.node());

    const dates = formattedRecords.map(r => `${r.date} (${r.day_name})`);
    const x = d3.scaleBand()
        .domain(dates)
        .range([0, width])
        .padding(0.22);

    const stackKeys = ['brisket_raw_lbs', 'pork_shoulder_raw_lbs', 'sausage_lbs', 'turkey_lbs', 'pork_ribs_lbs', 'beef_dino_ribs_lbs'];

    // Executive BI High-Contrast Palette (Okabe-Ito Colorblind Safe)
    const colorScale = d3.scaleOrdinal()
        .domain(stackKeys)
        .range(['#D55E00', '#E69F00', '#F0E442', '#56B4E9', '#CC79A7', '#009E73']);

    const prettyNames = {
        'brisket_raw_lbs': 'Brisket (Raw lbs)',
        'pork_shoulder_raw_lbs': 'Pork Shoulder (Raw lbs)',
        'sausage_lbs': 'Sausage (lbs)',
        'turkey_lbs': 'Turkey (Raw lbs)',
        'pork_ribs_lbs': 'Spare Ribs (lbs)',
        'beef_dino_ribs_lbs': 'Dino Ribs (lbs)'
    };

    let maxMeat = 100;
    let yAxisTitle = "Raw Prep Weight (lbs)";

    if (selectedCat === 'baseline') {
        const stackedData = d3.stack().keys(stackKeys)(formattedRecords);
        maxMeat = d3.max(stackedData[stackedData.length - 1], d => d[1]) || 100;
    } else {
        let keyToScale = selectedCat;
        if (selectedCat === 'brisket_lbs') keyToScale = 'brisket_raw_lbs';
        if (selectedCat === 'pork_ribs_racks') keyToScale = 'pork_ribs_lbs';
        if (selectedCat === 'beef_dino_ribs') keyToScale = 'beef_dino_ribs_lbs';
        if (selectedCat === 'sausage_links') keyToScale = 'sausage_lbs';
        if (selectedCat === 'pulled_pork_lbs') keyToScale = 'pork_shoulder_raw_lbs';
        if (selectedCat === 'turkey_lbs') keyToScale = 'turkey_lbs';
        if (selectedCat === 'tacos_sold') {
            keyToScale = 'tacos_sold';
            yAxisTitle = "Units Sold (Tacos)";
        }
        if (selectedCat === 'rosebuds' || selectedCat === 'rosebuds_sold') {
            keyToScale = 'rosebuds_sold';
            yAxisTitle = "Units Sold (Rosebuds)";
        }
        maxMeat = d3.max(formattedRecords, r => r[keyToScale] || 0) || 100;
    }

    const y = d3.scaleLinear()
        .domain([0, maxMeat * 1.15])
        .range([height, 0]);

    // Calibrated Gridlines
    svg.append("g")
        .attr("class", "grid")
        .style("stroke-dasharray", "3,3")
        .style("stroke-opacity", 0.14)
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""));

    // X Axis
    const tickSkip = (isMobile && dates.length > 7) ? 2 : 1;
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickValues(dates.filter((_, i) => i % tickSkip === 0)))
        .selectAll("text")
        .attr("transform", "translate(-8,8)rotate(-35)")
        .style("text-anchor", "end")
        .style("fill", "#94a3b8")
        .style("font-size", isMobile ? "9px" : "11px")
        .style("font-family", "JetBrains Mono, monospace");

    // Y Axis
    svg.append("g")
        .call(d3.axisLeft(y).ticks(5))
        .selectAll("text")
        .style("fill", "#94a3b8")
        .style("font-size", isMobile ? "9px" : "11px")
        .style("font-family", "JetBrains Mono, monospace");

    // Y Axis Title
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 12)
        .attr("x", 0 - (height / 2))
        .attr("dy", "0.8em")
        .style("text-anchor", "middle")
        .style("fill", "#cbd5e1")
        .style("font-size", isMobile ? "10px" : "11px")
        .style("font-weight", "600")
        .style("font-family", "Inter, sans-serif")
        .text(yAxisTitle);

    let tooltip = d3.select(".d3-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "d3-tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background", "rgba(15, 23, 42, 0.96)")
            .style("color", "#f8fafc")
            .style("padding", "10px 12px")
            .style("border-radius", "6px")
            .style("pointer-events", "none")
            .style("font-size", "12px")
            .style("font-family", "Inter, sans-serif")
            .style("border", "1px solid #334155")
            .style("box-shadow", "0 10px 15px -3px rgba(0, 0, 0, 0.5)")
            .style("z-index", 1000);
    }

    function hideTooltip() {
        d3.select(this).style("filter", "none");
        tooltip.transition().duration(250).style("opacity", 0);
    }

    if (selectedCat === 'baseline') {
        const stackedData = d3.stack().keys(stackKeys)(formattedRecords);

        const groups = svg.append("g")
            .selectAll("g")
            .data(stackedData)
            .join("g")
            .attr("fill", d => colorScale(d.key));

        const rects = groups.selectAll("rect")
            .data(d => d.map(item => { item.key = d.key; return item; }))
            .join("rect")
            .attr("x", d => x(`${d.data.date} (${d.data.day_name})`))
            .attr("y", d => y(d[1]))
            .attr("height", d => Math.max(0, y(d[0]) - y(d[1])))
            .attr("width", x.bandwidth())
            .attr("rx", 2);

        if (!isMobile) {
            rects.on("mouseover", function(event, d) {
                d3.select(this).style("filter", "brightness(1.2)");
                tooltip.transition().duration(150).style("opacity", 1);
                const segmentValue = (d[1] - d[0]).toFixed(1);
                let dayTotal = 0;
                stackKeys.forEach(k => dayTotal += (d.data[k] || 0));

                tooltip.html(`
                    <strong style="color: #38bdf8">${d3EscapeHTML(d.data.date)} (${d3EscapeHTML(d.data.day_name)})</strong><br/>
                    <span style="color: #94a3b8">${d3EscapeHTML(prettyNames[d.key])}:</span> <span style="font-weight: 700; font-family: JetBrains Mono, monospace;">${d3EscapeHTML(segmentValue)} lbs</span><br/>
                    <span style="color: #94a3b8">Day Total:</span> <span style="font-weight: 700; font-family: JetBrains Mono, monospace;">${d3EscapeHTML(dayTotal.toFixed(1))} lbs</span>
                `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 40) + "px");
            })
            .on("mouseout", hideTooltip);
        }

        const legendContainer = d3.select("#" + containerId).append("div")
            .attr("class", "d3-legend")
            .style("display", "flex")
            .style("flex-wrap", "wrap")
            .style("justify-content", "center")
            .style("margin-top", "12px")
            .style("gap", "10px")
            .style("padding", "8px 10px")
            .style("background", "rgba(15, 23, 42, 0.5)")
            .style("border-radius", "6px")
            .style("border", "1px solid #334155");

        stackKeys.forEach(key => {
            const legendItem = legendContainer.append("div")
                .style("display", "flex")
                .style("align-items", "center")
                .style("font-family", "Inter, sans-serif")
                .style("font-size", "11px")
                .style("color", "#cbd5e1");

            legendItem.append("div")
                .style("width", "12px")
                .style("height", "12px")
                .style("background-color", colorScale(key))
                .style("border-radius", "3px")
                .style("margin-right", "6px");

            legendItem.append("span").text(prettyNames[key]);
        });

        // Pre-baked Peak/Low/Current annotations for mobile & executive scan
        const openRecs = formattedRecords.filter(r => !r.is_closed && r.day_name !== 'Mon');
        const scanPool = openRecs.length > 0 ? openRecs : formattedRecords;
        const totals = scanPool.map(r => ({
            rec: r,
            total: stackKeys.reduce((acc, k) => acc + (r[k] || 0), 0)
        }));
        if (totals.length > 0) {
            const peakObj = totals.reduce((a, b) => (b.total > a.total ? b : a), totals[0]);
            const lowObj = totals.reduce((a, b) => (b.total < a.total ? b : a), totals[0]);
            const nowObj = totals[0];
            injectMobileFaceCallouts(
                container,
                `${peakObj.rec.day_name} (${Math.round(peakObj.total)} lbs)`,
                `${lowObj.rec.day_name} (${Math.round(lowObj.total)} lbs)`,
                `${nowObj.rec.day_name} (${Math.round(nowObj.total)} lbs)`
            );
            if (isMobile) {
                const px = x(`${peakObj.rec.date} (${peakObj.rec.day_name})`);
                if (px !== undefined) {
                    svg.append("text")
                        .attr("class", "d3-mobile-face-annotation")
                        .attr("x", px + x.bandwidth() / 2)
                        .attr("y", Math.max(12, y(peakObj.total) - 6))
                        .attr("text-anchor", "middle")
                        .style("fill", "#fbbf24")
                        .style("font-size", "10px")
                        .style("font-weight", "700")
                        .style("font-family", "JetBrains Mono, monospace")
                        .text(`▲ ${Math.round(peakObj.total)}#`);
                }
            }
        }
    } else {
        let key = selectedCat;
        if (selectedCat === 'brisket_lbs') key = 'brisket_raw_lbs';
        if (selectedCat === 'pork_ribs_racks') key = 'pork_ribs_lbs';
        if (selectedCat === 'beef_dino_ribs') key = 'beef_dino_ribs_lbs';
        if (selectedCat === 'sausage_links') key = 'sausage_lbs';
        if (selectedCat === 'pulled_pork_lbs') key = 'pork_shoulder_raw_lbs';
        if (selectedCat === 'turkey_lbs') key = 'turkey_lbs';
        if (selectedCat === 'tacos_sold') key = 'tacos_sold';
        if (selectedCat === 'rosebuds' || selectedCat === 'rosebuds_sold') key = 'rosebuds_sold';

        const isUnits = (key === 'tacos_sold' || key === 'rosebuds_sold');
        const unitLabel = isUnits ? 'Units' : 'lbs';

        let color = '#38bdf8';
        if (stackKeys.includes(key)) color = colorScale(key);
        if (key === 'tacos_sold') color = '#10b981';
        if (key === 'rosebuds_sold') color = '#a855f7';

        const values = formattedRecords.map(r => Number(r[key]) || 0);
        const min = (d3.min(values) || 0).toFixed(1);
        const max = (d3.max(values) || 0).toFixed(1);
        const mean = (d3.mean(values) || 0).toFixed(1);

        const defs = svg.append("defs");
        const gradientId = `areaGradient-${key}`;
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "0%").attr("y2", "100%");
        gradient.append("stop").attr("offset", "0%").style("stop-color", color).style("stop-opacity", 0.45);
        gradient.append("stop").attr("offset", "100%").style("stop-color", color).style("stop-opacity", 0.02);

        const area = d3.area()
            .defined(r => r && r[key] != null && !isNaN(r[key]))
            .x(r => x(`${r.date} (${r.day_name})`) + x.bandwidth() / 2)
            .y0(y(0))
            .y1(r => y(r[key] || 0))
            .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(formattedRecords)
            .attr("fill", `url(#${gradientId})`)
            .attr("d", area);

        const line = d3.line()
            .defined(r => r && r[key] != null && !isNaN(r[key]))
            .x(r => x(`${r.date} (${r.day_name})`) + x.bandwidth() / 2)
            .y(r => y(r[key] || 0))
            .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(formattedRecords)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 3)
            .attr("d", line);

        const dots = svg.append("g").selectAll("circle")
            .data(formattedRecords)
            .join("circle")
            .attr("cx", r => x(`${r.date} (${r.day_name})`) + x.bandwidth() / 2)
            .attr("cy", r => y(r[key] || 0))
            .attr("r", isMobile ? 4 : 5)
            .attr("fill", "#0f172a")
            .attr("stroke", color)
            .attr("stroke-width", 2.5);

        if (!isMobile) {
            dots.on("mouseover", function(event, r) {
                d3.select(this).attr("r", 8).style("filter", "brightness(1.4)");
                tooltip.transition().duration(150).style("opacity", 1);
                tooltip.html(`
                    <strong style="color: #38bdf8">${d3EscapeHTML(r.date)} (${d3EscapeHTML(r.day_name)})</strong><br/>
                    <span style="color: #94a3b8">Target:</span> <span style="font-weight: 700; font-family: JetBrains Mono, monospace;">${d3EscapeHTML(r[key] || 0)} ${d3EscapeHTML(unitLabel)}</span>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">Peak: ${d3EscapeHTML(max)} | Avg: ${d3EscapeHTML(mean)} | Min: ${d3EscapeHTML(min)}</div>
                `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 40) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("r", 5).style("filter", "none");
                hideTooltip.call(this);
            });
        }

        const openSingle = formattedRecords.filter(r => !r.is_closed && r.day_name !== 'Mon');
        const singlePool = openSingle.length > 0 ? openSingle : formattedRecords;
        if (singlePool.length > 0) {
            const peakRec = singlePool.reduce((a, b) => ((b[key] || 0) > (a[key] || 0) ? b : a), singlePool[0]);
            const lowRec = singlePool.reduce((a, b) => ((b[key] || 0) < (a[key] || 0) ? b : a), singlePool[0]);
            const nowRec = singlePool[0];
            injectMobileFaceCallouts(
                container,
                `${peakRec.day_name} (${peakRec[key] || 0} ${unitLabel})`,
                `${lowRec.day_name} (${lowRec[key] || 0} ${unitLabel})`,
                `${nowRec.day_name} (${nowRec[key] || 0} ${unitLabel})`
            );
        }
    }

    if (anomalies && anomalies.length > 0) {
        anomalies.forEach(anomaly => {
            const record = formattedRecords.find(r => r.date === anomaly.date);
            if (record) {
                const bandX = x(`${record.date} (${record.day_name})`);
                if (bandX === undefined) return;
                const xPos = bandX + x.bandwidth() / 2;

                const marker = svg.append("g")
                    .attr("transform", `translate(${xPos}, ${height + 16})`);

                if (!isMobile) {
                    marker.style("cursor", "pointer")
                        .on("mouseover", function(event) {
                            tooltip.transition().duration(150).style("opacity", 1);
                            tooltip.html(`
                                <strong style="color: #ef4444">Anomaly Flagged</strong><br/>
                                <span style="color: #94a3b8">Date:</span> ${d3EscapeHTML(anomaly.date)}<br/>
                                <span style="color: #94a3b8">Type:</span> ${d3EscapeHTML(anomaly.type)}
                            `)
                            .style("left", (event.pageX + 15) + "px")
                            .style("top", (event.pageY - 40) + "px");
                        })
                        .on("mouseout", hideTooltip);
                }

                marker.append("circle")
                    .attr("r", 5)
                    .attr("fill", anomaly.severity === 'high' ? "#ef4444" : "#f59e0b")
                    .attr("stroke", "#0f172a")
                    .attr("stroke-width", 1.5);
            }
        });
    }
}

function renderD3GenericChart(containerId, traces, title, isBar = false, shift = 'all') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!Array.isArray(traces) || traces.length === 0 || !traces[0] || !traces[0].x) {
        container.innerHTML = '<div style="padding: 24px; text-align: center; color: #94a3b8; font-family: Inter, sans-serif; font-size: 13px;">No chart data available</div>';
        return;
    }

    if (traces[0].type === 'heatmap') {
        renderD3Heatmap(containerId, traces[0], title, shift);
        return;
    }

    container.innerHTML = '';
    const isMobile = isMobileViewport();

    const margin = isMobile
        ? { top: 34, right: 24, bottom: 56, left: 48 }
        : { top: 40, right: 44, bottom: 60, left: 60 };
    const containerRect = container.getBoundingClientRect();
    const width = Math.max((containerRect.width || (isMobile ? 340 : 800)) - margin.left - margin.right, 240);
    const height = Math.max((containerRect.height || 300) - margin.top - margin.bottom, 180);

    const svgRoot = d3.select("#" + containerId)
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .style("width", "100%")
        .style("height", "auto");

    enforceMobileTouchSafety(container, svgRoot.node());

    const svg = svgRoot.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const dates = traces[0].x;
    const xBand = d3.scaleBand().domain(dates).range([0, width]).padding(0.22);

    const yScales = [];
    traces.forEach((trace, i) => {
        const validY = (trace.y || []).filter(v => v != null && !isNaN(v));
        const tMax = d3.max(validY) || 10;
        const scale = d3.scaleLinear().domain([0, tMax * 1.15]).range([height, 0]);
        yScales.push(scale);

        if (i === 0) {
            svg.append("g")
                .attr("class", "grid")
                .style("stroke-dasharray", "3,3")
                .style("stroke-opacity", 0.14)
                .call(d3.axisLeft(scale).ticks(5).tickSize(-width).tickFormat(""));
            svg.append("g").call(d3.axisLeft(scale).ticks(5)).selectAll("text")
                .style("fill", "#94a3b8")
                .style("font-family", "JetBrains Mono, monospace");
        } else if (i === 1) {
            svg.append("g").attr("transform", `translate(${width},0)`).call(d3.axisRight(scale).ticks(5)).selectAll("text")
                .style("fill", "#38bdf8")
                .style("font-family", "JetBrains Mono, monospace");
        }
    });

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xBand))
        .selectAll("text")
        .attr("transform", "translate(-8,8)rotate(-35)")
        .style("text-anchor", "end")
        .style("fill", "#94a3b8")
        .style("font-size", isMobile ? "9px" : "10px");

    svg.append("text")
        .attr("x", (width / 2))
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")
        .style("font-size", isMobile ? "12px" : "13px")
        .style("font-weight", "600")
        .style("fill", "#f8fafc")
        .style("font-family", "Inter, sans-serif")
        .text(title || "");

    let tooltip = d3.select(".d3-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div").attr("class", "d3-tooltip")
            .style("opacity", 0).style("position", "absolute")
            .style("background", "rgba(15, 23, 42, 0.96)").style("color", "#f8fafc")
            .style("padding", "10px 12px").style("border-radius", "6px")
            .style("pointer-events", "none").style("font-size", "12px")
            .style("font-family", "Inter, sans-serif").style("border", "1px solid #334155")
            .style("z-index", 1000);
    }

    traces.forEach((trace, i) => {
        const color = trace.marker?.color || trace.line?.color || ['#3b82f6', '#f59e0b', '#10b981', '#a855f7'][i % 4];
        const traceY = yScales[i];

        if (trace.type === 'bar' || isBar) {
            const barTracesCount = traces.filter(t => t.type === 'bar' || isBar).length;
            const subBandwidth = xBand.bandwidth() / (barTracesCount || 1);
            const barIndex = traces.slice(0, i).filter(t => t.type === 'bar' || isBar).length;

            const rects = svg.append("g")
                .selectAll("rect")
                .data(trace.x.map((d, j) => ({ x: d, y: Number(trace.y[j]) || 0, idx: j })))
                .join("rect")
                .attr("x", d => (xBand(d.x) || 0) + (barIndex * subBandwidth))
                .attr("y", d => traceY(d.y))
                .attr("width", subBandwidth)
                .attr("height", d => Math.max(0, height - traceY(d.y)))
                .attr("fill", d => Array.isArray(color) ? color[d.idx % color.length] : color)
                .attr("rx", 2);

            if (!isMobile) {
                rects.on("mouseover", function(event, d) {
                    tooltip.transition().duration(150).style("opacity", 1);
                    tooltip.html(`<strong>${d3EscapeHTML(d.x)}</strong><br/>Value: <span style="font-family:JetBrains Mono,monospace;font-weight:700;">${d3EscapeHTML(d.y)}</span>`)
                        .style("left", (event.pageX + 15) + "px")
                        .style("top", (event.pageY - 40) + "px");
                })
                .on("mouseout", () => tooltip.transition().duration(250).style("opacity", 0));
            }
        } else {
            const line = d3.line()
                .defined(d => d.y != null && !isNaN(d.y))
                .x(d => (xBand(d.x) || 0) + xBand.bandwidth() / 2)
                .y(d => traceY(d.y))
                .curve(d3.curveMonotoneX);

            svg.append("path")
                .datum(trace.x.map((d, j) => ({ x: d, y: trace.y[j] })))
                .attr("fill", "none")
                .attr("stroke", Array.isArray(color) ? color[0] : color)
                .attr("stroke-width", 2.5)
                .attr("d", line);
        }
    });
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
    if (!container || !trace || !trace.x) return;
    container.innerHTML = '';

    const isMobile = isMobileViewport();
    const margin = isMobile
        ? { top: 34, right: 16, bottom: 52, left: 64 }
        : { top: 40, right: 30, bottom: 60, left: 80 };
    const containerRect = container.getBoundingClientRect();
    const width = Math.max((containerRect.width || (isMobile ? 340 : 800)) - margin.left - margin.right, 240);
    const height = Math.max((containerRect.height || 320) - margin.top - margin.bottom, 180);

    const svgRoot = d3.select("#" + containerId)
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .style("width", "100%")
        .style("height", "auto");

    enforceMobileTouchSafety(container, svgRoot.node());

    const svg = svgRoot.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const allHours = trace.x || [];
    const days = trace.y || [];
    const rawZ = trace.z || [];

    let hourStart = 0;
    let hourEnd = 23;
    let shiftTitle = title || "Hourly Sales Demand Heatmap";

    if (shift === 'prep') {
        hourStart = 4;
        hourEnd = 13;
        shiftTitle = "Morning Prep Heatmap (4:00 AM – 1:00 PM)";
    } else if (shift === 'lunch') {
        hourStart = 10;
        hourEnd = 16;
        shiftTitle = "Lunch Window Heatmap (10:00 AM – 4:00 PM)";
    } else if (shift === 'dinner') {
        hourStart = 16;
        hourEnd = 22;
        shiftTitle = "Dinner Rush Heatmap (4:00 PM – 10:00 PM)";
    } else if (shift === 'custom') {
        hourStart = 2;
        hourEnd = 22;
        shiftTitle = "Cook & Service Shifts (2:00 AM – 10:00 PM)";
    } else {
        shiftTitle = "Hourly Demand Heatmap (All Hours: 12 AM – 11 PM)";
    }

    const selectedIndices = [];
    allHours.forEach((hrStr, idx) => {
        const h = parseInt(hrStr, 10);
        if (!isNaN(h)) {
            if (h >= hourStart && h <= hourEnd) selectedIndices.push(idx);
        } else {
            selectedIndices.push(idx);
        }
    });

    const hours = selectedIndices.length > 0 ? selectedIndices.map(i => allHours[i]) : allHours;
    const zData = selectedIndices.length > 0 ? rawZ.map(row => selectedIndices.map(i => row[i])) : rawZ;

    const x = d3.scaleBand().range([0, width]).domain(hours).padding(0.05);
    const y = d3.scaleBand().range([height, 0]).domain(days).padding(0.05);

    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).tickFormat(d => formatHourAMPM(d, false)))
        .selectAll("text")
        .style("fill", "#94a3b8")
        .style("font-family", "JetBrains Mono, monospace")
        .style("font-size", isMobile ? "8.5px" : "10px")
        .attr("transform", "translate(-4, 4) rotate(-35)")
        .style("text-anchor", "end");

    svg.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("fill", "#cbd5e1")
        .style("font-family", "Inter, sans-serif")
        .style("font-size", isMobile ? "10px" : "11px");

    svg.append("text")
        .attr("class", "heatmap-title")
        .attr("x", (width / 2))
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")
        .style("font-size", isMobile ? "12px" : "13px")
        .style("font-weight", "600")
        .style("fill", "#f8fafc")
        .style("font-family", "Inter, sans-serif")
        .text(shiftTitle);

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
            .style("background", "rgba(15, 23, 42, 0.96)")
            .style("color", "#f8fafc")
            .style("padding", "10px 12px")
            .style("border-radius", "6px")
            .style("pointer-events", "none")
            .style("font-size", "12px")
            .style("font-family", "Inter, sans-serif")
            .style("border", "1px solid #334155")
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

    const cells = svg.selectAll("rect.heatmap-cell")
        .data(flattened, d => d.x + ':' + d.y)
        .join("rect")
        .attr("class", "heatmap-cell")
        .attr("x", d => x(d.x))
        .attr("y", d => y(d.y))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("rx", 2)
        .style("fill", d => myColor(d.z));

    if (!isMobile) {
        cells.on("mouseover", function(event, d) {
            d3.select(this).style("stroke", "#38bdf8").style("stroke-width", 2);
            tooltip.transition().duration(150).style("opacity", 1);
            tooltip.html(`
                <strong style="color: #38bdf8">${d3EscapeHTML(d.y)} @ ${d3EscapeHTML(formatHourAMPM(d.x, true))}</strong><br/>
                <span style="color: #94a3b8">Rush Density:</span> <span style="font-weight: 700; font-family: JetBrains Mono, monospace;">${d3EscapeHTML(d.z.toFixed(2))}x</span>
            `)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 40) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("stroke", "none");
            tooltip.transition().duration(250).style("opacity", 0);
        });
    }

    const legendContainer = d3.select("#" + containerId).append("div")
        .attr("class", "d3-heatmap-legend")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("margin-top", "12px")
        .style("gap", "10px")
        .style("padding", "8px 10px")
        .style("background", "rgba(15, 23, 42, 0.5)")
        .style("border-radius", "6px")
        .style("border", "1px solid #334155");

    legendContainer.append("span")
        .style("font-size", "11px")
        .style("color", "#94a3b8")
        .text("Low (0.0x)");

    const gradientStops = [];
    for (let i = 0; i <= 10; i++) {
        gradientStops.push(myColor(maxZ * (i / 10)));
    }

    legendContainer.append("div")
        .style("width", "140px")
        .style("height", "12px")
        .style("border-radius", "3px")
        .style("background", `linear-gradient(to right, ${gradientStops.join(', ')})`);

    legendContainer.append("span")
        .style("font-size", "11px")
        .style("color", "#f8fafc")
        .text(`Peak (${maxZ.toFixed(1)}x)`);
}

function renderMonthEventsCalendar(containerId, year, month, activeFilter = 'all', onSelectDate = null, selectedDateStr = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const titleElem = document.getElementById('cal-month-title');
    if (titleElem) {
        titleElem.textContent = `${monthNames[month]} ${year}`;
    }

    const rawCal = window.BBQ_PAYLOADS && window.BBQ_PAYLOADS.calendar_events;
    const allEvents = Array.isArray(rawCal)
        ? rawCal
        : (rawCal && Array.isArray(rawCal.events) ? rawCal.events : []);

    weekdays.forEach(day => {
        const header = document.createElement('div');
        header.className = 'cal-weekday-header';
        header.textContent = day;
        container.appendChild(header);
    });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = (window.ShopTime && typeof window.ShopTime.shopDateStr === 'function')
        ? window.ShopTime.shopDateStr()
        : `${(new Date()).getFullYear()}-${String((new Date()).getMonth() + 1).padStart(2, '0')}-${String((new Date()).getDate()).padStart(2, '0')}`;

    function getBaselineMultiplier(dow) {
        if (dow === 6) return '1.8x';
        if (dow === 5) return '1.4x';
        if (dow === 0) return '1.2x';
        if (dow === 1) return '0.0x';
        return '1.0x';
    }

    const totalCells = (firstDayIndex + daysInMonth > 35) ? 42 : 35;

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell';

        let cellDateYear = year;
        let cellDateMonth = month;
        let dayNum = 0;

        if (i < firstDayIndex) {
            dayNum = daysInPrevMonth - firstDayIndex + i + 1;
            cellDateMonth = month - 1;
            if (cellDateMonth < 0) {
                cellDateMonth = 11;
                cellDateYear = year - 1;
            }
            cell.classList.add('other-month');
        } else if (i >= firstDayIndex + daysInMonth) {
            dayNum = i - (firstDayIndex + daysInMonth) + 1;
            cellDateMonth = month + 1;
            if (cellDateMonth > 11) {
                cellDateMonth = 0;
                cellDateYear = year + 1;
            }
            cell.classList.add('other-month');
        } else {
            dayNum = i - firstDayIndex + 1;
        }

        const dateStr = `${cellDateYear}-${String(cellDateMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const dayOfWeek = (i % 7);

        if (dateStr === todayStr) cell.classList.add('is-today');
        if (selectedDateStr && dateStr === selectedDateStr) cell.classList.add('is-selected');

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

        const dayEvents = allEvents.filter(e => e && e.date === dateStr);
        let matchingEvent = null;

        dayEvents.forEach(evt => {
            if (activeFilter !== 'all' && evt.category !== activeFilter) return;
            matchingEvent = evt;

            const pill = document.createElement('div');
            const safeCat = String(evt.category || 'event').replace(/[^a-z0-9_-]/gi, '');
            pill.className = `cal-event-pill pill-${safeCat}`;
            if (evt.title && evt.title.includes("Florida vs. Georgia")) {
                pill.className = 'cal-event-pill pill-flga';
                cell.classList.add('has-flga');
            } else if (evt.category === 'jaguars') {
                cell.classList.add('has-stadium');
            }

            pill.innerHTML = `
                <span>${d3EscapeHTML(evt.icon || '🔥')} ${d3EscapeHTML(evt.title || '')}</span>
                <span class="cal-multiplier-badge">${d3EscapeHTML(evt.multiplier ?? 1.0)}x</span>
            `;
            cell.appendChild(pill);
        });

        if (activeFilter === 'all' || activeFilter === 'delivery') {
            if (dayOfWeek === 6 || dayOfWeek === 1 || dayOfWeek === 4) {
                const orderTag = document.createElement('div');
                orderTag.className = 'cal-order-tag';
                orderTag.textContent = '📦 Order Cutoff';
                cell.appendChild(orderTag);
            } else if (dayOfWeek === 0) {
                const delTag = document.createElement('div');
                delTag.className = 'cal-delivery-tag';
                delTag.textContent = '🚚 Sun Delivery';
                cell.appendChild(delTag);
            } else if (dayOfWeek === 2) {
                const delTag = document.createElement('div');
                delTag.className = 'cal-delivery-tag';
                delTag.textContent = '🚚 Tue Delivery';
                cell.appendChild(delTag);
            } else if (dayOfWeek === 5) {
                const delTag = document.createElement('div');
                delTag.className = 'cal-delivery-tag';
                delTag.textContent = '🚚 Fri Delivery';
                cell.appendChild(delTag);
            }
        }

        cell.addEventListener('click', () => {
            document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('is-selected'));
            cell.classList.add('is-selected');

            if (onSelectDate) {
                onSelectDate(dateStr, matchingEvent || {
                    date: dateStr,
                    title: `Standard Service (${weekdays[dayOfWeek]})`,
                    multiplier: parseFloat(getBaselineMultiplier(dayOfWeek)) || 1.0,
                    note: dayOfWeek === 1 ? "Closed for Monday pit maintenance." : "Baseline smokehouse demand."
                });
            }
        });

        container.appendChild(cell);
    }
}
