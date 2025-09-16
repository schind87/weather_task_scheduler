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
        if (!/^[0-9]{5}$/.test(locationValue)) {
            flagError('location', 'Please enter a valid 5-digit ZIP code.');
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

        const createdAt = task.created_at ? new Date(`${task.created_at}Z`).toLocaleString() : 'Unknown';
        const scheduledTimeDisplay = task.scheduled_time
            ? new Date(`${task.scheduled_time}Z`).toLocaleString()
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
