(() => {
  const STORAGE_KEYS = {
    tasks: "weatherTaskScheduler.tasks",
    lastZip: "weatherTaskScheduler.lastZip",
    advancedOpen: "weatherTaskScheduler.advancedOpen"
  };

  const GEO_FALLBACKS = [
    { lat: 40.7128, lon: -74.006, zip: "10001" },
    { lat: 34.0522, lon: -118.2437, zip: "90012" },
    { lat: 41.8781, lon: -87.6298, zip: "60604" },
    { lat: 29.7604, lon: -95.3698, zip: "77002" },
    { lat: 47.6062, lon: -122.3321, zip: "98101" },
    { lat: 37.7749, lon: -122.4194, zip: "94103" }
  ];

  const analytics = (event, payload = {}) => {
    const store = (window.analyticsEvents = window.analyticsEvents || []);
    store.push({ event, payload, timestamp: new Date().toISOString() });
  };

  const escapeHtml = (value) => {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });

  const durationFormatter = (hours) => {
    const totalMinutes = Math.round(Number(hours || 0) * 60);
    const wholeHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (wholeHours && minutes) {
      return `${wholeHours} hr ${minutes} min`;
    }
    if (wholeHours) {
      return wholeHours === 1 ? "1 hour" : `${wholeHours} hours`;
    }
    return `${minutes} min`;
  };

  const formatRange = (startIso, endIso) => {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const dateLabel = dateFormatter.format(start);
    const startTime = timeFormatter.format(start);
    const endTime = timeFormatter.format(end);
    return `${dateLabel} · ${startTime} – ${endTime}`;
  };

  const parseTimeToMinutes = (value) => {
    if (!value) return null;
    const [hours, minutes] = value.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  const clamp = (value, min, max) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return min;
    return Math.min(Math.max(numeric, min), max);
  };

  const nearestZip = (lat, lon) => {
    let best = null;
    let bestDistance = Infinity;
    GEO_FALLBACKS.forEach((candidate) => {
      const dLat = lat - candidate.lat;
      const dLon = lon - candidate.lon;
      const distance = Math.sqrt(dLat * dLat + dLon * dLon);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    });
    return best ? best.zip : null;
  };

  const randomBetween = (min, max) => Math.round(Math.random() * (max - min) + min);

  const generateWindowsForTask = (task) => {
    const windows = [];
    const now = new Date();
    const durationMinutes = Math.round(task.durationHours * 60);
    const earliest = parseTimeToMinutes(task.earliestStart) ?? 6 * 60;
    const latestCap = parseTimeToMinutes(task.latestStart);
    const latest = latestCap != null ? latestCap : 19 * 60;
    const usableLatest = latest - durationMinutes;
    if (usableLatest <= earliest) {
      return windows;
    }

    let dayOffset = 1;
    while (windows.length < 4 && dayOffset <= 12) {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      startOfDay.setDate(startOfDay.getDate() + dayOffset);
      const startMinutes = randomBetween(earliest, usableLatest);
      const startDate = new Date(startOfDay.getTime() + startMinutes * 60000);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

      const temperature = task.temperatureEnabled
        ? randomBetween(task.minTemp, task.maxTemp)
        : randomBetween(55, 85);
      const humidity = task.humidityEnabled
        ? randomBetween(task.minHumidity, task.maxHumidity)
        : randomBetween(25, 75);

      const conditionsPool = task.requireDry
        ? ["clear", "partly cloudy"]
        : ["clear", "partly cloudy", "light rain", "overcast"];
      const condition = conditionsPool[randomBetween(0, conditionsPool.length - 1)];
      if (task.requireDry && condition.includes("rain")) {
        dayOffset += 1;
        continue;
      }

      const summary = `${temperature} °F, ${condition}`;
      windows.push({
        id: `${task.id}-window-${dayOffset}-${startMinutes}`,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        temperature,
        humidity,
        condition,
        summary
      });
      dayOffset += randomBetween(1, 2);
    }
    return windows;
  };
  const createSampleTasks = () => {
    const baseTasks = [
      {
        id: "sample-1",
        name: "Stain the deck",
        durationHours: 3,
        location: "98101",
        earliestStart: "09:00",
        latestStart: "17:00",
        temperatureEnabled: true,
        minTemp: 60,
        maxTemp: 80,
        humidityEnabled: true,
        minHumidity: 20,
        maxHumidity: 65,
        requireDry: true,
        status: "Scheduled",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        windowsCollapsed: false
      },
      {
        id: "sample-2",
        name: "Install outdoor lights",
        durationHours: 1.5,
        location: "10001",
        earliestStart: "07:00",
        latestStart: "20:00",
        temperatureEnabled: true,
        minTemp: 50,
        maxTemp: 75,
        humidityEnabled: false,
        minHumidity: null,
        maxHumidity: null,
        requireDry: false,
        status: "Pending",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        windowsCollapsed: false
      }
    ];

    return baseTasks.map((task) => {
      const windows = generateWindowsForTask(task);
      let scheduledWindow = null;
      if (windows.length) {
        scheduledWindow = { start: windows[0].start, end: windows[0].end };
      }
      return {
        ...task,
        windows,
        scheduledWindow
      };
    });
  };

  const overlap = (aStart, aEnd, bStart, bEnd) => {
    return aStart < bEnd && bStart < aEnd;
  };

  const computeConflictFlags = (tasks) => {
    const scheduledTasks = tasks.filter(
      (t) => t.scheduledWindow && t.status !== "Completed"
    );
    const conflictMap = new Map();
    tasks.forEach((task) => {
      if (!task.windows) return;
      const windows = task.windows.map((window) => {
        const start = new Date(window.start).getTime();
        const end = new Date(window.end).getTime();
        const isConflict = scheduledTasks.some((other) => {
          if (other.id === task.id || !other.scheduledWindow) return false;
          const otherStart = new Date(other.scheduledWindow.start).getTime();
          const otherEnd = new Date(other.scheduledWindow.end).getTime();
          return overlap(start, end, otherStart, otherEnd);
        });
        const isPreferred =
          task.scheduledWindow &&
          task.scheduledWindow.start === window.start &&
          task.scheduledWindow.end === window.end;
        return { ...window, conflict: isConflict, preferred: isPreferred };
      });
      conflictMap.set(task.id, windows);
    });
    return conflictMap;
  };

  const windowConditionIcon = (window) => {
    if (window.conflict) {
      return '<span class="window-icons" title="Overlaps another scheduled task" data-status="conflict"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 4a1 1 0 0 0-.993.883L11 7v5a1 1 0 0 0 1.993.117L13 12V7a1 1 0 0 0-1-1Zm0 10a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"></path></svg></span>';
    }
    return '<span class="window-icons" data-status="clear" title="No conflicts"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10.293 15.293 7.05 12.05a1 1 0 0 1 1.414-1.414L11 13.172l4.536-4.535a1 1 0 0 1 1.498 1.32l-.083.094-5.243 5.243a1 1 0 0 1-1.415 0Z"></path></svg></span>';
  };
  document.addEventListener("DOMContentLoaded", () => {
    const shell = document.querySelector("[data-app-shell]");
    if (!shell) return;

    const elements = {
      addPanel: document.getElementById("addTaskPanel"),
      taskListPanel: document.getElementById("taskListPanel"),
      taskList: document.getElementById("taskList"),
      taskListEmpty: document.getElementById("taskListEmpty"),
      refreshAllButton: document.getElementById("refreshAllButton"),
      floatingButton: document.getElementById("floatingAddButton"),
      modalOverlay: document.getElementById("modalOverlay"),
      tabletToggle: document.getElementById("tabletToggleButton"),
      modalCloseButton: document.getElementById("modalCloseButton"),
      toastRegion: document.getElementById("toastRegion"),
      form: document.getElementById("addTaskForm"),
      submitButton: document.getElementById("submitTaskButton"),
      cancelEditButton: document.getElementById("cancelEditButton"),
      advancedToggle: document.getElementById("advancedToggle"),
      advancedContent: document.getElementById("advancedContent"),
      temperatureToggle: document.getElementById("temperatureToggle"),
      humidityToggle: document.getElementById("humidityToggle"),
      tempMinInput: document.getElementById("tempMin"),
      tempMaxInput: document.getElementById("tempMax"),
      tempMinSlider: document.getElementById("tempMinSlider"),
      tempMaxSlider: document.getElementById("tempMaxSlider"),
      humidityMinInput: document.getElementById("humidityMin"),
      humidityMaxInput: document.getElementById("humidityMax"),
      humidityMinSlider: document.getElementById("humidityMinSlider"),
      humidityMaxSlider: document.getElementById("humidityMaxSlider"),
      noRainToggle: document.getElementById("taskNoRain"),
      presetChips: shell.querySelectorAll(".chip"),
      nameInput: document.getElementById("taskName"),
      durationInput: document.getElementById("taskDuration"),
      durationSteppers: shell.querySelectorAll(".stepper"),
      zipInput: document.getElementById("taskZip"),
      earliestInput: document.getElementById("taskEarliest"),
      latestInput: document.getElementById("taskLatest"),
      formErrors: {
        name: document.getElementById("nameError"),
        duration: document.getElementById("durationError"),
        zip: document.getElementById("zipError"),
        time: document.getElementById("timeError"),
        temperature: document.getElementById("temperatureError"),
        humidity: document.getElementById("humidityError")
      }
    };

    const state = {
      tasks: [],
      conflictMap: new Map(),
      layoutMode: null,
      addCollapsed: false,
      modalOpen: false,
      editingTaskId: null,
      lastZip: localStorage.getItem(STORAGE_KEYS.lastZip) || "",
      advancedOpen: sessionStorage.getItem(STORAGE_KEYS.advancedOpen) === "true",
      formOrigin: null,
      trapHandler: null,
      previousFocus: null,
      noWindowLogged: new Set()
    };

    const saveTasks = () => {
      localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(state.tasks));
    };

    const showToast = (message, type = "success") => {
      if (!elements.toastRegion) return;
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.dataset.type = type;
      toast.textContent = message;
      elements.toastRegion.appendChild(toast);
      setTimeout(() => {
        toast.classList.add("leaving");
        toast.remove();
      }, 3500);
    };

    const persistAdvancedState = () => {
      sessionStorage.setItem(STORAGE_KEYS.advancedOpen, String(state.advancedOpen));
    };

    const updateAdvancedVisibility = () => {
      if (!elements.advancedContent) return;
      if (state.advancedOpen) {
        elements.advancedContent.hidden = false;
        elements.advancedToggle.setAttribute("aria-expanded", "true");
        elements.advancedToggle.querySelector(".advanced-toggle-label").textContent = "Hide advanced";
      } else {
        elements.advancedContent.hidden = true;
        elements.advancedToggle.setAttribute("aria-expanded", "false");
        elements.advancedToggle.querySelector(".advanced-toggle-label").textContent = "Show advanced";
      }
    };

    const enableRange = (toggle, inputs, sliders, defaults) => {
      const isChecked = toggle.checked;
      inputs.forEach((input, index) => {
        input.disabled = !isChecked;
        if (isChecked && (input.value === "" || input.value == null)) {
          input.value = defaults[index];
        }
      });
      sliders.forEach((slider, index) => {
        slider.disabled = !isChecked;
        if (isChecked && (slider.value === "" || slider.value == null)) {
          slider.value = defaults[index];
        }
      });
    };

    const syncSliders = (minInput, maxInput, minSlider, maxSlider, minBound, maxBound) => {
      const minVal = clamp(Number(minInput.value), minBound, maxBound);
      const maxVal = clamp(Number(maxInput.value), minBound, maxBound);
      if (minVal > maxVal) {
        minInput.value = maxVal;
      }
      minSlider.value = minInput.value;
      maxSlider.value = maxInput.value;
    };

    const loadStoredTasks = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.tasks);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            state.tasks = parsed;
            return;
          }
        }
      } catch (error) {
        console.error("Failed to parse stored tasks", error);
      }
      state.tasks = createSampleTasks();
    };

    const refreshConflictMap = () => {
      state.conflictMap = computeConflictFlags(state.tasks);
    };

    const formatBadges = (task) => {
      const badges = [];
      if (task.requireDry) badges.push("Dry Only");
      if (task.temperatureEnabled) badges.push(`${task.minTemp}–${task.maxTemp} °F`);
      if (task.humidityEnabled) badges.push(`${task.minHumidity}–${task.maxHumidity} %`);
      if (task.earliestStart && task.latestStart) {
        badges.push(`Start ${task.earliestStart} – ${task.latestStart}`);
      } else if (task.earliestStart) {
        badges.push(`Start after ${task.earliestStart}`);
      } else if (task.latestStart) {
        badges.push(`Start before ${task.latestStart}`);
      }
      return badges
        .map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`)
        .join("");
    };

    const renderTaskList = () => {
      refreshConflictMap();
      const { taskList, taskListEmpty } = elements;
      taskList.innerHTML = "";
      if (!state.tasks.length) {
        taskListEmpty.hidden = false;
        return;
      }
      taskListEmpty.hidden = true;
      const fragment = document.createDocumentFragment();
      const sorted = [...state.tasks].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      sorted.forEach((task) => {
        const card = document.createElement("article");
        card.className = "task-card";
        card.dataset.taskId = task.id;
        const statusLabel = task.status || (task.scheduledWindow ? "Scheduled" : "Pending");
        const statusKey = statusLabel.toLowerCase();
        const metaParts = [];
        metaParts.push(
          `<span class="meta-item"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0-2a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a1 1 0 0 1 1 1v3h2a1 1 0 0 1 0 2h-3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"></path></svg>${durationFormatter(task.durationHours)}</span>`
        );
        if (task.scheduledWindow) {
          metaParts.push(
            `<span class="meta-item"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 0 1 2 0v1h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1ZM5 8a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5Zm3 3h2v2H8v-2Z"></path></svg>${formatRange(task.scheduledWindow.start, task.scheduledWindow.end)}</span>`
          );
        } else {
          metaParts.push(
            '<span class="meta-item"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2a7 7 0 0 1 7 7v3.59l1.7 1.7a1 1 0 0 1-1.32 1.497l-.094-.083L17 13.414V9a5 5 0 0 0-9.995-.217L7 9v4.414l-2.293 2.29a1 1 0 0 1-1.497-1.32l.083-.094L5 12.59V9a7 7 0 0 1 7-7Zm0 18a2 2 0 0 1 2 2H10a2 2 0 0 1 2-2Z"></path></svg>Awaiting schedule</span>'
          );
        }

        const conflictWindows = state.conflictMap.get(task.id) || [];
        const possibleContent = conflictWindows.length
          ? conflictWindows
              .map((window, index) => {
                const rowAttributes = [`data-window-index="${index}"`];
                if (window.conflict) rowAttributes.push('data-conflict="true"');
                if (window.preferred) rowAttributes.push('data-preferred="true"');
                return `<div class="window-row" ${rowAttributes.join(" ")}>
                  <div class="window-meta">
                    <span>${escapeHtml(formatRange(window.start, window.end))}</span>
                    <span>${escapeHtml(window.summary)}</span>
                  </div>
                  <div class="row-actions">
                    ${windowConditionIcon(window)}
                    <button type="button" class="text-button" data-action="schedule-window" data-window-index="${index}" aria-label="Schedule this window">Schedule this</button>
                  </div>
                </div>`;
              })
              .join("")
          : `<div class="task-card__empty">
                <p>No available windows in the next 10 days.</p>
                <div class="suggestion-buttons">
                  <button type="button" class="suggestion-button" data-action="apply-suggestion" data-suggestion="widen-temp">Widen temperature range</button>
                  <button type="button" class="suggestion-button" data-action="apply-suggestion" data-suggestion="allow-rain">Allow non-dry</button>
                </div>
              </div>`;

        if (!conflictWindows.length) {
          if (!state.noWindowLogged.has(task.id)) {
            analytics("no_windows_found", { taskId: task.id });
            state.noWindowLogged.add(task.id);
          }
        } else {
          state.noWindowLogged.delete(task.id);
        }

        const windowsCollapsed = task.windowsCollapsed ? "hidden" : "";
        card.innerHTML = `
          <div class="task-card__header">
            <div>
              <h3 class="task-card__title">${escapeHtml(task.name)}</h3>
              <span class="status-pill" data-status="${escapeHtml(statusKey)}">${escapeHtml(statusLabel)}</span>
            </div>
            <div class="task-card__actions">
              <button type="button" class="text-button" data-action="refresh-task">Refresh windows</button>
              <button type="button" class="text-button" data-action="edit-task">Edit</button>
              <button type="button" class="text-button" data-action="delete-task">Delete</button>
              <button type="button" class="text-button" data-action="toggle-complete">${task.status === "Completed" ? "Reopen" : "Mark Complete"}</button>
            </div>
          </div>
          <div class="task-card__meta">${metaParts.join("")}</div>
          <div class="badge-row">${formatBadges(task)}</div>
          <div class="possible-windows">
            <header>
              <h4>Possible Windows</h4>
              <button type="button" class="text-button" data-action="toggle-windows" aria-expanded="${!task.windowsCollapsed}">${task.windowsCollapsed ? "Show" : "Hide"} windows</button>
            </header>
            <div class="window-list" ${windowsCollapsed}>${possibleContent}</div>
          </div>
        `;
        fragment.appendChild(card);
      });
      taskList.appendChild(fragment);
    };
    const updateSubmitState = (errors) => {
      const hasBlocking = Object.values(errors).some((value) => value);
      elements.submitButton.disabled = hasBlocking;
    };

    const setFieldError = (field, message) => {
      const container = elements.formErrors[field];
      if (!container) return;
      container.textContent = message || "";
    };

    const validateValues = (values) => {
      const errors = {
        name: "",
        duration: "",
        zip: "",
        time: "",
        temperature: "",
        humidity: ""
      };
      const trimmedName = values.name.trim();
      if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 80) {
        errors.name = "Task Name must be 2–80 characters.";
      }

      if (Number.isNaN(values.duration) || values.duration < 0.25 || values.duration > 24) {
        errors.duration = "Duration must be between 0.25 and 24 hours.";
      }

      if (!/^\d{5}$/.test(values.zip)) {
        errors.zip = "Enter a 5-digit ZIP.";
      }

      if (values.earliest && values.latest) {
        const earliest = parseTimeToMinutes(values.earliest);
        const latest = parseTimeToMinutes(values.latest);
        if (earliest >= latest) {
          errors.time = "Set Earliest before Latest.";
        }
      }

      if (values.temperatureEnabled) {
        if (values.minTemp > values.maxTemp) {
          errors.temperature = "Temperature min must be less than max.";
        }
      }

      if (values.humidityEnabled) {
        if (values.minHumidity > values.maxHumidity) {
          errors.humidity = "Humidity min must be less than max.";
        }
      }

      return errors;
    };

    const displayErrors = (errors) => {
      Object.entries(errors).forEach(([field, message]) => {
        setFieldError(field, message);
      });
      updateSubmitState(errors);
    };

    const collectFormValues = () => {
      return {
        name: elements.nameInput.value || "",
        duration: Number.parseFloat(elements.durationInput.value),
        zip: elements.zipInput.value.trim(),
        earliest: elements.earliestInput.value || "",
        latest: elements.latestInput.value || "",
        temperatureEnabled: elements.temperatureToggle.checked,
        minTemp: Number(elements.tempMinInput.value || "0"),
        maxTemp: Number(elements.tempMaxInput.value || "0"),
        humidityEnabled: elements.humidityToggle.checked,
        minHumidity: Number(elements.humidityMinInput.value || "0"),
        maxHumidity: Number(elements.humidityMaxInput.value || "0"),
        requireDry: elements.noRainToggle.checked
      };
    };

    const resetForm = () => {
      state.editingTaskId = null;
      elements.form.reset();
      elements.durationInput.value = "1";
      elements.temperatureToggle.checked = false;
      elements.humidityToggle.checked = false;
      enableRange(
        elements.temperatureToggle,
        [elements.tempMinInput, elements.tempMaxInput],
        [elements.tempMinSlider, elements.tempMaxSlider],
        [60, 80]
      );
      enableRange(
        elements.humidityToggle,
        [elements.humidityMinInput, elements.humidityMaxInput],
        [elements.humidityMinSlider, elements.humidityMaxSlider],
        [20, 70]
      );
      elements.submitButton.textContent = "Save Task";
      elements.cancelEditButton.hidden = true;
      Object.keys(elements.formErrors).forEach((field) => setFieldError(field, ""));
      if (state.lastZip) {
        elements.zipInput.value = state.lastZip;
      }
    };

    const populateForm = (task) => {
      elements.nameInput.value = task.name;
      elements.durationInput.value = task.durationHours;
      elements.zipInput.value = task.location;
      elements.earliestInput.value = task.earliestStart || "";
      elements.latestInput.value = task.latestStart || "";
      elements.noRainToggle.checked = !!task.requireDry;
      elements.temperatureToggle.checked = !!task.temperatureEnabled;
      elements.humidityToggle.checked = !!task.humidityEnabled;
      enableRange(
        elements.temperatureToggle,
        [elements.tempMinInput, elements.tempMaxInput],
        [elements.tempMinSlider, elements.tempMaxSlider],
        [task.minTemp ?? 60, task.maxTemp ?? 80]
      );
      enableRange(
        elements.humidityToggle,
        [elements.humidityMinInput, elements.humidityMaxInput],
        [elements.humidityMinSlider, elements.humidityMaxSlider],
        [task.minHumidity ?? 20, task.maxHumidity ?? 70]
      );
      if (task.temperatureEnabled) {
        elements.tempMinInput.value = task.minTemp;
        elements.tempMaxInput.value = task.maxTemp;
        elements.tempMinSlider.value = task.minTemp;
        elements.tempMaxSlider.value = task.maxTemp;
      }
      if (task.humidityEnabled) {
        elements.humidityMinInput.value = task.minHumidity;
        elements.humidityMaxInput.value = task.maxHumidity;
        elements.humidityMinSlider.value = task.minHumidity;
        elements.humidityMaxSlider.value = task.maxHumidity;
      }
      elements.submitButton.textContent = "Update Task";
      elements.cancelEditButton.hidden = false;
    };

    const applySuggestion = (task, suggestion) => {
      if (suggestion === "widen-temp") {
        if (!task.temperatureEnabled) {
          task.temperatureEnabled = true;
          task.minTemp = 60;
          task.maxTemp = 80;
        } else {
          task.minTemp = Math.max(task.minTemp - 5, -20);
          task.maxTemp = Math.min(task.maxTemp + 5, 120);
        }
      }
      if (suggestion === "allow-rain") {
        task.requireDry = false;
      }
      analytics("suggestion_applied", { taskId: task.id, suggestion });
      const newWindows = generateWindowsForTask(task);
      task.windows = newWindows;
      if (newWindows.length) {
        task.scheduledWindow = { start: newWindows[0].start, end: newWindows[0].end };
        if (task.status !== "Completed") {
          task.status = "Scheduled";
        }
      } else {
        task.scheduledWindow = null;
        task.status = "Pending";
      }
      saveTasks();
      renderTaskList();
    };
    const createTaskFromValues = (values, existing = null) => {
      const id = existing?.id || `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const task = {
        id,
        name: values.name.trim(),
        durationHours: values.duration,
        location: values.zip,
        earliestStart: values.earliest || "",
        latestStart: values.latest || "",
        temperatureEnabled: values.temperatureEnabled,
        minTemp: values.temperatureEnabled ? values.minTemp : null,
        maxTemp: values.temperatureEnabled ? values.maxTemp : null,
        humidityEnabled: values.humidityEnabled,
        minHumidity: values.humidityEnabled ? values.minHumidity : null,
        maxHumidity: values.humidityEnabled ? values.maxHumidity : null,
        requireDry: values.requireDry,
        status: existing?.status || "Scheduled",
        createdAt: existing?.createdAt || new Date().toISOString(),
        windowsCollapsed: existing?.windowsCollapsed || false
      };
      const generated = generateWindowsForTask(task);
      task.windows = generated;
      if (generated.length) {
        task.scheduledWindow = existing?.scheduledWindow || {
          start: generated[0].start,
          end: generated[0].end
        };
        task.status = existing?.status || "Scheduled";
      } else {
        task.scheduledWindow = null;
        task.status = "Pending";
      }
      return task;
    };

    const handleFormSubmit = (event) => {
      event.preventDefault();
      const values = collectFormValues();
      const errors = validateValues(values);
      displayErrors(errors);
      const firstErrorKey = Object.entries(errors).find(([, value]) => value)?.[0];
      if (firstErrorKey) {
        analytics("task_submit_validation_error", { field: firstErrorKey });
        const focusTarget = {
          name: elements.nameInput,
          duration: elements.durationInput,
          zip: elements.zipInput,
          time: elements.earliestInput,
          temperature: elements.tempMinInput,
          humidity: elements.humidityMinInput
        }[firstErrorKey];
        if (focusTarget) focusTarget.focus();
        return;
      }

      const existingTask = state.tasks.find((task) => task.id === state.editingTaskId) || null;
      const newTask = createTaskFromValues(values, existingTask);
      if (existingTask) {
        state.tasks = state.tasks.map((task) => (task.id === existingTask.id ? newTask : task));
      } else {
        state.tasks = [newTask, ...state.tasks];
      }
      state.lastZip = values.zip;
      localStorage.setItem(STORAGE_KEYS.lastZip, state.lastZip);
      saveTasks();
      renderTaskList();
      analytics("task_submit_success", { taskId: newTask.id, edited: Boolean(existingTask) });
      showToast("Task added. Finding best weather windows.");
      if (state.layoutMode === "mobile") {
        closeModal();
      }
      resetForm();
      elements.nameInput.focus();
    };

    const openModal = (source = "button") => {
      analytics("task_form_opened", { source });
      if (state.layoutMode === "mobile") {
        state.modalOpen = true;
        elements.addPanel.classList.add("is-modal", "is-open");
        elements.modalOverlay.hidden = false;
        state.previousFocus = document.activeElement;
        const focusable = elements.addPanel.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const trap = (event) => {
          if (event.key !== "Tab") return;
          if (focusable.length === 0) return;
          if (event.shiftKey) {
            if (document.activeElement === first) {
              event.preventDefault();
              last.focus();
            }
          } else if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        };
        state.trapHandler = trap;
        elements.addPanel.addEventListener("keydown", trap);
        document.body.style.overflow = "hidden";
        if (first) first.focus();
      } else if (state.layoutMode === "tablet") {
        setTabletCollapsed(false);
        elements.nameInput.focus();
      } else {
        elements.nameInput.focus();
      }
    };


    const closeModal = ({ restoreFocus = true } = {}) => {
      if (state.trapHandler) {
        elements.addPanel.removeEventListener("keydown", state.trapHandler);
        state.trapHandler = null;
      }
      if (state.layoutMode === "mobile") {
        elements.addPanel.classList.add("is-modal");
      }
      elements.addPanel.classList.remove("is-open");
      elements.modalOverlay.hidden = true;
      document.body.style.overflow = "";
      if (restoreFocus && state.previousFocus && typeof state.previousFocus.focus === "function") {
        state.previousFocus.focus();
      }
      state.previousFocus = null;
      state.modalOpen = false;

    };

    const setTabletCollapsed = (collapsed) => {
      state.addCollapsed = collapsed;
      if (collapsed) {
        elements.addPanel.classList.add("is-collapsed");
        elements.tabletToggle.setAttribute("aria-expanded", "false");
        elements.tabletToggle.querySelector(".tablet-toggle-label").textContent = "Expand";
      } else {
        elements.addPanel.classList.remove("is-collapsed");
        elements.tabletToggle.setAttribute("aria-expanded", "true");
        elements.tabletToggle.querySelector(".tablet-toggle-label").textContent = "Collapse";
      }
    };

    const applyLayoutMode = () => {
      const width = window.innerWidth;
      let nextMode = "desktop";
      if (width < 768) {
        nextMode = "mobile";
      } else if (width >= 768 && width < 1024) {
        nextMode = "tablet";
      }
      if (nextMode === state.layoutMode) return;
      state.layoutMode = nextMode;
      const main = document.getElementById("appMain");
      if (nextMode === "desktop") {
        if (main.firstElementChild !== elements.addPanel) {
          main.insertBefore(elements.addPanel, elements.taskListPanel);
        }

        closeModal({ restoreFocus: false });

        elements.addPanel.classList.remove("is-modal", "is-open");
        elements.modalOverlay.hidden = true;
        setTabletCollapsed(false);
      } else if (nextMode === "tablet") {
        if (main.firstElementChild === elements.addPanel) {
          main.insertBefore(elements.taskListPanel, elements.addPanel);
        }

        closeModal({ restoreFocus: false });

        elements.addPanel.classList.remove("is-modal", "is-open");
        elements.modalOverlay.hidden = true;
        setTabletCollapsed(false);
      } else {
        if (main.firstElementChild === elements.addPanel) {
          main.insertBefore(elements.taskListPanel, elements.addPanel);
        }
        elements.addPanel.classList.add("is-modal");

        closeModal({ restoreFocus: false });

      }
    };

    const refreshTaskWindows = (task, scope = "single", button = null) => {
      if (button) {
        button.classList.add("refreshing");
        button.disabled = true;
      }
      setTimeout(() => {
        const refreshed = generateWindowsForTask(task);
        task.windows = refreshed;
        if (refreshed.length) {
          task.scheduledWindow = { start: refreshed[0].start, end: refreshed[0].end };
          if (task.status !== "Completed") {
            task.status = "Scheduled";
          }
        } else {
          task.scheduledWindow = null;
          task.status = "Pending";
        }
        analytics("windows_refreshed", { taskId: task.id, scope });
        saveTasks();
        renderTaskList();
        if (button) {
          button.classList.remove("refreshing");
          button.disabled = false;
        }
      }, 600);
    };
    loadStoredTasks();
    applyLayoutMode();
    updateAdvancedVisibility();
    resetForm();
    renderTaskList();

    if (!state.lastZip && navigator.geolocation) {
      elements.zipInput.placeholder = "Detecting location…";
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const approxZip = nearestZip(position.coords.latitude, position.coords.longitude);
          if (approxZip) {
            elements.zipInput.value = approxZip;
            state.lastZip = approxZip;
            localStorage.setItem(STORAGE_KEYS.lastZip, approxZip);
          } else {
            elements.zipInput.placeholder = "Enter 5-digit ZIP";
          }
        },
        () => {
          elements.zipInput.placeholder = "Enter 5-digit ZIP";
        },
        { enableHighAccuracy: false, timeout: 4000 }
      );
    } else if (state.lastZip) {
      elements.zipInput.value = state.lastZip;
    }

    window.addEventListener("resize", () => applyLayoutMode());

    elements.tabletToggle.addEventListener("click", () => {
      setTabletCollapsed(!state.addCollapsed);
    });

    elements.floatingButton.addEventListener("click", () => {
      openModal("floating_button");
    });

    elements.modalCloseButton.addEventListener("click", () => {
      closeModal();
    });

    elements.modalOverlay.addEventListener("click", () => {
      closeModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.layoutMode === "mobile" && state.modalOpen) {
        closeModal();
      }
    });

    elements.advancedToggle.addEventListener("click", () => {
      state.advancedOpen = !state.advancedOpen;
      persistAdvancedState();
      updateAdvancedVisibility();
    });

    elements.temperatureToggle.addEventListener("change", () => {
      enableRange(
        elements.temperatureToggle,
        [elements.tempMinInput, elements.tempMaxInput],
        [elements.tempMinSlider, elements.tempMaxSlider],
        [60, 80]
      );
      displayErrors(validateValues(collectFormValues()));
    });

    elements.humidityToggle.addEventListener("change", () => {
      enableRange(
        elements.humidityToggle,
        [elements.humidityMinInput, elements.humidityMaxInput],
        [elements.humidityMinSlider, elements.humidityMaxSlider],
        [20, 70]
      );
      displayErrors(validateValues(collectFormValues()));
    });

    const bindRangeSync = (minInput, maxInput, minSlider, maxSlider, minBound, maxBound) => {
      minSlider.addEventListener("input", () => {
        const minVal = Number(minSlider.value);
        if (minVal > Number(maxSlider.value)) {
          maxSlider.value = minVal;
        }
        minInput.value = minSlider.value;
        maxInput.value = maxSlider.value;
        displayErrors(validateValues(collectFormValues()));
      });
      maxSlider.addEventListener("input", () => {
        const maxVal = Number(maxSlider.value);
        if (maxVal < Number(minSlider.value)) {
          minSlider.value = maxVal;
        }
        minInput.value = minSlider.value;
        maxInput.value = maxSlider.value;
        displayErrors(validateValues(collectFormValues()));
      });
      [minInput, maxInput].forEach((input) => {
        input.addEventListener("input", () => {
          input.value = input.value.replace(/[^0-9-]/g, "");
          syncSliders(minInput, maxInput, minSlider, maxSlider, minBound, maxBound);
          displayErrors(validateValues(collectFormValues()));
        });
      });
    };

    bindRangeSync(
      elements.tempMinInput,
      elements.tempMaxInput,
      elements.tempMinSlider,
      elements.tempMaxSlider,
      -20,
      120
    );
    bindRangeSync(
      elements.humidityMinInput,
      elements.humidityMaxInput,
      elements.humidityMinSlider,
      elements.humidityMaxSlider,
      0,
      100
    );

    elements.durationSteppers.forEach((button) => {
      button.addEventListener("click", () => {
        const current = Number(elements.durationInput.value) || 0;
        const step = Number(button.dataset.step);
        let next = Math.round((current + step) * 4) / 4;
        next = Math.min(Math.max(next, 0.25), 24);
        elements.durationInput.value = next.toFixed(2).replace(/\.00$/, "").replace(/\.25$/, ".25").replace(/\.5$/, ".5");
        displayErrors(validateValues(collectFormValues()));
      });
    });

    elements.durationInput.addEventListener("input", () => {
      elements.durationInput.value = elements.durationInput.value.replace(/[^0-9.]/g, "");
      displayErrors(validateValues(collectFormValues()));
    });

    elements.zipInput.addEventListener("input", () => {
      elements.zipInput.value = elements.zipInput.value.replace(/\D/g, "").slice(0, 5);
      displayErrors(validateValues(collectFormValues()));
    });

    [elements.nameInput, elements.earliestInput, elements.latestInput].forEach((input) => {
      input.addEventListener("input", () => {
        displayErrors(validateValues(collectFormValues()));
      });
    });

    elements.noRainToggle.addEventListener("change", () => {
      displayErrors(validateValues(collectFormValues()));
    });

    elements.presetChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const preset = chip.dataset.preset;
        analytics("preset_used", { preset });
        state.advancedOpen = true;
        updateAdvancedVisibility();
        persistAdvancedState();
        if (preset === "warm") {
          elements.temperatureToggle.checked = true;
          enableRange(
            elements.temperatureToggle,
            [elements.tempMinInput, elements.tempMaxInput],
            [elements.tempMinSlider, elements.tempMaxSlider],
            [70, 85]
          );
          elements.tempMinInput.value = 70;
          elements.tempMaxInput.value = 85;
          elements.tempMinSlider.value = 70;
          elements.tempMaxSlider.value = 85;
        }
        if (preset === "cool") {
          elements.temperatureToggle.checked = true;
          enableRange(
            elements.temperatureToggle,
            [elements.tempMinInput, elements.tempMaxInput],
            [elements.tempMinSlider, elements.tempMaxSlider],
            [50, 65]
          );
          elements.tempMinInput.value = 50;
          elements.tempMaxInput.value = 65;
          elements.tempMinSlider.value = 50;
          elements.tempMaxSlider.value = 65;
        }
        if (preset === "dry") {
          elements.noRainToggle.checked = true;
        }
        displayErrors(validateValues(collectFormValues()));
      });
    });

    elements.cancelEditButton.addEventListener("click", () => {
      resetForm();
      if (state.layoutMode === "mobile") {
        closeModal();
      }
    });

    elements.form.addEventListener("submit", handleFormSubmit);

    elements.taskList.addEventListener("click", (event) => {
      const targetButton = event.target.closest("button[data-action]");
      if (!targetButton) return;
      const card = targetButton.closest(".task-card");
      if (!card) return;
      const taskId = card.dataset.taskId;
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) return;

      const action = targetButton.dataset.action;
      if (action === "edit-task") {
        state.editingTaskId = task.id;
        populateForm(task);
        if (state.layoutMode === "mobile") {
          openModal("edit");
        } else if (state.layoutMode === "tablet" && state.addCollapsed) {
          setTabletCollapsed(false);
        }
        elements.nameInput.focus();
      }

      if (action === "delete-task") {
        state.tasks = state.tasks.filter((item) => item.id !== task.id);
        if (state.editingTaskId === task.id) {
          resetForm();
        }
        saveTasks();
        renderTaskList();
      }

      if (action === "toggle-complete") {
        if (task.status === "Completed") {
          task.status = task.scheduledWindow ? "Scheduled" : "Pending";
        } else {
          task.status = "Completed";
        }
        saveTasks();
        renderTaskList();
      }

      if (action === "refresh-task") {
        refreshTaskWindows(task, "single", targetButton);
      }

      if (action === "schedule-window") {
        const index = Number(targetButton.dataset.windowIndex);
        const windows = state.conflictMap.get(task.id) || [];
        const selected = windows[index];
        if (selected) {
          task.scheduledWindow = { start: selected.start, end: selected.end };
          task.status = "Scheduled";
          analytics("task_rescheduled_via_alt_window", { taskId: task.id });
          saveTasks();
          renderTaskList();
        }
      }

      if (action === "toggle-windows") {
        task.windowsCollapsed = !task.windowsCollapsed;
        saveTasks();
        renderTaskList();
      }

      if (action === "apply-suggestion") {
        const suggestion = targetButton.dataset.suggestion;
        applySuggestion(task, suggestion);
      }
    });

    elements.refreshAllButton.addEventListener("click", () => {
      const button = elements.refreshAllButton;
      button.classList.add("refreshing");
      button.disabled = true;
      state.tasks.forEach((task) => {
        refreshTaskWindows(task, "all");
      });
      setTimeout(() => {
        button.classList.remove("refreshing");
        button.disabled = false;
      }, 900);
    });
  });
})();
