const cityMargin = { top: 25, right: 20, bottom: 80, left: 70 };
const smallMargin = { top: 20, right: 20, bottom: 55, left: 60 };

let fullData = [];
let selectedCity = null;
let currentFilter = "all";

const cityImages = {
  "Vancouver": "images/vancouver.jpg",
  "Toronto": "images/toronto.jpg",
  "Montreal": "images/montreal.jpg",
  "New York": "images/newyork.jpg",
  "Los Angeles": "images/losangeles.jpg",
  "Miami": "images/miami.jpg"
};

const companyColors = {
  "Enterprise": "#16a34a",
  "Avis": "#dc2626",
  "Hertz": "#facc15"
};

const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

const citySvg = d3.select("#city-chart")
  .append("svg")
  .attr("id", "city-svg");

d3.csv("mydata.csv").then(data => {
  data.forEach(d => {
    d["Daily_Price(USD)"] = +d["Daily_Price(USD)"];
    d.Date_Collected = new Date(d.Date_Collected);
  });

  fullData = data;

  const filtered = getFilteredData(fullData, currentFilter);
  const cityAverages = getCityAverages(filtered);
  selectedCity = cityAverages[0]?.city || null;

  drawCityChart(cityAverages);
  setupToggleButtons();
  setupBackButton();

  window.addEventListener("resize", () => {
    const currentFiltered = getFilteredData(fullData, currentFilter);
    const currentCityAverages = getCityAverages(currentFiltered);
    drawCityChart(currentCityAverages);

    if (!d3.select("#detail-view").classed("hidden") && selectedCity) {
      drawCompanyChart(selectedCity);
      drawTrendChart(selectedCity);
    }
  });
});

function getCityChartSize() {
  const container = document.getElementById("city-chart");
  const width = Math.max(320, Math.min(container.clientWidth || 900, 1100));
  const height = width < 640 ? 320 : 460;
  return { width, height };
}

function getSmallChartSize(containerId) {
  const container = document.getElementById(containerId);
  const width = Math.max(280, container.clientWidth || 500);
  const height = width < 480 ? 240 : 300;
  return { width, height };
}

function getFilteredData(data, filterType) {
  if (filterType === "all") return data;

  return data.filter(d => {
    const day = d.Date_Collected.getDay();
    if (filterType === "weekday") return day !== 0 && day !== 6;
    if (filterType === "weekend") return day === 0 || day === 6;
    return true;
  });
}

function getCityAverages(data) {
  const rolled = d3.rollups(
    data,
    v => d3.mean(v, d => d["Daily_Price(USD)"]),
    d => d.City
  );

  return rolled.map(d => ({
    city: d[0],
    avg: d[1]
  })).sort((a, b) => b.avg - a.avg);
}

function drawCityChart(cityData) {
  const { width: cityChartWidth, height: cityChartHeight } = getCityChartSize();

  citySvg.selectAll("*").remove();
  citySvg
    .attr("viewBox", `0 0 ${cityChartWidth} ${cityChartHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const defs = citySvg.append("defs");

  const gradient = defs.append("linearGradient")
    .attr("id", "barGradient")
    .attr("x1", "0%")
    .attr("x2", "0%")
    .attr("y1", "0%")
    .attr("y2", "100%");

  gradient.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", "#60a5fa");

  gradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#2563eb");

  const innerWidth = cityChartWidth - cityMargin.left - cityMargin.right;
  const innerHeight = cityChartHeight - cityMargin.top - cityMargin.bottom;

  const x = d3.scaleBand()
    .domain(cityData.map(d => d.city))
    .range([cityMargin.left, cityMargin.left + innerWidth])
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([0, d3.max(cityData, d => d.avg) || 0])
    .nice()
    .range([cityMargin.top + innerHeight, cityMargin.top]);

  const bottomAxis = citySvg.append("g")
    .attr("transform", `translate(0,${cityMargin.top + innerHeight})`)
    .call(d3.axisBottom(x));

  if (cityChartWidth < 640) {
    bottomAxis.selectAll("text")
      .attr("transform", "rotate(-28)")
      .style("text-anchor", "end")
      .style("font-size", "11px");
  } else {
    bottomAxis.selectAll("text")
      .attr("transform", "rotate(-12)")
      .style("text-anchor", "end");
  }

  citySvg.append("g")
    .attr("transform", `translate(${cityMargin.left},0)`)
    .call(d3.axisLeft(y));

  citySvg.append("text")
    .attr("class", "axis-label")
    .attr("x", cityChartWidth / 2)
    .attr("y", cityChartHeight - 14)
    .attr("text-anchor", "middle")
    .text("City");

  citySvg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(cityChartHeight / 2))
    .attr("y", 18)
    .attr("text-anchor", "middle")
    .text("Average Price (USD)");

  const bars = citySvg.selectAll(".bar")
    .data(cityData)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.city))
    .attr("y", cityMargin.top + innerHeight)
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .attr("rx", 14)
    .attr("ry", 14)
    .classed("selected-bar", d => d.city === selectedCity)
    .on("mouseover", function(event, d) {
      d3.select(this)
        .transition()
        .duration(180)
        .attr("transform", "translate(0,-8)");

      tooltip
        .style("opacity", 1)
        .html(`<strong>${d.city}</strong><br>Average Price: $${d.avg.toFixed(2)}`)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function() {
      d3.select(this)
        .transition()
        .duration(180)
        .attr("transform", "translate(0,0)");

      tooltip.style("opacity", 0);
    })
    .on("click", async function(event, d) {
      selectedCity = d.city;

      citySvg.selectAll(".bar")
        .classed("bar-dimmed", barData => barData.city !== d.city);

      d3.select(this)
        .raise()
        .transition()
        .duration(250)
        .attr("transform", "translate(0,-20) scale(1.04)")
        .transition()
        .duration(350)
        .attr("transform", "translate(0,-8) scale(1.08)");

      await startTravelTransition(d.city);
    });

  bars.transition()
    .duration(900)
    .delay((d, i) => i * 70)
    .attr("y", d => y(d.avg))
    .attr("height", d => cityMargin.top + innerHeight - y(d.avg));

  citySvg.selectAll(".bar-label")
    .data(cityData)
    .enter()
    .append("text")
    .attr("x", d => x(d.city) + x.bandwidth() / 2)
    .attr("y", d => y(d.avg) - 10)
    .attr("text-anchor", "middle")
    .attr("font-size", cityChartWidth < 640 ? "10px" : "11px")
    .attr("fill", "#1f2937")
    .style("opacity", 0)
    .text(d => `$${d.avg.toFixed(1)}`)
    .transition()
    .duration(500)
    .delay((d, i) => 500 + i * 60)
    .style("opacity", 1);
}

function setupToggleButtons() {
  d3.selectAll(".toggle-btn").on("click", function() {
    currentFilter = this.dataset.filter;

    d3.selectAll(".toggle-btn").classed("active", false);
    d3.select(this).classed("active", true);

    const filtered = getFilteredData(fullData, currentFilter);
    const cityAverages = getCityAverages(filtered);

    if (!cityAverages.some(d => d.city === selectedCity)) {
      selectedCity = cityAverages[0]?.city || null;
    }

    drawCityChart(cityAverages);
  });
}

function setupBackButton() {
  d3.select("#back-btn").on("click", () => {
    const detailView = d3.select("#detail-view");
    const overviewView = d3.select("#overview-view");
    const wipe = d3.select("#travel-wipe");

    detailView
      .classed("hidden", true)
      .classed("active-view", false)
      .classed("detail-enter", false);

    overviewView
      .classed("hidden", false)
      .classed("active-view", true)
      .classed("overview-exit", false);

    wipe.classed("active", false).style("opacity", 0);

    const filtered = getFilteredData(fullData, currentFilter);
    const cityAverages = getCityAverages(filtered);
    drawCityChart(cityAverages);
  });
}

async function startTravelTransition(city) {
  const overviewView = d3.select("#overview-view");
  const detailView = d3.select("#detail-view");
  const wipe = d3.select("#travel-wipe");

  overviewView.classed("overview-exit", true);
  wipe.style("opacity", 1).classed("active", true);

  await wait(650);

  updateHero(city);
  updateRankBadge(city);
  updateSummary(city);
  updateInsight(city);
  drawCompanyChart(city);
  drawTrendChart(city);

  overviewView
    .classed("hidden", true)
    .classed("active-view", false);

  detailView
    .classed("hidden", false)
    .classed("active-view", true)
    .classed("detail-enter", true);

  refreshCardAnimations();

  await wait(450);
  wipe.classed("active", false).style("opacity", 0);
}

function refreshCardAnimations() {
  d3.selectAll(".card-enter").each(function() {
    this.classList.remove("card-enter");
    void this.offsetWidth;
    this.classList.add("card-enter");
  });
}

function updateHero(city) {
  d3.select("#detail-city-title").text(city);
  d3.select("#detail-city-subtitle").text(
    `A deeper look at company pricing and time-based rental movement in ${city}.`
  );

  const imagePath = cityImages[city] || "images/default.jpg";

  d3.select("#detail-hero")
    .style("background-image", `url('${imagePath}')`);
}

function updateRankBadge(city) {
  const filtered = getFilteredData(fullData, currentFilter);
  const cityAverages = getCityAverages(filtered);

  const rankIndex = cityAverages.findIndex(d => d.city === city);

  if (rankIndex === -1 || !cityAverages.length) {
    d3.select("#city-rank-badge").text("No ranking available");
    return;
  }

  const rank = rankIndex + 1;
  const total = cityAverages.length;

  let label = `#${rank} of ${total}`;

  if (rank === 1) {
    label = `#1 Most Expensive in ${capitalize(currentFilter)}`;
  } else if (rank === total) {
    label = `#${rank} Cheapest in ${capitalize(currentFilter)}`;
  } else if (rank <= Math.ceil(total / 2)) {
    label = `#${rank} Higher-Priced in ${capitalize(currentFilter)}`;
  } else {
    label = `#${rank} Lower-Priced in ${capitalize(currentFilter)}`;
  }

  d3.select("#city-rank-badge").text(label);
}

function updateSummary(city) {
  const filtered = getFilteredData(fullData, currentFilter);
  const cityData = filtered.filter(d => d.City === city);

  if (!cityData.length) {
    d3.select("#city-summary").html(`
      <p class="summary-stat"><strong>No data available</strong> for ${city} in the selected filter.</p>
    `);
    return;
  }

  const avgPrice = d3.mean(cityData, d => d["Daily_Price(USD)"]);

  const companyAverages = d3.rollups(
    cityData,
    v => d3.mean(v, d => d["Daily_Price(USD)"]),
    d => d.Rental_Company
  ).map(d => ({
    company: d[0],
    avg: d[1]
  })).sort((a, b) => a.avg - b.avg);

  const cheapestCompany = companyAverages[0]?.company || "N/A";

  const dateAverages = d3.rollups(
    cityData,
    v => d3.mean(v, d => d["Daily_Price(USD)"]),
    d => +d.Date_Collected
  ).map(d => ({
    date: new Date(+d[0]),
    avg: d[1]
  })).sort((a, b) => a.date - b.date);

  const highestDayValue = d3.max(dateAverages, d => d.avg);
  const highestDayObj = dateAverages.find(d => d.avg === highestDayValue);

  d3.select("#city-summary").html(`
    <p class="summary-stat"><strong>Average Price:</strong> $${avgPrice.toFixed(2)}</p>
    <p class="summary-stat"><strong>Cheapest Company:</strong> ${cheapestCompany}</p>
    <p class="summary-stat"><strong>Highest Price Day:</strong> ${highestDayObj ? highestDayObj.date.toLocaleDateString() : "N/A"}</p>
    <p class="summary-stat"><strong>Currency:</strong> USD</p>
    <p class="summary-stat"><strong>View:</strong> ${capitalize(currentFilter)}</p>
  `);
}

function drawCompanyChart(city) {
  const { width: smallChartWidth, height: smallChartHeight } = getSmallChartSize("company-chart");

  d3.select("#company-chart").html("");

  const svg = d3.select("#company-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${smallChartWidth} ${smallChartHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const filtered = getFilteredData(fullData, currentFilter);
  const cityData = filtered.filter(d => d.City === city);

  const companyData = d3.rollups(
    cityData,
    v => d3.mean(v, d => d["Daily_Price(USD)"]),
    d => d.Rental_Company
  ).map(d => ({
    company: d[0],
    avg: d[1]
  })).sort((a, b) => b.avg - a.avg);

  if (!companyData.length) {
    d3.select("#company-chart")
      .append("p")
      .text("No company data available for this city.");
    return;
  }

  const innerWidth = smallChartWidth - smallMargin.left - smallMargin.right;
  const innerHeight = smallChartHeight - smallMargin.top - smallMargin.bottom;

  const x = d3.scaleBand()
    .domain(companyData.map(d => d.company))
    .range([smallMargin.left, smallMargin.left + innerWidth])
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([0, d3.max(companyData, d => d.avg) || 0])
    .nice()
    .range([smallMargin.top + innerHeight, smallMargin.top]);

  const bottomAxis = svg.append("g")
    .attr("transform", `translate(0,${smallMargin.top + innerHeight})`)
    .call(d3.axisBottom(x));

  if (smallChartWidth < 420) {
    bottomAxis.selectAll("text")
      .attr("transform", "rotate(-20)")
      .style("text-anchor", "end")
      .style("font-size", "10px");
  }

  svg.append("g")
    .attr("transform", `translate(${smallMargin.left},0)`)
    .call(d3.axisLeft(y).ticks(smallChartWidth < 420 ? 4 : 6));

  svg.selectAll(".company-bar")
    .data(companyData)
    .enter()
    .append("rect")
    .attr("x", d => x(d.company))
    .attr("y", smallMargin.top + innerHeight)
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .attr("fill", d => companyColors[d.company] || "#3b82f6")
    .attr("rx", 10)
    .on("mouseover", function(event, d) {
      tooltip
        .style("opacity", 1)
        .html(`<strong>${d.company}</strong><br>Average Price: $${d.avg.toFixed(2)}`)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0);
    })
    .transition()
    .duration(800)
    .delay((d, i) => i * 70)
    .attr("y", d => y(d.avg))
    .attr("height", d => smallMargin.top + innerHeight - y(d.avg));

  svg.selectAll(".company-label")
    .data(companyData)
    .enter()
    .append("text")
    .attr("x", d => x(d.company) + x.bandwidth() / 2)
    .attr("y", d => y(d.avg) - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", smallChartWidth < 420 ? "10px" : "11px")
    .attr("fill", "#1f2937")
    .style("opacity", 0)
    .text(d => d.avg.toFixed(1))
    .transition()
    .duration(400)
    .delay((d, i) => 350 + i * 60)
    .style("opacity", 1);
}

function drawTrendChart(city) {
  const { width: smallChartWidth, height: smallChartHeight } = getSmallChartSize("trend-chart");

  d3.select("#trend-chart").html("");

  const svg = d3.select("#trend-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${smallChartWidth} ${smallChartHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const filtered = getFilteredData(fullData, currentFilter);
  const cityData = filtered.filter(d => d.City === city);

  const dateData = d3.rollups(
    cityData,
    v => d3.mean(v, d => d["Daily_Price(USD)"]),
    d => +d.Date_Collected
  ).map(d => ({
    date: new Date(+d[0]),
    avg: d[1]
  })).sort((a, b) => a.date - b.date);

  if (!dateData.length) {
    d3.select("#trend-chart")
      .append("p")
      .text("No trend data available for this city.");
    return;
  }

  const innerWidth = smallChartWidth - smallMargin.left - smallMargin.right;
  const innerHeight = smallChartHeight - smallMargin.top - smallMargin.bottom;

  const x = d3.scaleTime()
    .domain(d3.extent(dateData, d => d.date))
    .range([smallMargin.left, smallMargin.left + innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(dateData, d => d.avg) || 0])
    .nice()
    .range([smallMargin.top + innerHeight, smallMargin.top]);

  svg.append("g")
    .attr("transform", `translate(0,${smallMargin.top + innerHeight})`)
    .call(d3.axisBottom(x).ticks(smallChartWidth < 420 ? 4 : 6));

  svg.append("g")
    .attr("transform", `translate(${smallMargin.left},0)`)
    .call(d3.axisLeft(y).ticks(smallChartWidth < 420 ? 4 : 6));

  const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.avg))
    .curve(d3.curveCatmullRom.alpha(0.5));

  const path = svg.append("path")
    .datum(dateData)
    .attr("fill", "none")
    .attr("stroke", "#f97316")
    .attr("stroke-width", smallChartWidth < 420 ? 2.5 : 3)
    .attr("d", line);

  const totalLength = path.node().getTotalLength();

  path
    .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
    .attr("stroke-dashoffset", totalLength)
    .transition()
    .duration(1000)
    .ease(d3.easeCubicOut)
    .attr("stroke-dashoffset", 0);

  svg.selectAll(".trend-dot")
    .data(dateData)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.avg))
    .attr("r", 0)
    .attr("fill", "#f97316")
    .on("mouseover", function(event, d) {
      tooltip
        .style("opacity", 1)
        .html(`<strong>${d.date.toLocaleDateString()}</strong><br>Average Price: $${d.avg.toFixed(2)}`)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0);
    })
    .transition()
    .duration(400)
    .delay((d, i) => 500 + i * 70)
    .attr("r", smallChartWidth < 420 ? 3 : 4);
}

function updateInsight(city) {
  const filtered = getFilteredData(fullData, currentFilter);
  const cityData = filtered.filter(d => d.City === city);

  if (!cityData.length) {
    d3.select("#city-insight").text(`No insight available for ${city}.`);
    return;
  }

  const companyData = d3.rollups(
    cityData,
    v => d3.mean(v, d => d["Daily_Price(USD)"]),
    d => d.Rental_Company
  ).map(d => ({
    company: d[0],
    avg: d[1]
  })).sort((a, b) => b.avg - a.avg);

  const topCompany = companyData[0]?.company || "A company";

  const trendData = d3.rollups(
    cityData,
    v => d3.mean(v, d => d["Daily_Price(USD)"]),
    d => +d.Date_Collected
  ).map(d => ({
    date: new Date(+d[0]),
    avg: d[1]
  })).sort((a, b) => a.date - b.date);

  const firstValue = trendData[0]?.avg ?? 0;
  const lastValue = trendData[trendData.length - 1]?.avg ?? 0;

  let insight = "";

  // Trend-based variation
  if (lastValue > firstValue + 3) {
    insight = `Prices in ${city} show an upward trend over time, which could be linked to increasing demand or limited vehicle availability.`;
  } else if (lastValue < firstValue - 3) {
    insight = `Prices in ${city} decrease slightly over time, suggesting lower demand or better availability later in the period.`;
  } else {
    insight = `Prices in ${city} remain relatively stable, indicating consistent demand during this time period.`;
  }

  // Add real-world context variation
  const contextOptions = [
    "This may reflect typical weekday travel patterns where fewer people are booking rentals.",
    "External factors such as fuel prices or seasonal demand could also influence pricing trends.",
    "During non-peak travel periods, rental demand tends to stabilize, leading to more consistent pricing.",
    "Business travel schedules and school periods may reduce fluctuations in rental demand.",
    "Lower tourist activity during this period may contribute to more stable or decreasing prices."
  ];

  const randomContext = contextOptions[Math.floor(Math.random() * contextOptions.length)];

  d3.select("#city-insight").text(
    `${topCompany} tends to have the highest average prices in ${city}. ${insight} ${randomContext}`
  );
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
