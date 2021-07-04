// Polyfill for (for .. of) iteration of HTMLCollection
HTMLCollection.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];

var title = document.head.getElementsByTagName("title")[0];

var menu = document.getElementById("menu");
var article = document.getElementById("article");
var tool = document.getElementById("tool");

var chart;
var code = document.getElementById("code");

var langAxis;

var artlOption = document.getElementById("artlOption");
var toolOption = document.getElementById("toolOption");

var benchmark = document.getElementById("benchmark");
var comparison = document.getElementById("comparison");

var dataBuffer = [];

var sdev = document.getElementById("sdev");

var codeLang = document.getElementById("codeLang");

var benchmarks;
var languages;
var execution;
var paradigm;
var labels;
var charts;

var worker;

var isZoomedIn = false;

var firstColor = {r: 90, g: 147, b: 103};
var secondColor = {r: 74, g: 219, b: 200};

if (window.Worker) {
    worker = new Worker('pages/dev/languages/worker.js');
    worker.onmessage = function(event) {
        code.innerHTML = event.data;
    }
}
else {
    worker = { postMessage: function(event) {} };
}

if (window.location.hash == "#tool") {
    article.hidden = true;
}
else {
    window.location.hash = "article";
}

var request = new XMLHttpRequest();
request.open("GET", "pages/dev/languages/data.json");
request.responseType = "json";

request.onload = function() {
    benchmarks = request.response.benchmarks;
    languages = request.response.languages;
    execution = request.response.execution;
    paradigm = request.response.paradigm;
    labels = request.response.labels;
    charts = request.response.charts;

    var option;

    for (var bench in benchmarks) {
        option = document.createElement("li");

        option.innerHTML = "<a style='cursor: pointer' onclick=\"reloadLanguages('" + bench + "')\">" + benchmarks[bench].name + "</a>";

        benchmark.appendChild(option);
    }

    var exe;
    var par;

    for (var lang in languages) {
        for (exe in execution) {
            if (execution[exe].languages.indexOf(lang) != -1) {
                languages[lang].exe = exe;

                break;
            }
        }

        languages[lang].par = [];

        for (var par in paradigm) {
            if (paradigm[par].languages.indexOf(lang) != -1) {
                languages[lang].par.push(par);
            }
        }

        option = document.createElement("span");

        option.value = lang;
        option.classList.add("lang");
        option.onclick = langClick;

        option.classList.add("disabled");
        option.classList.add(exe);

        option.innerHTML = languages[lang].name;

        comparison.appendChild(option);
    }

    labels.mapping = compileCode("return " + labels.mapping + ";");

    var scales = [];

    for (sca in labels.scales) {
        scales.push({label: labels.scales[sca].name, borderWidth: 2, hidden: true});
        dataBuffer[scales.length - 1] = {};

        labels.scales[sca].data = compileCode("return " + labels.scales[sca].data + ";");
        labels.scales[sca].sdev = compileCode("return " + labels.scales[sca].sdev + ";");
    }

    var titleDiv;
    var titleSpan;
    var titleZoom;

    for (crt in charts) {
        titleDiv = document.createElement("div");
        titleDiv.style = "color: var(--light-main); font-size: 1.17em; font-weight: bold";

        titleSpan = document.createElement("span");
        titleSpan.style = "float: left; text-align: center; width: calc(100% - 1.5em); margin-right: 0.25em";
        titleSpan.innerHTML = charts[crt].title;

        titleZoom = document.createElement("div");
        titleZoom.style = "float:left; width: 1.25em; height: 1.25em; margin-top: 0.15em; cursor: pointer";
        titleZoom.innerHTML = "<img src='pages/dev/languages/zoom-in.svg' height='100%' width='100%' onclick=\"zoomIn('" + crt + "')\">";

        titleDiv.appendChild(titleSpan);
        titleDiv.appendChild(titleZoom);

        document.getElementById(crt).parentNode.insertBefore(titleDiv, document.getElementById(crt));
    }

    chart = new Chart(document.getElementById("chart").getContext("2d"), {
        type: "bar",
        data: {
            datasets: scales
        },
        options: {
            maintainAspectRatio: false,
            onResize: function(c, s) {
                if (!isZoomedIn) {
                    swap();
                    swap();

                    checkVisibilities();
                }

                reloadAxis();
            },
            scales: {
                yAxes: [{
                    id: "first",
                    type: "linear",
                    position: "left",
                    scaleLabel: {
                        display: true
                    },
                    ticks : {
                        min: 0
                    }
                }, {
                    id: "second",
                    type: "linear",
                    position: "right",
                    scaleLabel: {
                        display: true
                    },
                    ticks : {
                        min: 0
                    }
                }],
                xAxes : [{id: "langs"}]
            },
            onClick: function(e, h) {
                var layerX = e.clientX - chart.canvas.getBoundingClientRect().left;
                var layerY = e.clientY - chart.canvas.getBoundingClientRect().top;

                if (!isZoomedIn || layerY < chart.chartArea.top || layerX < chart.chartArea.left || layerX > chart.chartArea.right) {
                    return;
                }

                var label = langAxis.ticks[Math.floor((layerX - chart.chartArea.left) * langAxis.ticks.length / (chart.chartArea.right - chart.chartArea.left))];

                for (lang in languages) {
                    if (languages[lang].name == label) {
                        if (lang != lastLanguage) {
                            lastLanguage = lang;

                            reloadLanguages(false);
                        }

                        return;
                    }
                }
            },
            tooltips: {
                mode: "index",
                intersect: false,
                footerFontColor: "rgb(192, 192, 192)",
                callbacks: {
                    label: function(i, d) {
                        var unit = "";

                        for (var sca in labels.scales) {
                            if(labels.scales[sca].name == d.datasets[i.datasetIndex].label) {
                                if (labels.scales[sca].unitShort != undefined) {
                                    unit = labels.scales[sca].unitShort;
                                }

                                break;
                            }
                        }

                        var sdev = d.datasets[i.datasetIndex].sdev[i.index];

                        if (sdev != undefined) {
                            sdev = " (σ = " + (Math.round(sdev * 1000.0) / 1000.0) + unit + ")";
                        }
                        else {
                            sdev = "";
                        }

                        return (Math.round(d.datasets[i.datasetIndex].data[i.index] * 1000.0) / 1000.0) + unit + sdev;
                    },
                    footer: function(i, d) {
                        for (var lang in languages) {
                            if (languages[lang].name == i[0].xLabel) {
                                return ("(" + execution[languages[lang].exe].name + " - " + languages[lang].par.map(p => paradigm[p].name).join(", ") + ")");
                            }
                        }

                        return "";
                    }
                }
            },
            legend: {
                display: true,
                position: "top",
                onClick: function(e, l) {
                    if (!isZoomedIn) {
                        return;
                    }

                    var label = chart.data.datasets[l.datasetIndex];

                    if (!label.hidden) {
                        label.hidden = true;
                    }
                    else {
                        var cnt = 0;

                        chart.data.datasets.forEach(e => {if (!e.hidden) {cnt++;}});

                        if (cnt >= 2) {
                            chart.data.datasets.forEach(e => {e.hidden = true;});
                        }

                        label.hidden = false;
                    }

                    reloadAxis(true);
                },
                labels: {
                    padding: 10,
                    boxWidth: 13,
                    fontSize: 13,
                    filter: function(e) {
                        if (e.hidden && !isZoomedIn) {
                            return false;
                        }

                        var i = 0;

                        for (var label in labels.scales) {
                            if (i == e.datasetIndex) {
                                return (benchmarks[lastBenchmark].labels.indexOf(label) != -1);
                            }

                            i++;
                        }
                    },
                    generateLabels: function(c) {
                        var data = c.data;

                        var labels = [];

                        var i = 0;

                        var dataset;

                        for (; i < data.datasets.length; i++) {
                            dataset = data.datasets[i];

                            if (c.isDatasetVisible(i)) {
                                labels.push({
                                    text: dataset.label,
                                    fillStyle: toRGBA(firstColor, 0.5),
                                    hidden: false,
                                    strike: false,
                                    lineWidth: 2,
                                    strokeStyle: toRGBA(firstColor, 1.0),
                                    datasetIndex: i
                                });

                                break;
                            }
                            else {
                                labels.push({
                                    text: dataset.label,
                                    fillStyle: "rgba(127, 127, 127, 0.5)",
                                    hidden: true,
                                    strike: false,
                                    lineWidth: 2,
                                    strokeStyle: "rgba(0, 0, 0, 1.0)",
                                    datasetIndex: i
                                });
                            }
                        }

                        i++;

                        for (; i < data.datasets.length; i++) {
                            dataset = data.datasets[i];

                            if (c.isDatasetVisible(i)) {
                                labels.push({
                                    text: dataset.label,
                                    fillStyle: toRGBA(secondColor, 0.5),
                                    hidden: false,
                                    strike: false,
                                    lineWidth: 2,
                                    strokeStyle: toRGBA(secondColor, 1.0),
                                    datasetIndex: i
                                });

                                break;
                            }
                            else {
                                labels.push({
                                    text: dataset.label,
                                    fillStyle: "rgba(127, 127, 127, 0.5)",
                                    hidden: true,
                                    strike: false,
                                    lineWidth: 2,
                                    strokeStyle: "rgba(0, 0, 0, 1.0)",
                                    datasetIndex: i
                                });
                            }
                        }

                        i++;

                        for (; i < data.datasets.length; i++) {
                            dataset = data.datasets[i];

                            labels.push({
                                text: dataset.label,
                                fillStyle: "rgba(127, 127, 127, 0.5)",
                                hidden: true,
                                strike: false,
                                lineWidth: 2,
                                strokeStyle: "rgba(0, 0, 0, 1.0)",
                                datasetIndex: i
                            });
                        }

                        return labels;
                    }
                }
            },
            plugins: [
                {
                    afterDatasetDraw: function(c, a) {
                        var elements = a.meta.data || [];

                        var checked = sdev.classList.contains("checked");

                        for (var ele of elements) {
                            if (ele.hidden || chart.data.datasets[ele._datasetIndex].sdev[ele._index] == undefined) {
                                continue;
                            }

                            if ((ele.pEasing || Infinity) > a.easingValue) {
                                ele.pEasing = 0.0;

                                if (ele.pBase == undefined) {
                                    ele.pLength = 0.0;
                                    ele.pBase = ele._view.base;
                                    ele.pChecked = checked;
                                }

                                if (!ele.pChecked) {
                                    ele.pLength = 0.0;
                                }

                                ele.bLength = ele.pLength;
                                ele.nLength = chart.data.datasets[ele._datasetIndex].sdev[ele._index] * (ele._view.base - Math.round(((ele._view.y - ele.pBase) / a.easingValue) + ele.pBase)) / c.data.datasets[ele._datasetIndex].data[ele._index];
                            }

                            // predicton correction if bar was drawn without easing animation but in one frame
                            if (ele.pBase == ele._view.y) {
                                ele.bLength = ele.pLength;
                                ele.nLength = chart.data.datasets[ele._datasetIndex].sdev[ele._index] * (ele._view.base - ele.pBase) / c.data.datasets[ele._datasetIndex].data[ele._index];
                            }

                            var length = (ele.nLength - ele.bLength) * a.easingValue + ele.bLength;
                            var width = ele._view.width * 0.4;

                            if (checked) {
                                c.ctx.save();
                                c.ctx.globalAlpha = Math.min(Math.max(length, 0.0));
                                c.ctx.translate(Math.round(ele._view.x), Math.round(ele._view.y));

                                if (length > 0.125) {
                                    c.ctx.strokeStyle = "black";
                                    c.ctx.lineWidth = 1;

                                    c.ctx.beginPath();
                                    c.ctx.moveTo(-width / 2, -length);
                                    c.ctx.lineTo(width / 2, -length);
                                    c.ctx.stroke();
                                    c.ctx.closePath();

                                    c.ctx.beginPath();
                                    c.ctx.moveTo(0, -length);
                                    c.ctx.lineTo(0, length);
                                    c.ctx.stroke();
                                    c.ctx.closePath();

                                    c.ctx.beginPath();
                                    c.ctx.moveTo(-width / 2, length);
                                    c.ctx.lineTo(width / 2, length);
                                    c.ctx.stroke();
                                    c.ctx.closePath();
                                }

                                c.ctx.restore();
                            }

                            ele.pEasing = a.easingValue;
                            ele.pLength = length;
                            ele.pBase = ele._view.y;
                            ele.pChecked = checked;
                        }
                    }
                }
            ]
        }
    });

    Chart.plugins.register(chart.options.plugins);

    langAxis = chart.boxes.find(function(b) {return b.id == "langs";});
    labelAxis = chart.boxes.find(function(b) {return (b.legendItems != undefined);});

    firstAxis = chart.options.scales.yAxes[0];
    secondAxis = chart.options.scales.yAxes[1];

    window.onresize();

    request = null;

    hljs.highlightBlock(code);

    if (window.location.hash == "#tool") {
        zoomIn();
    }
    else {
        loadChart();

        checkVisibilities();
    }
}

request.send();

var lastBenchmark = undefined;
var lastLanguage = undefined;
var lastSelection = [];

var barColours = {};

function reloadCode() {
    if (request != null) {
        request.abort();
    }

    if (lastLanguage == undefined || benchmarks[lastBenchmark].path == undefined) {
        lastLanguage = undefined;

        codeLang.innerHTML = "";

        code.innerHTML = "<center>" + preview + "</center>";

        return;
    }

    request = new XMLHttpRequest();

    request.open("GET", "pages/dev/languages/code/" + encodeURIComponent(languages[lastLanguage].name) + "/" + encodeURIComponent(benchmarks[lastBenchmark].path) + "." + encodeURIComponent(languages[lastLanguage].extension));
    request.responseType = "text";

    request.onload = function() {
        if (request.status != 200) {
            request.onerror();

            return;
        }

        codeLang.innerHTML = languages[lastLanguage].name;

        code.innerHTML = request.responseText.replace(/</g, "&lt;") + "<div style=\"padding-bottom: 1em;\"></div>";

        worker.postMessage({"language": languages[lastLanguage].extension, "code": request.responseText});

        request = null;
    }

    request.onerror = function() {
        lastLanguage = undefined;

        codeLang.innerHTML = "";

        code.innerHTML = "<center>" + preview + "</center>";

        request = null;
    }

    request.send();
}

function reloadLanguages(bench) {
    var animate;

    if (bench === true || bench === false) {
        animate = bench;
    }
    else if (bench != lastBenchmark) {
        lastBenchmark = bench;

        animate = true;
    }
    else {
        return;
    }

    for (var option of benchmark.children) {
        if (option.firstElementChild.innerHTML == benchmarks[lastBenchmark].name) {
            option.firstElementChild.classList.add("active");
        }
        else {
            option.firstElementChild.classList.remove("active");
        }
    }

    bench = benchmarks[lastBenchmark].data;

    for (var option of comparison.children) {
        if (option.value in bench) {
            option.classList.remove("disabled");
        }
        else {
            option.classList.add("disabled");
            option.classList.remove("selected");
        }
    }

    reloadLabels(animate);
}

function reloadLabels(animate) {
    var i = 0;

    var cnt = 0;
    var first = undefined;

    for (var label in labels.scales) {
        if (benchmarks[lastBenchmark].labels.indexOf(label) != -1) {
            cnt += !chart.data.datasets[i].hidden;

            first = (first == undefined) ? i : first;
        }
        else {
            chart.data.datasets[i].hidden = true;
        }

        i++;
    }

    if (cnt == 0) {
        chart.data.datasets[first].hidden = false;
    }

    reloadChart(animate);
}

function reloadChart(animate) {
    var newSelection = [];

    chart.data.labels = [];

    for (var i = 0; i < chart.data.datasets.length; i++) {
        dataBuffer[i].data = [];
        dataBuffer[i].sdev = [];
    }

    var data;

    var i;

    for (var option of comparison.children) {
        if (option.classList.contains("selected")) {
            chart.data.labels.push(languages[option.value].name);

            newSelection.push(option.value);

            i = 0;

            for (var sca in labels.scales) {
                data = labels.mapping({data: benchmarks[lastBenchmark].data[option.value]});
                data.Math = Math;

                dataBuffer[i].data.push(labels.scales[sca].data(data));
                dataBuffer[i].sdev.push(labels.scales[sca].sdev(data));

                i++;
            }
        }
    }

    lastSelection = newSelection;

    reloadAxis(animate);

    if (lastSelection.indexOf(lastLanguage) == -1) {
        lastLanguage = undefined;
    }

    reloadCode();
}

function reloadAxis(animate) {
    firstAxis.display = false;
    firstAxis.scaleLabel.labelString = "";

    secondAxis.display = false;
    secondAxis.scaleLabel.labelString = "";

    var firstMax;
    var secondMax;

    var firstUnit;
    var secondUnit;

    var i = 0;

    var label;

    var checked = sdev.classList.contains("checked") ? 1 : 0;

    for (; i < chart.data.datasets.length; i++) {
        if (!chart.data.datasets[i].hidden) {
            firstAxis.display = true;

            chart.data.datasets[i].data = dataBuffer[i].data;
            chart.data.datasets[i].sdev = dataBuffer[i].sdev;

            chart.data.datasets[i].backgroundColor = []
            chart.data.datasets[i].borderColor = []

            for (var label of chart.data.labels) {
                chart.data.datasets[i].backgroundColor.push(diagonalPattern(combineColors(firstColor, getColourModifier(label)), false));
                chart.data.datasets[i].borderColor.push(toRGBA(combineColors(firstColor, getColourModifier(label)), 1.0));
            }

            chart.getDatasetMeta(i).yAxisID = "first";

            firstMax = Math.max.apply(null, chart.data.datasets[i].data.filter(x => x != Infinity)) + (Math.max.apply(null, chart.data.datasets[i].sdev.filter(x => x != Infinity)) * checked || 0);

            for (var sca in labels.scales) {
                label = labels.scales[sca];

                if(label.name == chart.data.datasets[i].label) {
                    firstAxis.scaleLabel.labelString = label.axis;

                    if (label.unitLong != undefined) {
                        firstAxis.scaleLabel.labelString += " [" + label.unitLong + "]";
                    }

                    firstUnit = label.unitLong;

                    break;
                }
            }

            break;
        }
        else {
            chart.data.datasets[i].data = [];
            chart.data.datasets[i].sdev = [];
        }
    }

    i++;

    for (; i < chart.data.datasets.length; i++) {
        if (!chart.data.datasets[i].hidden) {
            chart.data.datasets[i].data = dataBuffer[i].data;
            chart.data.datasets[i].sdev = dataBuffer[i].sdev;

            chart.data.datasets[i].backgroundColor = []
            chart.data.datasets[i].borderColor = []

            for (var label of chart.data.labels) {
                chart.data.datasets[i].backgroundColor.push(diagonalPattern(combineColors(secondColor, getColourModifier(label)), true));
                chart.data.datasets[i].borderColor.push(toRGBA(combineColors(secondColor, getColourModifier(label)), 1.0));
            }

            for (var sca in labels.scales) {
                label = labels.scales[sca];

                if(label.name == chart.data.datasets[i].label) {
                    secondAxis.scaleLabel.labelString = label.axis;

                    if (label.unitLong != undefined) {
                        secondAxis.scaleLabel.labelString += " [" + label.unitLong + "]";
                    }

                    secondUnit = label.unitLong;

                    break;
                }
            }

            if (firstUnit != secondUnit) {
                secondAxis.display = true;

                chart.getDatasetMeta(i).yAxisID = "second";

                secondMax = Math.max.apply(null, chart.data.datasets[i].data.filter(x => x != Infinity)) + (Math.max.apply(null, chart.data.datasets[i].sdev.filter(x => x != Infinity)) * checked || 0);
            }
            else {
                chart.getDatasetMeta(i).yAxisID = "first";

                firstMax = Math.max(firstMax, Math.max.apply(null, chart.data.datasets[i].data.filter(x => x != Infinity)) + (Math.max.apply(null, chart.data.datasets[i].sdev.filter(x => x != Infinity)) * checked || 0));
            }

            break;
        }
        else {
            chart.data.datasets[i].data = [];
            chart.data.datasets[i].sdev = [];
        }
    }

    i++;

    for (; i < chart.data.datasets.length; i++) {
        chart.data.datasets[i].data = [];
        chart.data.datasets[i].sdev = [];
    }

    var firstOrder = Math.pow(10, Math.floor(Math.log10(firstMax)));
    var firstNorm = firstMax / firstOrder;
    var firstStep = (firstNorm <= 2.0) ? 0.2 : ((firstNorm <= 5.0) ? 0.5 : 1.0);
    var firstClass = Math.ceil(firstNorm / firstStep);

    firstNorm = firstClass * firstStep;

    if (secondAxis.display) {
        var secondOrder = Math.pow(10, Math.floor(Math.log10(secondMax)));
        var secondNorm = secondMax / secondOrder;
        var secondStep = (secondNorm <= 2.0) ? 0.2 : ((secondNorm <= 5.0) ? 0.5 : 1.0);
        var secondClass = Math.ceil(secondNorm / secondStep);

        secondNorm = secondClass * secondStep;

        var firstDist = secondClass - firstClass;

        if (firstDist < 0) {
            firstDist = (firstDist + 5) % 5;
        }

        var secondDist = firstClass - secondClass;

        if (secondDist < 0) {
            secondDist = (secondDist + 5) % 5;
        }

        if (firstDist <= secondDist) {
            for (; firstDist > 0; firstDist--) {
                firstNorm += ((firstNorm < 2.0) ? 0.2 : ((firstNorm < 5.0) ? 0.5 : ((firstNorm < 10) ? 1.0 : 2.0)));
            }
        }
        else {
            for (; secondDist > 0; secondDist--) {
                secondNorm += ((secondNorm < 2.0) ? 0.2 : ((secondNorm < 5.0) ? 0.5 : ((secondNorm < 10) ? 1.0 : 2.0)));
            }
        }

        secondAxis.ticks.max = Math.round(secondNorm * secondOrder * 100) / 100;
    }

    firstAxis.ticks.max = Math.round(firstNorm * firstOrder * 100) / 100;

    if (animate) {
        chart.update();
    }
    else {
        chart.update(0);
    }

    sdev.style.marginRight = (chart.canvas.getBoundingClientRect().width - langAxis.right) + "px";
}

function getColourModifier(name) {
    if (!(name in barColours)) {
        barColours[name] = {r: Math.round(Math.random() * 30) - 15, g: Math.round(Math.random() * 30) - 15, b: Math.round(Math.random() * 30) - 15};
    }

    return barColours[name];
}

function combineColors(colA, colB) {
    return {r: Math.round(colA.r + colB.r), g: Math.round(colA.g + colB.g), b: Math.round(colA.b + colB.b)};
}

function toRGBA(color, alpha) {
    return "rgba(" + color.r + ", " + color.g + ", " + color.b + ", " + alpha + ")";
}

// Sandboxed Code Evaluation begin (see references)
const sandboxProxies = new WeakMap();

function compileCode (src) {
    src = "with (sandbox) {" + src + "}";
    const code = new Function("sandbox", src);

    return function (sandbox) {
        if (!sandboxProxies.has(sandbox)) {
            const sandboxProxy = new Proxy(sandbox, {has, get});
            sandboxProxies.set(sandbox, sandboxProxy);
        }

        return code(sandboxProxies.get(sandbox));
    }
}

function has (target, key) {
    return true;
}

function get (target, key) {
    if (key === Symbol.unscopables) {
        return undefined;
    }

    return target[key];
}
// Sandboxed Code Evaluation end (see references)

var place = document.getElementById("place");
place.onmousedown = swap;
place.onmouseover = swap;
place.onmousemove = swap;
place.onclick = swap;

function swap() {
    chart.stop();
    chart.render(0);

    place.src = chart.toBase64Image();

    var chartParent = activeChartContainer.parentElement;
    var placeParent = inactiveChartContainer.parentElement;

    chartParent.removeChild(activeChartContainer);
    placeParent.removeChild(inactiveChartContainer);

    chartParent.appendChild(inactiveChartContainer);
    placeParent.appendChild(activeChartContainer);

    loadChart();
}

function loadChart() {
    var setup = charts[activeChartContainer.parentElement.id];

    if (setup == undefined) {
        return;
    }

    for (var bench in benchmarks) {
        if (bench == setup.benchmark) {
            lastBenchmark = bench;

            break;
        }
    }

    for (var option of comparison.children) {
        if (setup.languages.indexOf(option.value) != -1) {
            option.classList.add("selected");
        }
        else {
            option.classList.remove("selected");
        }
    }

    var i = 0;

    for (var label in labels.scales) {
        chart.data.datasets[i].hidden = (setup.labels.indexOf(label) == -1);

        i++
    }

    reloadLanguages(false);

    chart.update(0);
}

function getVisibility(ele) {
    var rect = ele.getBoundingClientRect();

    if (rect.bottom < 0) {
        return rect.bottom / window.innerHeight;
    }

    if (rect.top > window.innerHeight) {
        return (window.innerHeight - rect.top) / innerHeight;
    }

    return (Math.max(Math.min(rect.bottom, window.innerHeight), 0) - Math.min(Math.max(rect.top, 0), window.innerHeight)) / innerHeight;
}

var visibleCharts = {};

var activeChartContainer = document.getElementById("activeChartContainer");
var inactiveChartContainer = document.getElementById("inactiveChartContainer");

function checkVisibilities() {
    if (isZoomedIn) {
        return;
    }

    var container;

    var firstContainer, secondContainer;

    var firstMax = 0, secondMax = 0;

    for (var crt in charts) {
        container = document.getElementById(crt);

        visibility = getVisibility(container);

        if (visibility > 0) {
            if (!visibleCharts[crt]) {
                if (firstContainer != undefined) {
                    secondMax = firstMax;
                    secondContainer = firstContainer;
                }

                firstMax = Infinity;
                firstContainer = container;
            }
            else if (visibility > firstMax) {
                if (firstContainer != undefined) {
                    secondMax = firstMax;
                    secondContainer = firstContainer;
                }

                firstMax = visibility;
                firstContainer = container;
            }
            else if (visibility > secondMax) {
                secondMax = visibility;
                secondContainer = container;
            }
        }

        visibleCharts[crt] = false;
    }

    if ((firstContainer == undefined) && (secondContainer == undefined)) {
        activeChartContainer.hidden = true;
        inactiveChartContainer.hidden = true;

        return;
    }

    visibleCharts[firstContainer.id] = true;

    var activeParent = activeChartContainer.parentElement;

    if (secondContainer == undefined) {
        if (firstContainer != activeParent) {
            activeParent.removeChild(activeChartContainer);
            firstContainer.appendChild(activeChartContainer);

            loadChart();
        }

        activeChartContainer.hidden = false;
        inactiveChartContainer.hidden = true;

        return;
    }

    visibleCharts[secondContainer.id] = true;

    activeChartContainer.hidden = false;
    inactiveChartContainer.hidden = false;

    var inactiveParent = inactiveChartContainer.parentElement;

    if ((firstContainer == activeParent) && (secondContainer == inactiveParent)) {
        return;
    }

    if ((firstMax < Infinity) && (firstContainer == inactiveParent) && (secondContainer == activeParent)) {
        return;
    }

    if (secondContainer != inactiveParent) {
        chart.stop();
        chart.render(0);

        place.src = chart.toBase64Image();

        activeParent.removeChild(activeChartContainer);
        inactiveParent.removeChild(inactiveChartContainer);

        secondContainer.appendChild(inactiveChartContainer);
    }
    else {
        activeParent.removeChild(activeChartContainer);
    }

    firstContainer.appendChild(activeChartContainer);

    loadChart();
}

document.onscroll = checkVisibilities;

function diagonalPattern(color, flipped) {
    var diagonalCanvas = document.createElement("canvas");
    var diagonalContext = diagonalCanvas.getContext("2d");

    diagonalCanvas.width = 20;
    diagonalCanvas.height = 20;

    diagonalContext.beginPath();
    diagonalContext.rect(0, 0, 20, 20);
    diagonalContext.fillStyle = toRGBA(color, 0.5);
    diagonalContext.fill();
    diagonalContext.closePath();

    diagonalContext.beginPath();

    diagonalContext.strokeStyle = toRGBA(color, 1.0);
    diagonalContext.lineWidth = 2;

    diagonalContext.moveTo(flipped ? 9 : 11, -1);
    diagonalContext.lineTo(flipped ? 21 : -1, 11);
    diagonalContext.moveTo(flipped ? -1 : 21, 9);
    diagonalContext.lineTo(flipped ? 11 : 9, 21);
    diagonalContext.stroke();

    diagonalContext.closePath();

    var pattern = diagonalContext.createPattern(diagonalCanvas, "repeat");
    pattern.color = toRGBA(color, 0.5);

    return pattern;
}

var toolContainer = document.getElementById("chzrt");
var toolAnchor = "article";

function zoomIn(crt) {
    if (isZoomedIn) {
        return;
    }

    title.innerHTML = "Language Comparison Tool &middot; Software Development &middot; Green Computing";

    article.hidden = true;

    var chartParent = activeChartContainer.parentElement;

    if (crt != undefined) {
        if (chartParent.id != crt) {
            swap();

            chartParent = activeChartContainer.parentElement;
        }

        toolContainer.id = crt;
        toolAnchor = crt;
    }
    else {
        toolContainer.id = chartParent.id;
        toolAnchor = "article";
    }

    inactiveChartContainer.hidden = true;

    chartParent.removeChild(activeChartContainer);
    toolContainer.appendChild(activeChartContainer);

    activeChartContainer.hidden = false;

    tool.hidden = false;

    artlOption.classList.remove("active");
    toolOption.classList.add("active");

    benchmark.hidden = false;

    isZoomedIn = true;

    lastLanguage = undefined;
    sdev.classList.add("checked");

    loadChart();

    window.location.hash = "tool";
}

function zoomOut(reload) {
    if (!isZoomedIn) {
        return;
    }

    title.innerHTML = "Language Efficiency &middot; Software Development &middot; Green Computing";

    if (reload != undefined) {
        toolAnchor = toolContainer.id;
    }

    isZoomedIn = false;

    toolContainer.id = "chzrt";

    var chartParent = document.getElementById(toolAnchor);

    benchmark.hidden = true;

    artlOption.classList.add("active");
    toolOption.classList.remove("active");

    tool.hidden = true;

    toolContainer.removeChild(activeChartContainer);
    chartParent.appendChild(activeChartContainer);

    article.hidden = false;

    lastLanguage = undefined;
    sdev.classList.add("checked");

    loadChart();

    window.location.hash = toolAnchor;

    checkVisibilities();
}

window.onresize = function() {
    var bbx = document.body.getBoundingClientRect();

    var width;

    if (window.innerWidth <= 600) {
        width = "95%";
        menu.style.position = "fixed";
    }
    else {
        width = "calc(95% - 250px)";
        menu.style.position = "relative";
    }

    tool.style.width = article.style.width = width;

    document.styleSheets[2].cssRules[11].style.width = (bbx.width * 0.5) + "px";
    document.styleSheets[2].cssRules[13].cssRules[0].style.width = (bbx.width * 0.45) + "px";
    document.styleSheets[2].cssRules[14].cssRules[0].style.width = (bbx.width * 0.9) + "px";
}

function langClick(e) {
    if (e.target.classList.contains("disabled")) {
        return;
    }

    if (e.target.classList.contains("selected")) {
        e.target.classList.remove("selected");
    }
    else {
        e.target.classList.add("selected");
    }

    reloadChart(true);
}

function sdevClick(e) {
    if (sdev.classList.contains("checked")) {
        sdev.classList.remove("checked");
    }
    else {
        sdev.classList.add("checked");
    }

    reloadAxis(true);
}

var preview = atob("IF9fX19fX18gIF8gICAgICAgX19fX19fX19fIF9fX19fX18gIF8gICAgICAgICAgICBfX19fX19fIA0KKCAgX19fXyBcKCBcICAgICAgXF9fICAgX18vKCAgX19fXyBcfCBcICAgIC9cICAgICggIF9fXyAgKQ0KfCAoICAgIFwvfCAoICAgICAgICAgKSAoICAgfCAoICAgIFwvfCAgXCAgLyAvICAgIHwgKCAgICkgfA0KfCB8ICAgICAgfCB8ICAgICAgICAgfCB8ICAgfCB8ICAgICAgfCAgKF8vIC8gICAgIHwgKF9fXykgfA0KfCB8ICAgICAgfCB8ICAgICAgICAgfCB8ICAgfCB8ICAgICAgfCAgIF8gKCAgICAgIHwgIF9fXyAgfA0KfCB8ICAgICAgfCB8ICAgICAgICAgfCB8ICAgfCB8ICAgICAgfCAgKCBcIFwgICAgIHwgKCAgICkgfA0KfCAoX19fXy9cfCAoX19fXy9cX19fKSAoX19ffCAoX19fXy9cfCAgLyAgXCBcICAgIHwgKSAgICggfA0KKF9fX19fX18vKF9fX19fX18vXF9fX19fX18vKF9fX19fX18vfF8vICAgIFwvICAgIHwvICAgICBcfA0KIF9fX19fXyAgIF9fX19fX18gIF9fX19fX18gICAgIF9fX19fX19fXyBfX19fX19fICAgICAgX19fX19fXyAgX19fX19fXyAgX19fX19fXyANCiggIF9fXyBcICggIF9fXyAgKSggIF9fX18gKSAgICBcX18gICBfXy8oICBfX18gICkgICAgKCAgX19fXyBcKCAgX19fXyBcKCAgX19fXyBcDQp8ICggICApICl8ICggICApIHx8ICggICAgKXwgICAgICAgKSAoICAgfCAoICAgKSB8ICAgIHwgKCAgICBcL3wgKCAgICBcL3wgKCAgICBcLw0KfCAoX18vIC8gfCAoX19fKSB8fCAoX19fXyl8ICAgICAgIHwgfCAgIHwgfCAgIHwgfCAgICB8IChfX19fXyB8IChfXyAgICB8IChfXyAgICANCnwgIF9fICggIHwgIF9fXyAgfHwgICAgIF9fKSAgICAgICB8IHwgICB8IHwgICB8IHwgICAgKF9fX19fICApfCAgX18pICAgfCAgX18pICAgDQp8ICggIFwgXCB8ICggICApIHx8IChcICggICAgICAgICAgfCB8ICAgfCB8ICAgfCB8ICAgICAgICAgICkgfHwgKCAgICAgIHwgKCAgICAgIA0KfCApX19fKSApfCApICAgKCB8fCApIFwgXF9fICAgICAgIHwgfCAgIHwgKF9fXykgfCAgICAvXF9fX18pIHx8IChfX19fL1x8IChfX19fL1wNCnwvIFxfX18vIHwvICAgICBcfHwvICAgXF9fLyAgICAgICApXyggICAoX19fX19fXykgICAgXF9fX19fX18pKF9fX19fX18vKF9fX19fX18vDQpfX19fX19fX18gICAgICAgICAgX19fX19fXyAgICAgICAgIF8gICAgICAgICBfICAgIA0KXF9fICAgX18vfFwgICAgIC98KCAgX19fXyBcICAgICAgIC8gKSAgICAgL1woIFwgICANCiAgICkgKCAgIHwgKSAgICggfHwgKCAgICBcLyAgICAgIC8gLyAgICAgLyAvIFwgXCAgDQogICB8IHwgICB8IChfX18pIHx8IChfXyAgICAgICAgIC8gLyAgICAgLyAvICAgXCBcIA0KICAgfCB8ICAgfCAgX19fICB8fCAgX18pICAgICAgICggKCAgICAgLyAvICAgICApICkNCiAgIHwgfCAgIHwgKCAgICkgfHwgKCAgICAgICAgICAgXCBcICAgLyAvICAgICAvIC8gDQogICB8IHwgICB8ICkgICAoIHx8IChfX19fL1wgICAgICBcIFwgLyAvICAgICAvIC8gIA0KICAgKV8oICAgfC8gICAgIFx8KF9fX19fX18vICAgICAgIFxfKVwvICAgICAoXy8gICA=");
