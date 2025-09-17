document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('taskForm');
    const formTitle = document.getElementById('formTitle');
    const submitButton = document.getElementById('submitButton');
    const cancelEditButton = document.getElementById('cancelEditButton');
    const taskList = document.getElementById('taskList');
    const useTemperature = document.getElementById('useTemperature');
    const useHumidity = document.getElementById('useHumidity');
    const temperatureInputs = document.getElementById('temperatureInputs');
    const humidityInputs = document.getElementById('humidityInputs');

    let editingTaskId = null;
    const taskCache = new Map();

    const toggleGroupState = (checkbox, group) => {
        group.classList.toggle('opacity-50', !checkbox.checked);
        group.classList.toggle('pointer-events-none', !checkbox.checked);
    };

    const resetToggleGroups = () => {
        toggleGroupState(useTemperature, temperatureInputs);
        toggleGroupState(useHumidity, humidityInputs);
    };

    useTemperature.addEventListener('change', () => toggleGroupState(useTemperature, temperatureInputs));
    useHumidity.addEventListener('change', () => toggleGroupState(useHumidity, humidityInputs));

    const buildTemperatureDisplay = (task) => {
        const hasMin = task.min_temp !== undefined && task.min_temp !== null;
        const hasMax = task.max_temp !== undefined && task.max_temp !== null;
        if (!hasMin && !hasMax) {
            return 'Temperature: None<br>';
        }
        let text = 'Temperature: ';
        if (hasMin) {
            text += `${Math.round(task.min_temp)}&deg;F`;
        }
        if (hasMax) {
            text += `${hasMin ? ' - ' : ''}${Math.round(task.max_temp)}&deg;F`;
        }
        return `${text}<br>`;
    };

    const buildHumidityDisplay = (task) => {
        const hasMin = task.min_humidity !== undefined && task.min_humidity !== null;
        const hasMax = task.max_humidity !== undefined && task.max_humidity !== null;
        if (!hasMin && !hasMax) {
            return 'Humidity: None<br>';
        }
        let text = 'Humidity: ';
        if (hasMin) {
            text += `${task.min_humidity}%`;
        }
        if (hasMax) {
            text += `${hasMin ? ' - ' : ''}${task.max_humidity}%`;
        }
        return `${text}<br>`;
    };

    const normaliseTime = (value) => {
        if (!value) {
            return '';
        }
        return value.length >= 5 ? value.slice(0, 5) : value;
    };

    const defaultDateFormatter = new Intl.DateTimeFormat([], {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    const parseIsoDate = (value) => {
        if (!value) {
            return null;
        }
        const trimmed = typeof value === 'string' ? value.trim() : '';
        if (!trimmed) {
            return null;
        }
        const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed);
        const isoString = hasTimezone ? trimmed : `${trimmed}Z`;
        const date = new Date(isoString);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    const looksLikeIanaZone = (value) => {
        if (typeof value !== 'string') {
            return false;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return false;
        }
        if (trimmed.toUpperCase() === 'UTC' || trimmed.toUpperCase() === 'GMT') {
            return true;
        }
        return trimmed.includes('/') && /^[A-Za-z0-9_+\-]+\/[A-Za-z0-9_+\-]+$/.test(trimmed);
    };

    const parseUtcOffsetString = (value) => {
        if (typeof value !== 'string') {
            return null;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const sanitized = trimmed.replace(/\s+/g, '');
        const upper = sanitized.toUpperCase();
        if (upper === 'UTC' || upper === 'GMT' || upper === 'Z') {
            return 0;
        }
        let match = upper.match(/^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$/);
        if (!match) {
            match = upper.match(/^([+-])(\d{2})(\d{2})$/);
        }
        if (!match) {
            return null;
        }
        const sign = match[1] === '-' ? -1 : 1;
        const hours = parseInt(match[2], 10);
        const minutes = match[3] ? parseInt(match[3], 10) : 0;
        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
            return null;
        }
        if (hours > 14 || minutes > 59) {
            return null;
        }
        return sign * (hours * 60 + minutes);
    };

    const normalizeNumericOffset = (value) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return null;
        }
        const abs = Math.abs(value);
        if (abs <= 14 * 60) {
            return Math.round(value);
        }
        if (abs <= 14 * 3600) {
            return Math.round(value / 60);
        }
        if (abs <= 14 * 3600 * 1000) {
            return Math.round(value / (60 * 1000));
        }
        return null;
    };

    const formatOffsetLabel = (minutes) => {
        if (!Number.isFinite(minutes)) {
            return '';
        }
        if (minutes === 0) {
            return 'UTC';
        }
        const sign = minutes > 0 ? '+' : '-';
        const absolute = Math.abs(minutes);
        const hours = Math.floor(absolute / 60);
        const mins = absolute % 60;
        return `UTC${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const extractLabelFromObject = (obj) => {
        if (!obj || typeof obj !== 'object') {
            return undefined;
        }
        const labelKeys = [
            'label',
            'abbr',
            'abbreviation',
            'short',
            'short_name',
            'zoneLabel',
            'timezone_label',
            'offset_label',
        ];
        for (const key of labelKeys) {
            const value = obj[key];
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        return undefined;
    };

    const normalizeOffsetLabel = (label, offsetMinutes) => {
        if (typeof label !== 'string') {
            return null;
        }
        const trimmed = label.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = parseUtcOffsetString(trimmed);
        if (parsed === null) {
            return null;
        }
        return formatOffsetLabel(offsetMinutes);
    };

    const determineOffsetLabel = (labelHint, rawValue, offsetMinutes) => {
        const fromHint = normalizeOffsetLabel(labelHint, offsetMinutes);
        if (fromHint) {
            return fromHint;
        }
        if (typeof rawValue === 'string') {
            const fromRawString = normalizeOffsetLabel(rawValue, offsetMinutes);
            if (fromRawString) {
                return fromRawString;
            }
        } else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
            const minutes = normalizeNumericOffset(rawValue);
            if (minutes !== null) {
                return formatOffsetLabel(minutes);
            }
        }
        return formatOffsetLabel(offsetMinutes);
    };

    const parseTimezoneMetadata = (value, labelHint, depth = 0) => {
        if (value === null || value === undefined) {
            return null;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) {
                return null;
            }
            if (looksLikeIanaZone(trimmed)) {
                const label = typeof labelHint === 'string' && labelHint.trim()
                    ? labelHint.trim()
                    : trimmed;
                return { type: 'iana', zone: trimmed, label };
            }
            const offsetMinutes = parseUtcOffsetString(trimmed);
            if (offsetMinutes !== null) {
                return {
                    type: 'offset',
                    offsetMinutes,
                    label: determineOffsetLabel(labelHint, trimmed, offsetMinutes),
                };
            }
            return null;
        }
        if (typeof value === 'number') {
            const offsetMinutes = normalizeNumericOffset(value);
            if (offsetMinutes !== null) {
                return {
                    type: 'offset',
                    offsetMinutes,
                    label: determineOffsetLabel(labelHint, value, offsetMinutes),
                };
            }
            return null;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                const parsed = parseTimezoneMetadata(item, labelHint, depth + 1);
                if (parsed) {
                    return parsed;
                }
            }
            return null;
        }
        if (typeof value !== 'object' || depth > 4) {
            return null;
        }
        const nestedLabelHint = typeof labelHint === 'string' && labelHint.trim()
            ? labelHint.trim()
            : extractLabelFromObject(value);
        const zoneKeys = [
            'timeZone',
            'timezone',
            'time_zone',
            'zone',
            'name',
            'iana',
            'olson',
            'tz',
            'tzid',
            'identifier',
            'primary',
            'value',
        ];
        for (const key of zoneKeys) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const parsed = parseTimezoneMetadata(value[key], nestedLabelHint, depth + 1);
                if (parsed) {
                    if (parsed.type === 'iana') {
                        if (!parsed.label || parseUtcOffsetString(parsed.label)) {
                            parsed.label = nestedLabelHint && !parseUtcOffsetString(nestedLabelHint)
                                ? nestedLabelHint
                                : parsed.zone;
                        }
                    }
                    return parsed;
                }
            }
        }
        const offsetKeys = [
            'utc_offset',
            'offset',
            'offset_minutes',
            'offsetMinutes',
            'raw_offset',
            'gmt_offset',
            'offset_min',
            'offsetMin',
            'offset_hours',
            'offsetHours',
            'minutes',
        ];
        for (const key of offsetKeys) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const parsed = parseTimezoneMetadata(value[key], nestedLabelHint, depth + 1);
                if (parsed && parsed.type === 'offset') {
                    const offsetLabelHint = value.offset_label ?? nestedLabelHint;
                    parsed.label = determineOffsetLabel(offsetLabelHint, value[key], parsed.offsetMinutes);
                    return parsed;
                }
            }
        }
        const nestedKeys = ['metadata', 'info', 'details', 'data', 'values', 'tzinfo', 'extra'];
        for (const key of nestedKeys) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const parsed = parseTimezoneMetadata(value[key], nestedLabelHint, depth + 1);
                if (parsed) {
                    return parsed;
                }
            }
        }
        return null;
    };

    const extractForecastTimezoneInfo = (metadata) => {
        if (!metadata) {
            return null;
        }
        const labelHint = typeof metadata.label === 'string' && metadata.label.trim()
            ? metadata.label.trim()
            : undefined;
        const candidateSources = [];
        if (metadata.raw !== undefined && metadata.raw !== null) {
            candidateSources.push(metadata.raw);
        }
        if (metadata.primary !== undefined && metadata.primary !== null) {
            candidateSources.push(metadata.primary);
        }
        if (metadata.extra !== undefined && metadata.extra !== null) {
            candidateSources.push(metadata.extra);
        }
        if (metadata.offset !== undefined && metadata.offset !== null) {
            candidateSources.push(metadata.offset);
        }
        let bestIana = null;
        let bestOffset = null;
        for (const candidate of candidateSources) {
            const info = parseTimezoneMetadata(candidate, labelHint);
            if (!info) {
                continue;
            }
            if (info.type === 'iana' && !bestIana) {
                bestIana = info;
            } else if (info.type === 'offset' && !bestOffset) {
                bestOffset = info;
            }
            if (bestIana && bestOffset) {
                break;
            }
        }
        if (!bestIana && !bestOffset && labelHint) {
            const parsed = parseTimezoneMetadata(labelHint, labelHint);
            if (parsed) {
                if (parsed.type === 'iana') {
                    bestIana = parsed;
                } else if (parsed.type === 'offset') {
                    bestOffset = parsed;
                }
            }
        }
        if (bestIana) {
            if (!bestIana.label || parseUtcOffsetString(bestIana.label)) {
                bestIana.label = labelHint && !parseUtcOffsetString(labelHint)
                    ? labelHint
                    : bestIana.zone;
            }
            return bestIana;
        }
        if (bestOffset) {
            const label = determineOffsetLabel(labelHint, metadata.offset, bestOffset.offsetMinutes);
            bestOffset.label = label;
            return bestOffset;
        }
        return null;
    };

    const getForecastTimezoneMetadata = (task) => {
        if (!task || typeof task !== 'object') {
            return undefined;
        }
        const zoneCandidates = [
            task.forecast_timezone,
            task.forecast_timezone_name,
            task.forecast_timezone_iana,
            task.forecast_timezone_id,
            task.forecast_timezone_zone,
            task.forecast_timezone_code,
            task.scheduled_time_timezone,
            task.scheduled_timezone,
            task.scheduled_time_zone,
        ];
        let primary = zoneCandidates.find((value) => value !== undefined && value !== null) ?? null;
        const labelCandidates = [
            task.forecast_timezone_label,
            task.forecast_timezone_abbr,
            task.forecast_timezone_abbreviation,
            task.forecast_timezone_short,
            task.forecast_timezone_display,
            task.scheduled_time_timezone_label,
            task.scheduled_timezone_label,
        ];
        const label = labelCandidates.find((value) => typeof value === 'string' && value.trim())?.trim();
        const offsetCandidates = [
            task.forecast_utc_offset,
            task.forecast_timezone_offset,
            task.forecast_timezone_offset_minutes,
            task.forecast_timezone_offset_seconds,
            task.forecast_timezone_offset_hours,
            task.scheduled_time_utc_offset,
        ];
        const offset = offsetCandidates.find((value) => value !== undefined && value !== null);
        const extraCandidates = [
            task.forecast_timezone_metadata,
            task.forecast_timezone_info,
            task.forecast_timezone_details,
            task.forecast_timezone_data,
            task.forecast_timezone_meta,
            task.forecast_timezone_extra,
            task.scheduled_time_timezone_metadata,
        ];
        const extra = extraCandidates.find((value) => value !== undefined && value !== null) ?? null;
        let raw = typeof task.forecast_timezone === 'object' && task.forecast_timezone !== null
            ? task.forecast_timezone
            : null;
        if (!raw && extra && typeof extra === 'object' && !Array.isArray(extra)) {
            raw = extra;
        }
        if (primary && typeof primary === 'object') {
            raw = primary;
            primary = null;
        }
        if (!primary && typeof raw === 'string') {
            primary = raw;
        }
        if (!primary && typeof extra === 'object' && extra && typeof extra.timezone === 'string') {
            primary = extra.timezone;
        }
        if (!primary && typeof task.forecast_timezone === 'string') {
            primary = task.forecast_timezone;
        }
        if (!raw && primary && typeof primary === 'object') {
            raw = primary;
            primary = null;
        }
        if (!raw && typeof task.scheduled_timezone === 'object' && task.scheduled_timezone !== null) {
            raw = task.scheduled_timezone;
        }
        if (!raw && typeof task.scheduled_time_timezone === 'object' && task.scheduled_time_timezone !== null) {
            raw = task.scheduled_time_timezone;
        }
        if (!raw && extra && typeof extra === 'object') {
            const labelFromExtra = extractLabelFromObject(extra);
            if (!primary && typeof extra.time_zone === 'string') {
                primary = extra.time_zone;
            }
            if (!raw) {
                raw = extra;
            }
            if (!primary && typeof extra.zone === 'string') {
                primary = extra.zone;
            }
            if (!primary && typeof extra.timeZone === 'string') {
                primary = extra.timeZone;
            }
            if (!primary && typeof extra.name === 'string' && looksLikeIanaZone(extra.name)) {
                primary = extra.name;
            }
            if (!primary && typeof extra.iana === 'string') {
                primary = extra.iana;
            }
            if (!primary && typeof extra.olson === 'string') {
                primary = extra.olson;
            }
            if (!primary && typeof extra.tz === 'string') {
                primary = extra.tz;
            }
            if (!primary && typeof extra.tzid === 'string') {
                primary = extra.tzid;
            }
            if (!primary && typeof extra.identifier === 'string') {
                primary = extra.identifier;
            }
            if (!primary && typeof extra.value === 'string') {
                primary = extra.value;
            }
            if (!primary && labelFromExtra && looksLikeIanaZone(labelFromExtra)) {
                primary = labelFromExtra;
            }
        }
        const hasInfo = Boolean(
            (typeof primary === 'string' && primary.trim())
            || (primary && typeof primary === 'object')
            || raw
            || extra
            || offset !== undefined
        );
        if (!hasInfo) {
            return undefined;
        }
        const metadata = {
            primary,
            label: label ?? (raw ? extractLabelFromObject(raw) : undefined),
            offset,
            raw,
            extra,
        };
        if (!metadata.label && raw) {
            metadata.label = extractLabelFromObject(raw);
        }
        return metadata;
    };

    const formatDateTime = (value, timezoneMetadata) => {
        const date = parseIsoDate(value);
        if (!date) {
            return '';
        }
        const timezoneInfo = extractForecastTimezoneInfo(timezoneMetadata);
        if (!timezoneInfo) {
            return defaultDateFormatter.format(date);
        }
        if (timezoneInfo.type === 'iana') {
            try {
                const formatter = new Intl.DateTimeFormat([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: timezoneInfo.zone,
                });
                const formatted = formatter.format(date);
                const label = timezoneInfo.label && !parseUtcOffsetString(timezoneInfo.label)
                    ? timezoneInfo.label
                    : timezoneInfo.zone;
                return label ? `${formatted} ${label}` : formatted;
            } catch (error) {
                console.warn('Failed to format using time zone', timezoneInfo.zone, error);
                return defaultDateFormatter.format(date);
            }
        }
        if (timezoneInfo.type === 'offset') {
            const shifted = new Date(date.getTime() + timezoneInfo.offsetMinutes * 60 * 1000);
            const formatted = defaultDateFormatter.format(shifted);
            const label = timezoneInfo.label || formatOffsetLabel(timezoneInfo.offsetMinutes);
            return label ? `${formatted} ${label}` : formatted;
        }
        return defaultDateFormatter.format(date);
    };

    const resetForm = () => {
        taskForm.reset();
        editingTaskId = null;
        formTitle.textContent = 'Add New Task';
        submitButton.textContent = 'Add Task';
        cancelEditButton.classList.add('hidden');
        resetToggleGroups();
    };

    const enterEditMode = (task) => {
        editingTaskId = task.id;
        formTitle.textContent = 'Edit Task';
        submitButton.textContent = 'Update Task';
        cancelEditButton.classList.remove('hidden');

        document.getElementById('taskName').value = task.name;
        document.getElementById('location').value = task.location;
        document.getElementById('durationHours').value = task.duration_hours;
        document.getElementById('noRain').checked = Boolean(task.no_rain);
        document.getElementById('earliestStart').value = normaliseTime(task.earliest_start);
        document.getElementById('latestStart').value = normaliseTime(task.latest_start);

        const hasTempRange = task.min_temp !== null || task.max_temp !== null;
        useTemperature.checked = hasTempRange;
        toggleGroupState(useTemperature, temperatureInputs);
        document.getElementById('minTemp').value = task.min_temp ?? '';
        document.getElementById('maxTemp').value = task.max_temp ?? '';

        const hasHumidityRange = task.min_humidity !== null || task.max_humidity !== null;
        useHumidity.checked = hasHumidityRange;
        toggleGroupState(useHumidity, humidityInputs);
        document.getElementById('minHumidity').value = task.min_humidity ?? '';
        document.getElementById('maxHumidity').value = task.max_humidity ?? '';
    };

    cancelEditButton.addEventListener('click', () => {
        resetForm();
    });

    async function loadTasks() {
        try {
            const response = await fetch('/tasks/');
            if (!response.ok) {
                throw new Error('Failed to load tasks');
            }
            const tasks = await response.json();
            taskCache.clear();
            taskList.innerHTML = '';
            tasks.forEach((task) => {
                taskCache.set(task.id, task);
                taskList.appendChild(createTaskElement(task));
            });
        } catch (error) {
            console.error('Error loading tasks:', error);
            taskCache.clear();
            taskList.innerHTML = '<p class="text-sm text-red-600">Unable to load tasks.</p>';
        }
    }

    function createTaskElement(task) {
        const div = document.createElement('div');
        div.className = 'task-item bg-gray-50 p-4 rounded-md border border-gray-200';

        const timezoneMetadata = getForecastTimezoneMetadata(task);
        const createdAt = task.created_at
            ? formatDateTime(task.created_at) || 'Unknown'
            : 'Unknown';
        const scheduledTimeDisplay = task.scheduled_time
            ? formatDateTime(task.scheduled_time, timezoneMetadata) || 'Not scheduled'
            : 'Not scheduled';

        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-medium">${task.name}</h3>
                    <p class="text-sm text-gray-600">
                        ZIP Code: ${task.location}<br>
                        Duration: ${task.duration_hours} hours<br>
                        ${buildTemperatureDisplay(task)}
                        ${buildHumidityDisplay(task)}
                        No Rain Required: ${task.no_rain ? 'Yes' : 'No'}<br>
                        Scheduled Time: ${scheduledTimeDisplay}<br>
                        Created: ${createdAt}
                    </p>
                    <div class="flex space-x-3">
                        <button class="text-blue-600 hover:underline" data-action="find" data-task-id="${task.id}">
                            Find Windows
                        </button>
                        <button class="text-blue-600 hover:underline" data-action="edit" data-task-id="${task.id}">
                            Edit
                        </button>
                        <button data-action="delete" data-task-id="${task.id}" class="text-red-600 hover:text-red-800">
                            Delete
                        </button>
                    </div>
                    <div id="windows-${task.id}" class="mt-2 text-sm text-gray-700"></div>
                </div>
            </div>
        `;

        return div;
    }

    const buildTaskPayload = () => {
        const payload = {
            name: document.getElementById('taskName').value,
            location: document.getElementById('location').value,
            duration_hours: parseInt(document.getElementById('durationHours').value, 10),
            no_rain: document.getElementById('noRain').checked,
            earliest_start: document.getElementById('earliestStart').value || null,
            latest_start: document.getElementById('latestStart').value || null,
        };

        if (useTemperature.checked) {
            const minTemp = document.getElementById('minTemp').value;
            const maxTemp = document.getElementById('maxTemp').value;
            if (minTemp !== '') {
                payload.min_temp = parseFloat(minTemp);
            }
            if (maxTemp !== '') {
                payload.max_temp = parseFloat(maxTemp);
            }
        } else {
            payload.min_temp = null;
            payload.max_temp = null;
        }

        if (useHumidity.checked) {
            const minHumidity = document.getElementById('minHumidity').value;
            const maxHumidity = document.getElementById('maxHumidity').value;
            if (minHumidity !== '') {
                payload.min_humidity = parseInt(minHumidity, 10);
            }
            if (maxHumidity !== '') {
                payload.max_humidity = parseInt(maxHumidity, 10);
            }
        } else {
            payload.min_humidity = null;
            payload.max_humidity = null;
        }

        return payload;
    };

    taskForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = buildTaskPayload();
        const url = editingTaskId ? `/tasks/${editingTaskId}` : '/tasks/';
        const method = editingTaskId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                resetForm();
                await loadTasks();
            } else {
                const error = await response.json();
                alert(`Error saving task: ${error.detail || 'Unknown error'}`);
            }
        } catch (err) {
            alert('Network or server error while saving task.');
        }
    });

    taskList.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        const taskId = target.dataset.taskId;
        if (!taskId) {
            return;
        }
        const numericId = parseInt(taskId, 10);
        if (target.dataset.action === 'delete') {
            await handleDeleteTask(numericId);
        } else if (target.dataset.action === 'find') {
            await handleFindWindows(numericId);
        } else if (target.dataset.action === 'edit') {
            const task = taskCache.get(numericId);
            if (task) {
                enterEditMode(task);
            }
        }
    });

    async function handleDeleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) {
            return;
        }
        try {
            const response = await fetch(`/tasks/${taskId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                if (editingTaskId === taskId) {
                    resetForm();
                }
                await loadTasks();
            } else {
                alert('Error deleting task.');
            }
        } catch (err) {
            console.error('Error deleting task:', err);
            alert('Error deleting task.');
        }
    }

    async function handleFindWindows(taskId) {
        const windowsDiv = document.getElementById(`windows-${taskId}`);
        if (!windowsDiv) {
            return;
        }
        windowsDiv.textContent = 'Loading...';
        try {
            const response = await fetch('/suggestions/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_id: taskId }),
            });
            if (response.ok) {
                const data = await response.json();
                if (data.possible_windows && data.possible_windows.length > 0) {
                    windowsDiv.innerHTML = '<b>Possible Windows:</b><br>' + data.possible_windows
                        .map((window) => `${window.display} (${window.duration})`)
                        .join('<br>');
                } else {
                    const fallbackMessage = data.no_windows_reason || 'No available windows found.';
                    const blockersIndex = fallbackMessage.indexOf('Common blockers:');
                    const visibleMessage = blockersIndex !== -1
                        ? fallbackMessage.slice(0, blockersIndex).trim()
                        : fallbackMessage;
                    const hiddenIntro = blockersIndex !== -1
                        ? fallbackMessage.slice(blockersIndex).trim()
                        : '';

                    if (data.reason_details && data.reason_details.length > 0) {
                        const listItems = data.reason_details
                            .map((detail) => `<li>${detail.reason} (${detail.count})</li>`)
                            .join('');
                        const introHtml = hiddenIntro ? `<p>${hiddenIntro}</p>` : '';
                        windowsDiv.innerHTML = `<div>${visibleMessage}</div>` +
                            `<details class="mt-1 text-sm">` +
                            `<summary class="cursor-pointer text-blue-600">Show details</summary>` +
                            `<div class="mt-1">${introHtml}<ul class="list-disc pl-5">${listItems}</ul></div>` +
                            `</details>`;
                    } else {
                        windowsDiv.textContent = fallbackMessage;
                    }
                }
            } else {
                windowsDiv.textContent = 'Error fetching windows.';
            }
        } catch (err) {
            windowsDiv.textContent = 'Error fetching windows.';
        }
    }

    resetForm();
    void loadTasks();
});
