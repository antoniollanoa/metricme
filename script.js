(() => {
  "use strict";

  const STORAGE_KEY = "metricme-data-v1";
  const THEME_KEY = "metricme-theme";
  const DEFAULT_GOAL = 80;
  const $ = (selector) => document.querySelector(selector);

  const elements = {
    today: $("#today-date"),
    currentWeight: $("#current-weight"),
    currentNote: $("#current-note"),
    startingWeight: $("#starting-weight"),
    goalInput: $("#goal-input"),
    saveGoal: $("#save-goal"),
    totalChange: $("#total-change"),
    remainingGoal: $("#remaining-goal"),
    remainingNote: $("#remaining-note"),
    form: $("#measurement-form"),
    weightInput: $("#weight-input"),
    dateInput: $("#date-input"),
    saveMeasurement: $("#save-measurement"),
    cancelEdit: $("#cancel-edit"),
    formMessage: $("#form-message"),
    historyBody: $("#history-body"),
    historyEmpty: $("#history-empty"),
    chartCanvas: $("#weight-chart"),
    chartEmpty: $("#chart-empty"),
    exportCsv: $("#export-csv"),
    appNotice: $("#app-notice"),
    themeToggle: $("#theme-toggle"),
    themeLabel: $("#theme-label"),
    rangeButtons: [...document.querySelectorAll("[data-range]")],
  };

  let measurements = [];
  let goal = DEFAULT_GOAL;
  let editingDate = null;
  let chart = null;
  let chartRange = "30";

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dateFromString(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDate(value, options = { year: "numeric", month: "short", day: "numeric" }) {
    return new Intl.DateTimeFormat(undefined, options).format(dateFromString(value));
  }

  function formatWeight(value) {
    return `${Number(value).toFixed(1)} kg`;
  }

  function formatChange(value) {
    if (Math.abs(value) < 0.05) return "0.0 kg";
    return `${value > 0 ? "+" : ""}${value.toFixed(1)} kg`;
  }

  function setMessage(message, isError = false) {
    elements.formMessage.textContent = message;
    elements.formMessage.classList.toggle("error", isError);
  }

  function setNotice(message, isError = false) {
    elements.appNotice.textContent = message;
    elements.appNotice.classList.toggle("error", isError);
  }

  function isValidWeight(value) {
    return Number.isFinite(value) && value >= 1 && value <= 1000;
  }

  function isValidRecord(record) {
    return record
      && typeof record.date === "string"
      && /^\d{4}-\d{2}-\d{2}$/.test(record.date)
      && !Number.isNaN(dateFromString(record.date).getTime())
      && localDateString(dateFromString(record.date)) === record.date
      && isValidWeight(record.weight);
  }

  function loadData() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      setNotice("Browser storage is unavailable. Changes may not be saved.", true);
      return;
    }
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.measurements)) {
        throw new Error("Stored data has an unexpected format.");
      }
      const seenDates = new Set();
      measurements = saved.measurements.filter((record) => {
        if (!isValidRecord(record) || seenDates.has(record.date)) return false;
        seenDates.add(record.date);
        return true;
      });
      if (measurements.length !== saved.measurements.length) {
        setNotice("Some invalid saved entries were skipped.", true);
      }
      if (isValidWeight(saved.goal)) goal = saved.goal;
    } catch (error) {
      measurements = [];
      setNotice("Saved data could not be read. Existing browser data was left unchanged.", true);
    }
  }

  function persistData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ measurements, goal }));
      return true;
    } catch (error) {
      setNotice("Could not save to browser storage. Check available storage and try again.", true);
      return false;
    }
  }

  function sortedMeasurements() {
    return [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  }

  function renderMetrics() {
    const ordered = sortedMeasurements();
    elements.goalInput.value = goal.toFixed(1);

    if (!ordered.length) {
      elements.currentWeight.textContent = "—";
      elements.startingWeight.textContent = "—";
      elements.totalChange.textContent = "—";
      elements.remainingGoal.textContent = "—";
      elements.currentNote.textContent = "Add your first measurement";
      elements.remainingNote.textContent = "Log a weight to get started";
      return;
    }

    const first = ordered[0];
    const latest = ordered[ordered.length - 1];
    const change = latest.weight - first.weight;
    const remaining = latest.weight - goal;
    elements.currentWeight.textContent = formatWeight(latest.weight);
    elements.startingWeight.textContent = formatWeight(first.weight);
    elements.totalChange.textContent = formatChange(change);
    elements.remainingGoal.textContent = `${Math.abs(remaining).toFixed(1)} kg`;
    elements.currentNote.textContent = `Last recorded ${formatDate(latest.date)}`;
    elements.remainingNote.textContent = remaining > 0.049
      ? "To reach your goal"
      : remaining < -0.049 ? "Below your goal" : "You reached your goal";
  }

  function renderHistory() {
    const ordered = sortedMeasurements();
    elements.historyBody.replaceChildren();
    elements.historyEmpty.hidden = ordered.length > 0;

    const previousByDate = new Map();
    ordered.forEach((record, index) => {
      previousByDate.set(record.date, index === 0 ? null : ordered[index - 1].weight);
    });

    [...ordered].reverse().forEach((record) => {
      const row = document.createElement("tr");
      const previous = previousByDate.get(record.date);
      const change = previous === null ? null : record.weight - previous;
      const dateCell = document.createElement("td");
      const weightCell = document.createElement("td");
      const changeCell = document.createElement("td");
      const actionsCell = document.createElement("td");

      dateCell.textContent = formatDate(record.date);
      weightCell.textContent = formatWeight(record.weight);
      changeCell.textContent = change === null ? "—" : formatChange(change);
      if (change !== null && change !== 0) {
        changeCell.classList.add(change < 0 ? "change-positive" : "change-negative");
      }

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "row-action";
      editButton.textContent = "Edit";
      editButton.setAttribute("aria-label", `Edit measurement for ${formatDate(record.date)}`);
      editButton.addEventListener("click", () => beginEdit(record));

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "row-action delete";
      deleteButton.textContent = "Delete";
      deleteButton.setAttribute("aria-label", `Delete measurement for ${formatDate(record.date)}`);
      deleteButton.addEventListener("click", () => deleteMeasurement(record));

      actionsCell.append(editButton, deleteButton);
      row.append(dateCell, weightCell, changeCell, actionsCell);
      elements.historyBody.append(row);
    });
  }

  function getChartColors() {
    const styles = getComputedStyle(document.body);
    return {
      text: styles.getPropertyValue("--muted").trim(),
      grid: styles.getPropertyValue("--line").trim(),
      accent: styles.getPropertyValue("--accent").trim(),
    };
  }

  function chartMeasurements() {
    const ordered = sortedMeasurements();
    if (chartRange === "all" || ordered.length === 0) return ordered;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (Number(chartRange) - 1));
    const cutoffString = localDateString(cutoff);
    return ordered.filter((record) => record.date >= cutoffString);
  }

  function renderChart() {
    const filtered = chartMeasurements();
    elements.chartEmpty.hidden = filtered.length > 0;
    elements.chartEmpty.textContent = typeof Chart === "undefined"
      ? "Chart could not load. Check your internet connection and refresh."
      : "Your trend will appear here after your first entry.";
    if (typeof Chart === "undefined") return;

    const colors = getChartColors();
    const labels = filtered.map((record) => record.date);
    const datasets = [
      {
        label: "Weight",
        data: filtered.map((record) => record.weight),
        borderColor: colors.accent,
        backgroundColor: colors.accent,
        pointBackgroundColor: colors.accent,
        pointBorderColor: colors.accent,
        pointRadius: filtered.length > 30 ? 1.5 : 3,
        pointHoverRadius: 5,
        borderWidth: 2,
        tension: 0.25,
      },
    ];
    if (filtered.length) {
      datasets.push({
        label: `Goal (${formatWeight(goal)})`,
        data: filtered.map(() => goal),
        borderColor: colors.text,
        pointRadius: 0,
        borderWidth: 1,
        borderDash: [5, 5],
        tension: 0,
      });
    }

    const config = {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title(items) {
                return items.length ? formatDate(items[0].label, { year: "numeric", month: "long", day: "numeric" }) : "";
              },
              label(context) {
                return `${context.dataset.label}: ${formatWeight(context.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: colors.text,
              maxTicksLimit: 6,
              callback(value) {
                const label = this.getLabelForValue(value);
                return formatDate(label, { month: "short", day: "numeric" });
              },
            },
          },
          y: {
            grid: { color: colors.grid, drawTicks: false },
            border: { display: false },
            ticks: {
              color: colors.text,
              padding: 8,
              callback(value) { return `${value} kg`; },
            },
          },
        },
      },
    };

    if (chart) {
      chart.data = config.data;
      chart.options = config.options;
      chart.update();
    } else {
      chart = new Chart(elements.chartCanvas, config);
    }
  }

  function render() {
    renderMetrics();
    renderHistory();
    renderChart();
  }

  function resetForm() {
    editingDate = null;
    elements.form.reset();
    elements.dateInput.value = localDateString();
    elements.saveMeasurement.textContent = "Save measurement";
    elements.cancelEdit.hidden = true;
    setMessage("");
  }

  function beginEdit(record) {
    editingDate = record.date;
    elements.weightInput.value = record.weight;
    elements.dateInput.value = record.date;
    elements.saveMeasurement.textContent = "Update measurement";
    elements.cancelEdit.hidden = false;
    setMessage("Editing this measurement. You can change its date.");
    elements.weightInput.focus();
    elements.form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function saveMeasurement(event) {
    event.preventDefault();
    const weight = Number(elements.weightInput.value);
    const date = elements.dateInput.value;
    if (!isValidWeight(weight)) {
      setMessage("Enter a weight between 1 and 1000 kg.", true);
      elements.weightInput.focus();
      return;
    }
    if (!date || !isValidRecord({ date, weight })) {
      setMessage("Choose a valid measurement date.", true);
      elements.dateInput.focus();
      return;
    }
    if (date > localDateString()) {
      setMessage("Measurement date cannot be in the future.", true);
      elements.dateInput.focus();
      return;
    }

    const targetDate = date;
    const wasEditing = editingDate !== null;
    measurements = measurements.filter((record) => record.date !== editingDate && record.date !== targetDate);
    measurements.push({ date: targetDate, weight });
    const saved = persistData();
    render();
    resetForm();
    if (saved) setMessage(wasEditing ? "Measurement updated." : "Measurement saved.");
  }

  function deleteMeasurement(record) {
    if (!window.confirm(`Delete the measurement for ${formatDate(record.date)}?`)) return;
    measurements = measurements.filter((entry) => entry.date !== record.date);
    const saved = persistData();
    if (editingDate === record.date) resetForm();
    render();
    if (saved) setNotice("Measurement deleted.");
  }

  function saveGoal() {
    const nextGoal = Number(elements.goalInput.value);
    if (!isValidWeight(nextGoal)) {
      setNotice("Enter a goal between 1 and 1000 kg.", true);
      elements.goalInput.value = goal.toFixed(1);
      return;
    }
    goal = nextGoal;
    if (persistData()) setNotice("Goal weight updated.");
    render();
  }

  function exportCsv() {
    const ordered = sortedMeasurements();
    if (!ordered.length) {
      setNotice("Add a measurement before exporting your data.", true);
      return;
    }
    const rows = [["Date", "Weight (kg)", "Change from previous (kg)"]];
    ordered.forEach((record, index) => {
      const change = index === 0 ? "" : (record.weight - ordered[index - 1].weight).toFixed(1);
      rows.push([record.date, record.weight.toFixed(1), change]);
    });
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `metricme-measurements-${localDateString()}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice("Your CSV export is ready.");
  }

  function setTheme(isDark) {
    document.body.classList.toggle("dark", isDark);
    elements.themeLabel.textContent = isDark ? "Light mode" : "Dark mode";
    elements.themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch (error) {
      setNotice("Theme changed, but could not be saved in browser storage.", true);
    }
    renderChart();
  }

  function initialize() {
    elements.today.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "long", month: "long", day: "numeric",
    }).format(new Date());
    elements.dateInput.value = localDateString();
    loadData();

    try {
      setTheme(localStorage.getItem(THEME_KEY) === "dark");
    } catch (error) {
      setTheme(false);
    }

    elements.form.addEventListener("submit", saveMeasurement);
    elements.cancelEdit.addEventListener("click", resetForm);
    elements.saveGoal.addEventListener("click", saveGoal);
    elements.goalInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveGoal();
      }
    });
    elements.exportCsv.addEventListener("click", exportCsv);
    elements.themeToggle.addEventListener("click", () => setTheme(!document.body.classList.contains("dark")));
    elements.rangeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.range === chartRange));
      button.addEventListener("click", () => {
        chartRange = button.dataset.range;
        elements.rangeButtons.forEach((item) => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        renderChart();
      });
    });
    render();
  }

  initialize();
})();
