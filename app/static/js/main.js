document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('taskForm');
    const formTitle = document.getElementById('formTitle');
    const submitButton = document.getElementById('submitButton');
    const submitButtonSpinner = document.getElementById('submitButtonSpinner');
    const submitButtonText = document.getElementById('submitButtonText');
    const cancelEditButton = document.getElementById('cancelEditButton');
    const taskList = document.getElementById('taskList');
    const useTemperature = document.getElementById('useTemperature');
    const useHumidity = document.getElementById('useHumidity');
    const temperatureInputs = document.getElementById('temperatureInputs');
    const humidityInputs = document.getElementById('humidityInputs');
    const notificationContainer = document.getElementById('notificationContainer');

    const fieldErrorElements = {
        taskName: document.getElementById('taskNameError'),
        location: document.getElementById('locationError'),
        durationHours: document.getElementById('durationHoursError'),
        minTemp: document.getElementById('minTempError'),
        maxTemp: document.getElementById('maxTempError'),
        minHumidity: document.getElementById('minHumidityError'),
        maxHumidity: document.getElementById('maxHumidityError'),
        earliestStart: document.getElementById('earliestStartError'),
        latestStart: document.getElementById('latestStartError'),
    };

    let editingTaskId = null;
    const taskCache = new Map();

    const notificationStyles = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
    };

    const showNotification = (type, message) => {
        if (!notificationContainer) {
            return;
        }
        const style = notificationStyles[type] || notificationStyles.info;
        const wrapper = document.createElement('div');
        wrapper.className = `flex items-start justify-between rounded-md border px-4 py-3 shadow-sm transition-opacity duration-200 ${style}`;

        const text = document.createElement('p');
        text.className = 'pr-3 text-sm';
        text.textContent = message;

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'ml-4 text-lg leading-none opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current';
        closeButton.setAttribute('aria-label', 'Dismiss notification');
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => wrapper.remove());

        wrapper.appendChild(text);
        wrapper.appendChild(closeButton);

        if (notificationContainer.children.length >= 4) {
            notificationContainer.removeChild(notificationContainer.firstElementChild);
        }

        notificationContainer.appendChild(wrapper);

        window.setTimeout(() => {
            wrapper.classList.add('opacity-0');
            window.setTimeout(() => {
                wrapper.remove();
            }, 200);
        }, 8000);
    };

    const clearSpecificFieldError = (fieldId) => {
        const errorElement = fieldErrorElements[fieldId];
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.add('hidden');
        }
        const input = document.getElementById(fieldId);
        if (input) {
            input.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-500');
            input.removeAttribute('aria-invalid');
            if (errorElement && input.getAttribute('aria-describedby') === errorElement.id) {
                input.removeAttribute('aria-describedby');
            }
        }
    };

    const clearFieldErrors = () => {
        Object.keys(fieldErrorElements).forEach((fieldId) => {
            clearSpecificFieldError(fieldId);
        });
    };

    const isValidZipInput = (value) => {
        if (typeof value !== 'string') {
            return false;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return false;
        }
        const [basePart, countryPart = ''] = trimmed
            .split(',', 2)
            .map((part) => part.trim());
        const digits = basePart.replace(/\D/g, '');
        if (digits.length !== 5 && digits.length !== 9) {
            return false;
        }
        if (countryPart) {
            return /^[A-Za-z]{2}$/.test(countryPart);
        }
        return true;
    };

    const setFieldError = (fieldId, message) => {
        const errorElement = fieldErrorElements[fieldId];
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
        const input = document.getElementById(fieldId);
        if (input) {
            input.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-500');
            input.setAttribute('aria-invalid', 'true');
            if (errorElement) {
                input.setAttribute('aria-describedby', errorElement.id);
            }
        }
    };

    const updateSubmitButtonLabel = () => {
        if (!submitButtonText) {
            return;
        }
        submitButtonText.textContent = editingTaskId ? 'Update Task' : 'Add Task';
    };

    const setLoadingState = (isLoading) => {
        if (isLoading) {
            submitButton.disabled = true;
            submitButton.classList.add('opacity-70', 'cursor-not-allowed');
            if (submitButtonSpinner) {
                submitButtonSpinner.classList.remove('hidden');
            }
            if (submitButtonText) {
                submitButtonText.textContent = 'Saving...';
            }
        } else {
            submitButton.disabled = false;
            submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
            if (submitButtonSpinner) {
                submitButtonSpinner.classList.add('hidden');
            }
            updateSubmitButtonLabel();
        }
    };

    const validateForm = () => {
        let isValid = true;
        let firstInvalidField = null;

        const flagError = (fieldId, message) => {
            if (!firstInvalidField) {
                firstInvalidField = fieldId;
            }
            setFieldError(fieldId, message);
            isValid = false;
        };

        const nameValue = document.getElementById('taskName').value.trim();
        if (!nameValue) {
            flagError('taskName', 'Task name is required.');
        }

        const locationValue = document.getElementById('location').value.trim();
        const zipPattern = /^\d{5}(?:[-\s]?\d{4})?(?:\s*,\s*[A-Za-z]{2})?$/i;
        if (!zipPattern.test(locationValue)) {
            flagError(
                'location',
                'Please enter a valid ZIP code (5 digits, ZIP+4, or add a country like 12345,CA).',
            );
        }

        const durationInput = document.getElementById('durationHours');
        const durationValue = Number(durationInput.value);
        if (!Number.isFinite(durationValue) || durationValue <= 0) {
            flagError('durationHours', 'Duration must be at least 1 hour.');
        } else if (!Number.isInteger(durationValue)) {
            flagError('durationHours', 'Duration must be a whole number of hours.');
        }

        if (useTemperature.checked) {
            const minTempValue = document.getElementById('minTemp').value.trim();
            const maxTempValue = document.getElementById('maxTemp').value.trim();
            const minTempNumber = minTempValue === '' ? null : Number(minTempValue);
            const maxTempNumber = maxTempValue === '' ? null : Number(maxTempValue);

            if (minTempValue !== '' && Number.isNaN(minTempNumber)) {
                flagError('minTemp', 'Please enter a valid number.');
            }
            if (maxTempValue !== '' && Number.isNaN(maxTempNumber)) {
                flagError('maxTemp', 'Please enter a valid number.');
            }
            if (
                minTempNumber !== null &&
                maxTempNumber !== null &&
                minTempNumber > maxTempNumber
            ) {
                flagError('maxTemp', 'Maximum temperature must be greater than or equal to minimum temperature.');
            }
        }

        if (useHumidity.checked) {
            const minHumidityValue = document.getElementById('minHumidity').value.trim();
            const maxHumidityValue = document.getElementById('maxHumidity').value.trim();
            const minHumidityNumber = minHumidityValue === '' ? null : Number(minHumidityValue);
            const maxHumidityNumber = maxHumidityValue === '' ? null : Number(maxHumidityValue);

            if (minHumidityValue !== '' && Number.isNaN(minHumidityNumber)) {
                flagError('minHumidity', 'Please enter a valid number.');
            } else if (minHumidityNumber !== null && (minHumidityNumber < 0 || minHumidityNumber > 100)) {
                flagError('minHumidity', 'Humidity must be between 0 and 100%.');
            }

            if (maxHumidityValue !== '' && Number.isNaN(maxHumidityNumber)) {
                flagError('maxHumidity', 'Please enter a valid number.');
            } else if (maxHumidityNumber !== null && (maxHumidityNumber < 0 || maxHumidityNumber > 100)) {
                flagError('maxHumidity', 'Humidity must be between 0 and 100%.');
            }

            if (
                minHumidityNumber !== null &&
                maxHumidityNumber !== null &&
                minHumidityNumber > maxHumidityNumber
            ) {
                flagError('maxHumidity', 'Maximum humidity must be greater than or equal to minimum humidity.');
            }
        }

        const earliestValue = document.getElementById('earliestStart').value;
        const latestValue = document.getElementById('latestStart').value;
        if (earliestValue && latestValue && earliestValue > latestValue) {
            flagError('latestStart', 'Latest start time must be the same as or later than the earliest start time.');
        }

        if (!isValid && firstInvalidField) {
            const firstElement = document.getElementById(firstInvalidField);
            if (firstElement && typeof firstElement.focus === 'function') {
                firstElement.focus();
            }
        }

        return isValid;
    };

    const toggleGroupState = (checkbox, group) => {
        group.classList.toggle('opacity-50', !checkbox.checked);
        group.classList.toggle('pointer-events-none', !checkbox.checked);
    };

    const resetToggleGroups = () => {
        toggleGroupState(useTemperature, temperatureInputs);
        toggleGroupState(useHumidity, humidityInputs);
    };

    useTemperature.addEventListener('change', () => {
        toggleGroupState(useTemperature, temperatureInputs);
        if (!useTemperature.checked) {
            clearSpecificFieldError('minTemp');
            clearSpecificFieldError('maxTemp');
        }
    });
    useHumidity.addEventListener('change', () => {
        toggleGroupState(useHumidity, humidityInputs);
        if (!useHumidity.checked) {
            clearSpecificFieldError('minHumidity');
            clearSpecificFieldError('maxHumidity');
        }
    });

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
        clearFieldErrors();
        editingTaskId = null;
        formTitle.textContent = 'Add New Task';
        cancelEditButton.classList.add('hidden');
        setLoadingState(false);
        resetToggleGroups();
    };

    const enterEditMode = (task) => {
        clearFieldErrors();
        editingTaskId = task.id;
        formTitle.textContent = 'Edit Task';
        cancelEditButton.classList.remove('hidden');
        setLoadingState(false);

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
            showNotification('error', 'Unable to load tasks.');
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
        const nameValue = document.getElementById('taskName').value.trim();
        const locationValue = document.getElementById('location').value.trim();
        const durationValue = parseInt(document.getElementById('durationHours').value, 10);
        const earliestValue = document.getElementById('earliestStart').value;
        const latestValue = document.getElementById('latestStart').value;

        const payload = {
            name: nameValue,
            location: locationValue,
            duration_hours: durationValue,
            no_rain: document.getElementById('noRain').checked,
            earliest_start: earliestValue || null,
            latest_start: latestValue || null,
        };

        if (useTemperature.checked) {
            const minTempValue = document.getElementById('minTemp').value.trim();
            const maxTempValue = document.getElementById('maxTemp').value.trim();
            if (minTempValue !== '') {
                const minTempNumber = parseFloat(minTempValue);
                if (!Number.isNaN(minTempNumber)) {
                    payload.min_temp = minTempNumber;
                }
            }
            if (maxTempValue !== '') {
                const maxTempNumber = parseFloat(maxTempValue);
                if (!Number.isNaN(maxTempNumber)) {
                    payload.max_temp = maxTempNumber;
                }
            }
        } else {
            payload.min_temp = null;
            payload.max_temp = null;
        }

        if (useHumidity.checked) {
            const minHumidityValue = document.getElementById('minHumidity').value.trim();
            const maxHumidityValue = document.getElementById('maxHumidity').value.trim();
            if (minHumidityValue !== '') {
                const minHumidityNumber = parseInt(minHumidityValue, 10);
                if (!Number.isNaN(minHumidityNumber)) {
                    payload.min_humidity = minHumidityNumber;
                }
            }
            if (maxHumidityValue !== '') {
                const maxHumidityNumber = parseInt(maxHumidityValue, 10);
                if (!Number.isNaN(maxHumidityNumber)) {
                    payload.max_humidity = maxHumidityNumber;
                }
            }
        } else {
            payload.min_humidity = null;
            payload.max_humidity = null;
        }

        return payload;
    };

    taskForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearFieldErrors();

        if (!validateForm()) {
            showNotification('error', 'Please fix the errors highlighted below.');
            return;
        }

        const payload = buildTaskPayload();
        const isEditing = Boolean(editingTaskId);
        const url = editingTaskId ? `/tasks/${editingTaskId}` : '/tasks/';
        const method = editingTaskId ? 'PUT' : 'POST';

        try {
            setLoadingState(true);
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                showNotification('success', isEditing ? 'Task updated successfully.' : 'Task created successfully.');
                resetForm();
                await loadTasks();
            } else {
                let errorDetail = `${response.status} ${response.statusText}`.trim();
                try {
                    const errorData = await response.json();
                    if (errorData) {
                        if (typeof errorData.detail === 'string') {
                            errorDetail = errorData.detail;
                        } else if (Array.isArray(errorData.detail)) {
                            errorDetail = errorData.detail.map((item) => item.msg || String(item)).join(', ');
                        }
                    }
                } catch (parseErr) {
                    console.error('Failed to parse error response', parseErr);
                }
                showNotification('error', `Error saving task: ${errorDetail || 'Unknown error.'}`);
            }
        } catch (err) {
            console.error('Network or server error while saving task.', err);
            showNotification('error', 'Network or server error while saving task.');
        } finally {
            setLoadingState(false);
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
                showNotification('success', 'Task deleted successfully.');
            } else {
                showNotification('error', 'Error deleting task.');
            }
        } catch (err) {
            console.error('Error deleting task:', err);
            showNotification('error', 'Error deleting task.');
        }
    }

    const renderWindowsLoading = (container) => {
        container.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center text-sm text-gray-600';
        const spinner = document.createElement('span');
        spinner.className = 'mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent';
        const text = document.createElement('span');
        text.textContent = 'Fetching best windows...';
        wrapper.appendChild(spinner);
        wrapper.appendChild(text);
        container.appendChild(wrapper);
    };

    const renderWindowsError = (container, message) => {
        container.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 shadow-sm';
        card.textContent = message;
        container.appendChild(card);
    };

    const renderWindowsResults = (container, data) => {
        container.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-4';

        const windows = Array.isArray(data.possible_windows) ? data.possible_windows : [];
        const blockers = Array.isArray(data.reason_details) ? data.reason_details : [];
        const summaryTextRaw = data.no_windows_reason || '';
        const summaryText = summaryTextRaw.split('Common blockers:')[0].trim();

        if (windows.length > 0) {
            const windowsSection = document.createElement('div');
            windowsSection.className = 'space-y-2';

            const header = document.createElement('h4');
            header.className = 'text-sm font-semibold uppercase tracking-wide text-gray-600';
            header.textContent = 'Possible Windows';

            const grid = document.createElement('div');
            grid.className = 'grid gap-3 sm:grid-cols-2';

            windows.forEach((window) => {
                const card = document.createElement('article');
                card.className = 'rounded-md border border-green-200 bg-green-50 p-3 shadow-sm';

                const title = document.createElement('p');
                title.className = 'text-sm font-semibold text-green-900';
                title.textContent = window.display;

                const duration = document.createElement('p');
                duration.className = 'mt-1 text-xs text-green-800';
                duration.textContent = `Duration: ${window.duration}`;

                card.appendChild(title);
                card.appendChild(duration);
                grid.appendChild(card);
            });

            windowsSection.appendChild(header);
            windowsSection.appendChild(grid);
            wrapper.appendChild(windowsSection);
        }

        if (windows.length === 0) {
            const summaryCard = document.createElement('div');
            summaryCard.className = 'rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm';

            const summaryTitle = document.createElement('h5');
            summaryTitle.className = 'text-base font-semibold text-amber-900';
            summaryTitle.textContent = 'No suitable windows yet';

            const summaryBody = document.createElement('p');
            summaryBody.className = 'mt-1 leading-snug';
            summaryBody.textContent = summaryText || 'No available windows found.';

            summaryCard.appendChild(summaryTitle);
            summaryCard.appendChild(summaryBody);
            wrapper.appendChild(summaryCard);
        }

        if (blockers.length > 0) {
            const blockersCard = document.createElement('div');
            blockersCard.className = 'rounded-md border border-red-200 bg-red-50 p-4 shadow-sm';

            const blockersTitle = document.createElement('h6');
            blockersTitle.className = 'text-sm font-semibold uppercase tracking-wide text-red-800';
            blockersTitle.textContent = windows.length > 0 ? 'Potential blockers to watch' : 'Common blockers';

            const blockersList = document.createElement('div');
            blockersList.className = 'mt-2 space-y-2';

            blockers.forEach((detail) => {
                const item = document.createElement('div');
                item.className = 'rounded border border-red-200 bg-red-100 p-3 text-sm text-red-900';

                const reason = document.createElement('p');
                reason.className = 'font-medium';
                reason.textContent = detail.reason;

                const count = document.createElement('p');
                count.className = 'mt-1 text-xs text-red-700';
                count.textContent = detail.count === 1
                    ? 'Occurred once in the forecast.'
                    : `Occurred ${detail.count} times in the forecast.`;

                item.appendChild(reason);
                item.appendChild(count);
                blockersList.appendChild(item);
            });

            blockersCard.appendChild(blockersTitle);
            blockersCard.appendChild(blockersList);
            wrapper.appendChild(blockersCard);
        }

        if (!wrapper.childElementCount) {
            const fallback = document.createElement('div');
            fallback.className = 'rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700';
            fallback.textContent = 'No additional information available.';
            wrapper.appendChild(fallback);
        }

        container.appendChild(wrapper);
    };

    async function handleFindWindows(taskId) {
        const windowsDiv = document.getElementById(`windows-${taskId}`);
        if (!windowsDiv) {
            return;
        }
        renderWindowsLoading(windowsDiv);
        try {
            const response = await fetch('/suggestions/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_id: taskId }),
            });
            if (response.ok) {
                const data = await response.json();
                renderWindowsResults(windowsDiv, data);
            } else {
                renderWindowsError(windowsDiv, 'Unable to fetch windows at this time.');
                showNotification('error', 'Unable to fetch windows for this task.');
            }
        } catch (err) {
            console.error('Error fetching windows:', err);
            renderWindowsError(windowsDiv, 'Unable to fetch windows at this time.');
            showNotification('error', 'Unable to fetch windows for this task.');
        }
    }

    resetForm();
    void loadTasks();
});
