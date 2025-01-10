// Global variables
let data;
let currentYear;
let isPlaying = false;
let animationFrame;
let svg;
let xAxis;
let yearLabel;
let speed = 1;
let pauseTimeout;

const width = Math.min(1400, window.innerWidth - 40);
const height = Math.min(800, window.innerHeight - 200);
const margin = { top: 50, right: 200, bottom: 50, left: 200 };
const formatNumber = d3.format(",.0f");
let barHeight = 50;
let duration = 600;
let n = 15;
let barRoundness = 4;
let borderColor = "#ffffff";
let borderWidth = 2;

// Cookie functions
function saveSettingsToCookie() {
    const settings = {
        barHeight,
        n,
        barRoundness,
        borderColor,
        borderWidth
    };
    document.cookie = `chartSettings=${JSON.stringify(settings)}; expires=${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()}; path=/`;
}

function loadSettingsFromCookie() {
    const cookie = document.cookie.split('; ').find(row => row.startsWith('chartSettings='));
    if (cookie) {
        const settings = JSON.parse(cookie.split('=')[1]);
        barHeight = settings.barHeight || 50;
        n = settings.n || 15;
        barRoundness = settings.barRoundness || 4;
        borderColor = settings.borderColor || "#ffffff";
        borderWidth = settings.borderWidth || 2;

        // Update UI controls
        d3.select("#barHeight").property("value", barHeight);
        d3.select("#numBars").property("value", n);
        d3.select("#barRoundness").property("value", barRoundness);
        d3.select("#borderColor").property("value", borderColor);
        d3.select("#borderWidth").property("value", borderWidth);
        d3.select("#borderWidthValue").text(borderWidth + "px");
    }
}

// Define a custom color scale
const colorScale = d3.scaleOrdinal(d3.schemeTableau10.concat(d3.schemeSet3));

// Modified initVisualization function
async function initVisualization() {
    try {
        const response = await fetch('gdp.json');
        const jsonData = await response.json();

        // Get available years (years that have data)
        const availableYears = Object.keys(jsonData.data).sort();
        
        // Store the data in the global data variable
        data = {
            name: jsonData.name || "Total",
            years: availableYears,
            data: jsonData.data
        };

        // Initialize with first year
        currentYear = availableYears[0];
        
        // Initialize SVG
        svg = d3.select("#chart")
            .html("") // Clear loading message
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        // Rest of the initialization code remains the same
        svg.append("g")
            .attr("class", "grid-lines");

        xAxis = svg.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(0,${margin.top})`);

        yearLabel = svg.append("text")
            .attr("class", "year-label")
            .attr("x", width - 300) // Moved further left
            .attr("y", height - 80)
            .attr("font-size", "120px")
            .attr("text-anchor", "start") // Ensure consistent alignment
            .style("opacity", 0.15);

        // Create legend
        createLegend(data.data[currentYear]);

        // Start visualization
        updateChart(currentYear);
        
        // Update year slider with available years
        const yearSlider = d3.select("#yearSlider")
            .attr("min", availableYears[0])
            .attr("max", availableYears[availableYears.length - 1])
            .attr("value", currentYear)
            .attr("step", 1);

        // Update year display
        d3.select("#yearDisplay").text(currentYear);
        
        setupEventListeners();
        setupConfigurationListeners();
        
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
            loadingMessage.textContent = 'Error loading data: ' + error;
        }
    }
}



// Modify yearSlider setup in setupEventListeners
function setupEventListeners() {
    d3.select("#playButton").on("click", togglePlay);
    
    const yearSlider = d3.select("#yearSlider");
    yearSlider
        .on("input", function() {
            currentYear = +this.value;
            d3.select("#yearDisplay").text(currentYear);
            updateChart(currentYear);
            stopAnimation();
        });

    d3.select("#speedSelect").on("change", function() {
        speed = +this.value;
        if (isPlaying) {
            stopAnimation();
            updateChart(currentYear);
        }
    });
}

function createLegend(data) {
    const legend = d3.select(".legend");
    legend.html("");
    
    const items = legend.selectAll(".legend-item")
        .data(data)
        .enter()
        .append("div")
        .attr("class", "legend-item");

    items.append("div")
        .attr("class", "legend-color")
        .style("background-color", d => colorScale(d.Y_Parameter));

    items.append("span")
        .text(d => `${d.flag} ${d.Y_Parameter}`);
}

function updateChart(currentYear) {
    // Get current data
    let currentData = data.data[currentYear];
    if (!currentData) return;

    // Sort data by value
    currentData.sort((a, b) => b.value - a.value);

    // Take top n items
    currentData = currentData.slice(0, n);

    // Calculate total
    const total = currentData.reduce((sum, d) => sum + d.value, 0);

    // Update or create stats text
    const statsGroup = svg.selectAll(".stats-group").data([0]);
    const statsEnter = statsGroup.enter()
        .append("g")
        .attr("class", "stats-group")
        .attr("transform", `translate(${width - 400}, ${height - 200})`);

    // Add total value
    statsEnter.append("text")
        .attr("class", "total-value")
        .attr("y", 0)
        .attr("text-anchor", "middle")
        .style("fill", "#888")
        .style("font-size", "48px");

    // Add total label
    statsEnter.append("text")
        .attr("class", "total-label")
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .style("fill", "#666")
        .style("font-size", "24px")
        .text(`Total ${data.name}`);

    // Add year display
    statsEnter.append("text")
        .attr("class", "year-display")
        .attr("y", 140)
        .attr("text-anchor", "middle")
        .style("fill", "rgba(255, 255, 255, 0.15)")
        .style("font-size", "160px")
        .style("font-weight", "bold")
        .style("font-family", "Arial");

    // Update total value
    svg.select(".total-value")
        .text(formatNumber(total));

    // Update total label if needed
    svg.select(".total-label")
        .text(`Total ${data.name}`);

    // Update year display
    svg.select(".year-display")
        .text(currentYear);

    // Keep track of previous positions
    const previousData = svg.selectAll("rect").data();
    const previousPositions = new Map(previousData.map(d => [d.Y_Parameter, d]));

    // Set up growth values for animation
    const targetValues = new Map();
    const growthIncrements = new Map();

    // Find next year's data
    const yearIndex = data.years.indexOf(currentYear.toString());
    if (yearIndex < data.years.length - 1) {
        // Find the next year that has data
        let nextYearWithData = null;
        for (let i = yearIndex + 1; i < data.years.length; i++) {
            const nextYear = data.years[i];
            if (data.data[nextYear]) {
                nextYearWithData = nextYear;
                break;
            }
        }

        if (nextYearWithData) {
            const nextYearData = data.data[nextYearWithData];
            const numSteps = 100; // Number of animation steps
            
            currentData.forEach(d => {
                const nextYearValue = nextYearData.find(nd => nd.Y_Parameter === d.Y_Parameter)?.value;
                if (nextYearValue !== undefined) {
                    targetValues.set(d.Y_Parameter, nextYearValue);
                    const totalDifference = nextYearValue - d.value;
                    // Divide by more steps for smoother animation when gap is large
                    const yearDiff = parseInt(nextYearWithData) - parseInt(currentYear);
                    growthIncrements.set(d.Y_Parameter, totalDifference / (numSteps * yearDiff));
                } else {
                    targetValues.set(d.Y_Parameter, d.value);
                    growthIncrements.set(d.Y_Parameter, 0);
                }
            });
        } else {
            currentData.forEach(d => {
                targetValues.set(d.Y_Parameter, d.value);
                growthIncrements.set(d.Y_Parameter, 0);
            });
        }
    } else {
        currentData.forEach(d => {
            targetValues.set(d.Y_Parameter, d.value);
            growthIncrements.set(d.Y_Parameter, 0);
        });
    }

    function updateBars(data) {
        const x = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.value) * 1.1])
            .range([margin.left, width - margin.right]);

        const y = d3.scaleBand()
            .domain(data.map(d => d.Y_Parameter))
            .range([margin.top, margin.top + data.length * barHeight])
            .padding(0.2);

        // Update bars with proper transition
        const bars = svg.selectAll("rect")
            .data(data, d => d.Y_Parameter);

        // Remove bars that are no longer needed
        bars.exit()
            .transition()
            .duration(duration / 4)
            .attr("width", 0)
            .remove();

        // Add new bars - starting from bottom
        const barsEnter = bars.enter()
            .append("rect")
            .attr("height", y.bandwidth())
            .attr("x", margin.left)
            .style("fill", d => d.color)
            .style("opacity", 1)
            .style("stroke", borderColor)
            .style("stroke-width", borderWidth + "px")
            .attr("rx", barRoundness)
            .attr("ry", barRoundness)
            .attr("y", height) // Start from bottom
            .attr("width", 0);

        // Update all bars with transition
        bars.merge(barsEnter)
            .transition()
            .duration(duration / 2)
            .attr("y", d => y(d.Y_Parameter))
            .attr("width", d => x(d.value) - margin.left)
            .attr("height", y.bandwidth())
            .attr("rx", barRoundness)
            .attr("ry", barRoundness)
            .style("opacity", 1)
            .style("stroke", borderColor)
            .style("stroke-width", borderWidth + "px");

        // Update labels
        const labels = svg.selectAll(".label-group")
            .data(data, d => d.Y_Parameter);

        // Remove old labels
        labels.exit().remove();

        // Add new labels - starting from bottom
        const labelsEnter = labels.enter()
            .append("g")
            .attr("class", "label-group")
            .attr("transform", `translate(0,${height})`); // Start from bottom

        // Add country labels (left side)
        labelsEnter.append("text")
            .attr("class", "country-label")
            .attr("x", margin.left - 15)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .text(d => `${d.Y_Parameter} ${d.flag}`);

        // Add value labels (right side of bars)
        labelsEnter.append("text")
            .attr("class", "value-label")
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .text(d => formatNumber(d.value));

        // Update all labels
        const labelGroups = labels.merge(labelsEnter);
        
        // Update group positions
        labelGroups.transition()
            .duration(duration / 2)
            .attr("transform", d => `translate(0,${y(d.Y_Parameter) + y.bandwidth() / 2})`);

        // Update value label positions to follow bar ends
        labelGroups.select(".value-label")
            .transition()
            .duration(duration / 2)
            .attr("x", d => x(d.value) + 5) // Position right after bar end
            .text(d => formatNumber(d.value));

        updateAxis(x);
    }

    // Initial render
    updateBars(currentData);

    // Start growth animation if playing
    if (isPlaying) {
        applyGrowth();
    }

    function applyGrowth() {
        let anyValueChanged = false;
        currentData = currentData.map(d => {
            const currentValue = d.value;
            const targetValue = targetValues.get(d.Y_Parameter);
            const increment = growthIncrements.get(d.Y_Parameter) * speed * 2;
            
            let nextValue = currentValue;
            if (Math.abs(targetValue - currentValue) > Math.abs(increment)) {
                nextValue = currentValue + increment;
                anyValueChanged = true;
            } else {
                nextValue = targetValue;
            }
            
            return { ...d, value: nextValue };
        });

        const topItemIncrement = Math.abs(growthIncrements.get(currentData[0].Y_Parameter));
        const absValueDisplay = document.getElementById('currentAbsolutValue');
        if (absValueDisplay) {
            absValueDisplay.value = formatNumber(topItemIncrement);
        }

        // Sort before updating visualization
        currentData.sort((a, b) => b.value - a.value);
        
        // Update the visualization with less frequent updates
        if (anyValueChanged) {
            // Only update every other frame to reduce visual updates
            if (Date.now() % 2 === 0) {
                updateBars(currentData);
            }
            animationFrame = requestAnimationFrame(applyGrowth);
        } else if (isPlaying) {
            const yearIndex = data.years.indexOf(currentYear.toString());
            if (yearIndex < data.years.length - 1) {
                currentYear = data.years[yearIndex + 1];
                updateChart(currentYear);
            } else {
                stopAnimation();
            }
        }
    }

    // Update year display
    d3.select("#yearSlider").property("value", currentYear);
    d3.select("#yearDisplay").text(currentYear);
}

function updateLabels(data, x, y, adjustedDuration) {
    const labels = svg.selectAll(".label-group")
        .data(data, d => d.Y_Parameter);

    // Remove old labels
    labels.exit().remove();

    // Create new label groups
    const labelsEnter = labels.enter()
        .append("g")
        .attr("class", "label-group");

    // Add flag labels
    labelsEnter.append("text")
        .attr("class", "flag-label")
        .attr("x", margin.left - 30)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .text(d => d.flag);

    // Add country labels
    labelsEnter.append("text")
        .attr("class", "country-label")
        .attr("x", margin.left - 15)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .text(d => d.Y_Parameter);

    // Add value labels
    labelsEnter.append("text")
        .attr("class", "value-label")
        .attr("x", d => x(d.value) + 5)
        .attr("dy", "0.35em")
        .text(d => formatNumber(d.value));

    // Update all labels
    const allLabels = labels.merge(labelsEnter);

    // Update flag positions
    allLabels.select(".flag-label")
        .transition()
        .duration(adjustedDuration / 2)
        .attr("y", d => y(d.Y_Parameter) + y.bandwidth() / 2);

    // Update country name positions
    allLabels.select(".country-label")
        .transition()
        .duration(adjustedDuration / 2)
        .attr("y", d => y(d.Y_Parameter) + y.bandwidth() / 2);

    // Update value label positions and text
    allLabels.select(".value-label")
        .transition()
        .duration(adjustedDuration / 4)
        .attr("x", d => x(d.value) + 5)
        .attr("y", d => y(d.Y_Parameter) + y.bandwidth() / 2)
        .text(d => formatNumber(d.value));
}

function updateAxis(x) {
    const xAxis_g = d3.axisTop(x)
        .ticks(5)
        .tickSize(-height + margin.top + margin.bottom)
        .tickFormat(d3.format(",.0f"));

    xAxis.call(xAxis_g)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line")
            .attr("stroke", "#444")
            .attr("stroke-dasharray", "2,2"));
}

function togglePlay() {
    isPlaying = !isPlaying;
    d3.select("#playButton").text(isPlaying ? "Pause" : "Play");
    if (isPlaying) {
        updateChart(currentYear);
    } else {
        if (pauseTimeout) clearTimeout(pauseTimeout);
        if (animationFrame) cancelAnimationFrame(animationFrame);
    }
}

function stopAnimation() {
    isPlaying = false;
    d3.select("#playButton").text("Play");
    if (pauseTimeout) clearTimeout(pauseTimeout);
    if (animationFrame) cancelAnimationFrame(animationFrame);
}

function setupConfigurationListeners() {
    d3.select("#barHeight").on("input", function() {
        barHeight = +this.value;
        updateChartConfiguration();
        saveSettingsToCookie();
    });

    d3.select("#numBars").on("input", function() {
        n = +this.value;
        updateChartConfiguration();
        saveSettingsToCookie();
    });

    d3.select("#barRoundness").on("input", function() {
        barRoundness = +this.value;
        updateChartConfiguration();
        saveSettingsToCookie();
    });

    d3.select("#borderColor").on("input", function() {
        borderColor = this.value;
        updateChartConfiguration();
        saveSettingsToCookie();
    });

    d3.select("#borderWidth").on("input", function() {
        borderWidth = +this.value;
        d3.select("#borderWidthValue").text(borderWidth + "px");
        updateChartConfiguration();
        saveSettingsToCookie();
    });
}

function updateChartConfiguration() {
    barHeight = +document.getElementById('barHeight').value;
    n = +document.getElementById('numBars').value;
    updateChart(currentYear);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadSettingsFromCookie();
    initVisualization();
});