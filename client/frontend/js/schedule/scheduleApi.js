export async function fetchSchedules(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`backend/schedule/listSchedules.php?${query}`);
    return await res.json();
}

export async function getSchedule(id) {
    const res = await fetch(`backend/schedule/getSchedule.php?id=${id}`);
    return await res.json();
}

export async function createSchedule(data) {
    const res = await fetch('backend/schedule/createSchedule.php', {
        method: 'POST',
        body: data
    });
    return await res.json();
}

export async function editSchedule(id, data) {
    const fd = new FormData(data);
    fd.append('id', id);
    const res = await fetch('backend/schedule/editSchedule.php', {
        method: 'POST',
        body: fd
    });
    return await res.json();
}

export async function deleteSchedule(id) {
    const fd = new FormData();
    fd.append('id', id);
    const res = await fetch('backend/schedule/deleteSchedule.php', {
        method: 'POST',
        body: fd
    });
    return await res.json();
}
export async function updateScheduleStatus(id, status) {
    const fd = new FormData();
    fd.append('id', id);
    fd.append('status', status);
    const res = await fetch('backend/schedule/updateScheduleStatus.php', {
        method: 'POST',
        body: fd
    });
    return await res.json();
}

export async function exportSchedules() {
    const res = await fetch('backend/schedule/exportSchedules.php', {
        method: 'POST'
    });
    return await res.blob();
}
export async function bulkUpdate(ids, action) {
    const fd = new FormData();
    ids.forEach(id => fd.append('ids[]', id));
    fd.append('action', action);
    const res = await fetch('backend/schedule/bulkUpdateSchedules.php', {
        method: 'POST',
        body: fd
    });
    return await res.json();
}
