const cityMargin = { top: 25, right: 20, bottom: 90, left: 70 };
const smallMargin = { top: 20, right: 20, bottom: 65, left: 60 };

let fullData = [];
let selectedCity = null;
let currentFilter = "all";
let compareCity = null;
let hasAnimatedOverview = false;

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

const compareColors = {
  selected: "#2563eb",
  compare: "#7c3aed"
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
  compareCity = cityAverages.find(d => d.city !== selectedCity)?.city || null;

  drawOverviewDistribution(filtered, !hasAnimatedOverview);
  hasAnimatedOverview = true;
  setupToggleButtons();
  setupBackButton();
  setupCompareDropdown();

  window.addEventListener("resize", () => {
    const currentFiltered = getFilteredData(fullData, currentFilter);
    drawOverviewDistribution(currentFiltered, false);

    if (!d3.select("#detail-view").classed("hidden") && selectedCity) {
      updateDetailView(selectedCity);
    }
  });
});

function getCityChartSize() {
  const container = document.getElementById("city-chart");
  const width = Math.max(360, Math.min(container.clientWidth || 950, 1150));
  const height = width < 700 ? 380 : 500;
  return { width, height };
}

function getSmallChartSize(containerId) {
  const container = document.getElementById(containerId);
  const width = Math.max(300, container.clientWidth || 520);
  const height = width < 480 ? 260 : 320;
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

function getCompanyAveragesForCity(data, city) {
  return d3.rollups(
    data.filter(d => d.City === city),
    v => d3.mean(v, d => d["Daily_Price(USD)"]),
    d => d.Rental_Company
  ).map(d => ({
    company: d[0],
    avg: d[1]
  })).sort((a, b) => b.avg - a.avg);
}

function getTrendForCity(data, city) {
  return d3.rollups(
    data.filter(d => d.City === city),
    v => d3.mean(v, d => d["Daily_Price(USD)"]),
    d => +d.Date_Collected
  ).map(d => ({
    date: new Date(+d[0]),
    avg: d[1]
  })).sort((a, b) => a.date - b.date);
}

function drawOverviewDistribution(filteredData, animate = false) {
  const { width, height } = getCityChartSize();

  citySvg.selectAll("*").remove();
  citySvg
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const cityData = getCityAverages(filteredData);
  const cities = cityData.map(d => d.city);

  const innerWidth = width - cityMargin.left - cityMargin.right;
  const innerHeight = height - cityMargin.top - cityMargin.bottom;

  const x = d3.scaleBand()
    .domain(cities)
    .range([cityMargin.left, cityMargin.left + innerWidth])
    .padding(0.28);

  const y = d3.scaleLinear()
    .domain([0, d3.max(cityData, d => d.avg) || 0])
    .nice()
    .range([cityMargin.top + innerHeight, cityMargin.top]);

  citySvg.append("g")
    .attr("transform", `translate(0,${cityMargin.top + innerHeight})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", width < 720 ? "rotate(-28)" : "rotate(-12)")
    .style("text-anchor", "end")
    .style("font-size", width < 720 ? "11px" : "12px");

  citySvg.append("g")
    .attr("transform", `translate(${cityMargin.left},0)`)
    .call(d3.axisLeft(y));

  citySvg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height - 12)
    .attr("text-anchor", "middle")
    .text("City");

  citySvg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(height / 2))
    .attr("y", 18)
    .attr("text-anchor", "middle")
    .text("Average Rental Price (USD)");

  const bars = citySvg.selectAll(".city-bar")
    .data(cityData)
    .enter()
    .append("rect")
    .attr("class", "city-bar")
    .attr("x", d => x(d.city))
    .attr("width", x.bandwidth())
    .attr("rx", 10)
    .attr("fill", "#2563eb")
    .attr("y", animate ? cityMargin.top + innerHeight : d => y(d.avg))
    .attr("height", animate ? 0 : d => cityMargin.top + innerHeight - y(d.avg))
    .style("cursor", "pointer")
    .on("mouseover", function(event, d) {
      d3.select(this).attr("fill", "#1d4ed8");

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
      d3.select(this).attr("fill", "#2563eb");
      tooltip.style("opacity", 0);
    })
    .on("click", function(event, cityObj) {
      selectedCity = cityObj.city;
      const cityOptions = cities.filter(c => c !== selectedCity);
      compareCity = cityOptions[0] || null;
      openDetailView(selectedCity);
    });

  if (animate) {
    bars.transition()
      .duration(700)
      .attr("y", d => y(d.avg))
      .attr("height", d => cityMargin.top + innerHeight - y(d.avg));
  }

  citySvg.selectAll(".city-bar-label")
    .data(cityData)
    .enter()
    .append("text")
    .attr("class", "city-bar-label")
    .attr("x", d => x(d.city) + x.bandwidth() / 2)
    .attr("y", d => y(d.avg) - 8)
    .attr("text-anchor", "middle")
    .attr("font-size", width < 720 ? "10px" : "11px")
    .attr("fill", "#1f2937")
    .text(d => `$${d.avg.toFixed(1)}`);
}

function setupToggleButtons() {
  d3.selectAll(".toggle-btn").on("click", function() {
    currentFilter = this.dataset.filter;

    d3.selectAll(".toggle-btn").classed("active", false);
    d3.select(this).classed("active", true);

    const filtered = getFilteredData(fullData, currentFilter);
    drawOverviewDistribution(filtered, false);

    if (!d3.select("#detail-view").classed("hidden") && selectedCity) {
      const availableCities = getCityAverages(filtered).map(d => d.city);
      if (!availableCities.includes(compareCity)) {
        compareCity = availableCities.find(c => c !== selectedCity) || null;
      }
      updateDetailView(selectedCity);
    }
  });
}

function setupBackButton() {
  d3.select("#back-btn").on("click", () => {
    d3.select("#detail-view").classed("hidden", true).classed("active-view", false);
    d3.select("#overview-view").classed("hidden", false).classed("active-view", true);
    drawOverviewDistribution(getFilteredData(fullData, currentFilter), false);
  });
}

function setupCompareDropdown() {
  d3.select("#compare-city-select").on("change", function() {
    compareCity = this.value;
    if (selectedCity) {
      updateSummary(selectedCity);
      drawCompanyCompareChart(selectedCity, compareCity);
      drawTrendCompareChart(selectedCity, compareCity);
      updateInsight(selectedCity);
    }
  });
}

function openDetailView(city) {
  d3.select("#overview-view").classed("hidden", true).classed("active-view", false);
  d3.select("#detail-view").classed("hidden", false).classed("active-view", true);
  updateDetailView(city);
}

function updateDetailView(city) {
  const filtered = getFilteredData(fullData, currentFilter);
  const availableCities = getCityAverages(filtered).map(d => d.city);

  if (!compareCity || compareCity === city || !availableCities.includes(compareCity)) {
    compareCity = availableCities.find(c => c !== city) || null;
  }

  updateHero(city);
  updateRankBadge(city);
  updateSummary(city);
  populateCompareDropdown(city, availableCities);
  drawCompanyChart(city);
  drawTrendChart(city);
  drawCompanyCompareChart(city, compareCity);
  drawTrendCompareChart(city, compareCity);
  updateInsight(city);
}

function populateCompareDropdown(city, availableCities) {
  const select = d3.select("#compare-city-select");
  select.selectAll("option").remove();

  const options = availableCities.filter(c => c !== city);

  select.selectAll("option")
    .data(options)
    .enter()
    .append("option")
    .attr("value", d => d)
    .property("selected", d => d === compareCity)
    .text(d => d);
}

function updateHero(city) {
  d3.select("#detail-city-title").text(city);
  d3.select("#detail-city-subtitle").text(
    `Inspect ${city} in detail and compare it directly with another city.`
  );

  const imagePath = cityImages[city] || "images/default.jpg";
  d3.select("#detail-hero").style("background-image", `url('${imagePath}')`);
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
  if (rank === 1) label = `#1 Most Expensive in ${capitalize(currentFilter)}`;
  else if (rank === total) label = `#${rank} Cheapest in ${capitalize(currentFilter)}`;
  else if (rank <= Math.ceil(total / 2)) label = `#${rank} Higher-Priced in ${capitalize(currentFilter)}`;
  else label = `#${rank} Lower-Priced in ${capitalize(currentFilter)}`;

  d3.select("#city-rank-badge").text(label);
}

function updateSummary(city) {
  const filtered = getFilteredData(fullData, currentFilter);
  const cityData = filtered.filter(d => d.City === city);

  if (!cityData.length) {
    d3.select("#city-summary").html(
      `<p class="summary-stat"><strong>No data available</strong> for ${city} in the selected filter.</p>`
    );
    return;
  }

  const avgPrice = d3.mean(cityData, d => d["Daily_Price(USD)"]);
  const companyAverages = getCompanyAveragesForCity(filtered, city);
  const cheapestCompany = [...companyAverages].sort((a, b) => a.avg - b.avg)[0]?.company || "N/A";
  const trendData = getTrendForCity(filtered, city);
  const highestDayValue = d3.max(trendData, d => d.avg);
  const highestDayObj = trendData.find(d => d.avg === highestDayValue);

  d3.select("#city-summary").html(`
    <p class="summary-stat"><strong>Average Price:</strong> $${avgPrice.toFixed(2)}</p>
    <p class="summary-stat"><strong>Cheapest Company:</strong> ${cheapestCompany}</p>
    <p class="summary-stat"><strong>Highest Price Day:</strong> ${highestDayObj ? highestDayObj.date.toLocaleDateString() : "N/A"}</p>
  `);
}

function drawCompanyChart(city) {
  const { width, height } = getSmallChartSize("company-chart");
  d3.select("#company-chart").html("");

  const svg = d3.select("#company-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const filtered = getFilteredData(fullData, currentFilter);
  const companyData = getCompanyAveragesForCity(filtered, city);

  if (!companyData.length) {
    d3.select("#company-chart").append("p").text("No company data available.");
    return;
  }

  const innerWidth = width - smallMargin.left - smallMargin.right;
  const innerHeight = height - smallMargin.top - smallMargin.bottom;

  const x = d3.scaleBand()
    .domain(companyData.map(d => d.company))
    .range([smallMargin.left, smallMargin.left + innerWidth])
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([0, d3.max(companyData, d => d.avg) || 0])
    .nice()
    .range([smallMargin.top + innerHeight, smallMargin.top]);

  svg.append("g")
    .attr("transform", `translate(0,${smallMargin.top + innerHeight})`)
    .call(d3.axisBottom(x));

  svg.append("g")
    .attr("transform", `translate(${smallMargin.left},0)`)
    .call(d3.axisLeft(y).ticks(width < 420 ? 4 : 6));

  svg.selectAll(".company-bar")
    .data(companyData)
    .enter()
    .append("rect")
    .attr("class", "company-bar")
    .attr("x", d => x(d.company))
    .attr("y", d => y(d.avg))
    .attr("width", x.bandwidth())
    .attr("height", d => smallMargin.top + innerHeight - y(d.avg))
    .attr("fill", d => companyColors[d.company] || "#3b82f6")
    .attr("rx", 8)
    .on("mouseover", function(event, d) {
      tooltip
        .style("opacity", 1)
        .html(`<strong>${d.company}</strong><br>${city}: $${d.avg.toFixed(2)}`)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mousemove", function(event) {
      tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0);
    });

  svg.selectAll(".company-label")
    .data(companyData)
    .enter()
    .append("text")
    .attr("x", d => x(d.company) + x.bandwidth() / 2)
    .attr("y", d => y(d.avg) - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", width < 420 ? "10px" : "11px")
    .text(d => d.avg.toFixed(1));
}

function drawTrendChart(city) {
  const { width, height } = getSmallChartSize("trend-chart");
  d3.select("#trend-chart").html("");

  const svg = d3.select("#trend-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const filtered = getFilteredData(fullData, currentFilter);
  const trendData = getTrendForCity(filtered, city);

  if (!trendData.length) {
    d3.select("#trend-chart").append("p").text("No trend data available.");
    return;
  }

  const innerWidth = width - smallMargin.left - smallMargin.right;
  const innerHeight = height - smallMargin.top - smallMargin.bottom;

  const x = d3.scaleTime()
    .domain(d3.extent(trendData, d => d.date))
    .range([smallMargin.left, smallMargin.left + innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(trendData, d => d.avg) || 0])
    .nice()
    .range([smallMargin.top + innerHeight, smallMargin.top]);

  svg.append("g")
    .attr("transform", `translate(0,${smallMargin.top + innerHeight})`)
    .call(d3.axisBottom(x).ticks(width < 420 ? 4 : 6));

  svg.append("g")
    .attr("transform", `translate(${smallMargin.left},0)`)
    .call(d3.axisLeft(y).ticks(width < 420 ? 4 : 6));

  const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.avg));

  svg.append("path")
    .datum(trendData)
    .attr("fill", "none")
    .attr("stroke", "#f97316")
    .attr("stroke-width", 3)
    .attr("d", line);

  svg.selectAll(".trend-dot")
    .data(trendData)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.avg))
    .attr("r", 4)
    .attr("fill", "#f97316")
    .on("mouseover", function(event, d) {
      tooltip
        .style("opacity", 1)
        .html(`<strong>${d.date.toLocaleDateString()}</strong><br>${city}: $${d.avg.toFixed(2)}`)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mousemove", function(event) {
      tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0);
    });
}

function drawCompanyCompareChart(cityA, cityB) {
  const { width, height } = getSmallChartSize("company-compare-chart");
  d3.select("#company-compare-chart").html("");

  if (!cityB) {
    d3.select("#company-compare-chart").append("p").text("Select another city to compare.");
    return;
  }

  const svg = d3.select("#company-compare-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const filtered = getFilteredData(fullData, currentFilter);
  const companies = Array.from(new Set(filtered.map(d => d.Rental_Company)));

  const cityAData = getCompanyAveragesForCity(filtered, cityA);
  const cityBData = getCompanyAveragesForCity(filtered, cityB);

  const merged = companies.map(company => ({
    company,
    [cityA]: cityAData.find(d => d.company === company)?.avg || 0,
    [cityB]: cityBData.find(d => d.company === company)?.avg || 0
  }));

  const innerWidth = width - smallMargin.left - smallMargin.right;
  const innerHeight = height - smallMargin.top - smallMargin.bottom;

  const x0 = d3.scaleBand()
    .domain(companies)
    .range([smallMargin.left, smallMargin.left + innerWidth])
    .padding(0.25);

  const x1 = d3.scaleBand()
    .domain([cityA, cityB])
    .range([0, x0.bandwidth()])
    .padding(0.18);

  const y = d3.scaleLinear()
    .domain([0, d3.max(merged.flatMap(d => [d[cityA], d[cityB]])) || 0])
    .nice()
    .range([smallMargin.top + innerHeight, smallMargin.top]);

  svg.append("g")
    .attr("transform", `translate(0,${smallMargin.top + innerHeight})`)
    .call(d3.axisBottom(x0));

  svg.append("g")
    .attr("transform", `translate(${smallMargin.left},0)`)
    .call(d3.axisLeft(y).ticks(width < 420 ? 4 : 6));

  const group = svg.selectAll(".company-group")
    .data(merged)
    .enter()
    .append("g")
    .attr("transform", d => `translate(${x0(d.company)},0)`);

  group.selectAll("rect")
    .data(d => [
      { company: d.company, city: cityA, value: d[cityA], color: compareColors.selected },
      { company: d.company, city: cityB, value: d[cityB], color: compareColors.compare }
    ])
    .enter()
    .append("rect")
    .attr("class", "compare-company-bar")
    .attr("x", d => x1(d.city))
    .attr("y", d => y(d.value))
    .attr("width", x1.bandwidth())
    .attr("height", d => smallMargin.top + innerHeight - y(d.value))
    .attr("fill", d => d.color)
    .attr("rx", 6)
    .on("mouseover", function(event, d) {
      tooltip
        .style("opacity", 1)
        .html(`<strong>${d.company}</strong><br>${d.city}: $${d.value.toFixed(2)}`)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mousemove", function(event) {
      tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0);
    });

  addLegend("#company-compare-chart", [
    { label: cityA, color: compareColors.selected },
    { label: cityB, color: compareColors.compare }
  ]);
}

function drawTrendCompareChart(cityA, cityB) {
  const { width, height } = getSmallChartSize("trend-compare-chart");
  d3.select("#trend-compare-chart").html("");

  if (!cityB) {
    d3.select("#trend-compare-chart").append("p").text("Select another city to compare.");
    return;
  }

  const svg = d3.select("#trend-compare-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const filtered = getFilteredData(fullData, currentFilter);
  const trendA = getTrendForCity(filtered, cityA);
  const trendB = getTrendForCity(filtered, cityB);
  const combined = [...trendA, ...trendB];

  const innerWidth = width - smallMargin.left - smallMargin.right;
  const innerHeight = height - smallMargin.top - smallMargin.bottom;

  const x = d3.scaleTime()
    .domain(d3.extent(combined, d => d.date))
    .range([smallMargin.left, smallMargin.left + innerWidth]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(combined, d => d.avg) || 0])
    .nice()
    .range([smallMargin.top + innerHeight, smallMargin.top]);

  svg.append("g")
    .attr("transform", `translate(0,${smallMargin.top + innerHeight})`)
    .call(d3.axisBottom(x).ticks(width < 420 ? 4 : 6));

  svg.append("g")
    .attr("transform", `translate(${smallMargin.left},0)`)
    .call(d3.axisLeft(y).ticks(width < 420 ? 4 : 6));

  const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.avg));

  svg.append("path")
    .datum(trendA)
    .attr("fill", "none")
    .attr("stroke", compareColors.selected)
    .attr("stroke-width", 3)
    .attr("d", line);

  svg.append("path")
    .datum(trendB)
    .attr("fill", "none")
    .attr("stroke", compareColors.compare)
    .attr("stroke-width", 3)
    .attr("d", line);

  svg.selectAll(".trendA-dot")
    .data(trendA)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.avg))
    .attr("r", 3.5)
    .attr("fill", compareColors.selected)
    .on("mouseover", function(event, d) {
      tooltip
        .style("opacity", 1)
        .html(`<strong>${d.date.toLocaleDateString()}</strong><br>${cityA}: $${d.avg.toFixed(2)}`)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mousemove", function(event) {
      tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0);
    });

  svg.selectAll(".trendB-dot")
    .data(trendB)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.avg))
    .attr("r", 3.5)
    .attr("fill", compareColors.compare)
    .on("mouseover", function(event, d) {
      tooltip
        .style("opacity", 1)
        .html(`<strong>${d.date.toLocaleDateString()}</strong><br>${cityB}: $${d.avg.toFixed(2)}`)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mousemove", function(event) {
      tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0);
    });

  addLegend("#trend-compare-chart", [
    { label: cityA, color: compareColors.selected },
    { label: cityB, color: compareColors.compare }
  ]);
}

function addLegend(containerSelector, items) {
  d3.select(containerSelector).selectAll(".legend").remove();

  const legend = d3.select(containerSelector)
    .append("div")
    .attr("class", "legend");

  const item = legend.selectAll(".legend-item")
    .data(items)
    .enter()
    .append("div")
    .attr("class", "legend-item");

  item.append("span")
    .attr("class", "legend-swatch")
    .style("background-color", d => d.color);

  item.append("span")
    .text(d => d.label);
}

function updateInsight(city) {
  const filtered = getFilteredData(fullData, currentFilter);
  const cityData = filtered.filter(d => d.City === city);

  if (!cityData.length) {
    d3.select("#city-insight").text(`No insight available for ${city}.`);
    return;
  }

  const companyData = getCompanyAveragesForCity(filtered, city);
  const topCompany = companyData[0]?.company || "A company";
  const trendData = getTrendForCity(filtered, city);

  const firstValue = trendData[0]?.avg ?? 0;
  const lastValue = trendData[trendData.length - 1]?.avg ?? 0;

  let trendText = "";
  if (lastValue > firstValue + 3) {
    trendText = `Prices rise over time, suggesting stronger short-term demand or tighter vehicle supply.`;
  } else if (lastValue < firstValue - 3) {
    trendText = `Prices gradually decline over time, suggesting better value later in the period.`;
  } else {
    trendText = `Prices remain relatively stable across the selected dates.`;
  }

  let compareText = "";
  if (compareCity) {
    const cityAAvg = d3.mean(cityData, d => d["Daily_Price(USD)"]) || 0;
    const compareAvg = d3.mean(filtered.filter(d => d.City === compareCity), d => d["Daily_Price(USD)"]) || 0;
    const diff = cityAAvg - compareAvg;

    if (Math.abs(diff) < 1.5) {
      compareText = `${city} is priced very similarly to ${compareCity} on average.`;
    } else if (diff > 0) {
      compareText = `${city} is about $${diff.toFixed(2)} more expensive than ${compareCity} on average.`;
    } else {
      compareText = `${city} is about $${Math.abs(diff).toFixed(2)} cheaper than ${compareCity} on average.`;
    }
  }

  d3.select("#city-insight").text(
    `${topCompany} has the highest average company price in ${city}. ${trendText} ${compareText}`
  );
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
