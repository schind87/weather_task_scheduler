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
                    let message = data.no_windows_reason || 'No available windows found.';
                    if (data.reason_details && data.reason_details.length > 0) {
                        const detailLines = data.reason_details
                            .map((detail) => `- ${detail.reason} (${detail.count})`)
                            .join('<br>');
                        message += `<br>${detailLines}`;
                    }
                    windowsDiv.innerHTML = message;
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
