export default async function(req, res) {
    try {
        const store = req.app.locals.portalStore;
        if (!await isAdminAuthenticated(req, store)) return res.redirect(302, '/admin/login');
        if (!['GET', 'POST'].includes(req.method)) return res.status(405).send('Method not allowed.');
        await store.initialize();

        const filters = req.method === 'POST' ? req.body : req.query;
        const query = typeof filters?.q === 'string' ? filters.q.trim().slice(0, 100) : '';
        const scope = ['all', 'uovt', 'other', 'disabled', 'pending'].includes(filters?.scope) ? filters.scope : 'all';
        const universityId = parsePositiveId(filters?.universityId);
        const departmentId = parsePositiveId(filters?.departmentId);
        let message = '';
        let messageType = 'success';

        if (req.method === 'POST') {
            const username = normalizeUsername(req.body?.username);
            const action = req.body?.action;
            if (!username || !['toggle-account', 'delete-account'].includes(action)) {
                message = 'The requested user action is invalid.';
                messageType = 'error';
            } else if (action === 'toggle-account') {
                const active = req.body?.active === 'true';
                if (req.body?.active !== 'true' && req.body?.active !== 'false') {
                    message = 'The account status is invalid.';
                    messageType = 'error';
                } else if (await store.setUserAccountActive(username, active)) {
                    message = active
                        ? username + ' can sign in again.'
                        : username + ' has been disabled and their active student sessions have been revoked.';
                } else {
                    message = 'That student account could not be found.';
                    messageType = 'error';
                }
            } else if (await store.deleteUser(username)) {
                message = username + ' and their student sessions have been permanently deleted.';
            } else {
                message = 'That student account could not be found.';
                messageType = 'error';
            }
        }

        const [users, universities, departments] = await Promise.all([
            store.getAdminUsers({ query, scope, universityId, departmentId }),
            store.getUniversities(),
            store.getDepartments()
        ]);
        return res.send(renderUsersPage(users, universities, departments, {
            query, scope, universityId, departmentId, message, messageType
        }));
    } catch (error) {
        console.error('Admin user management error:', error);
        if (!res.headersSent) return res.status(500).send('User management is unavailable. Please try again later.');
    }
}

function renderUsersPage(users, universities, departments, filters) {
    const universityOptions = universities
        .filter(university => university.active)
        .map(university => `<option value="${escapeHtml(String(university.id))}" ${Number(filters.universityId) === Number(university.id) ? 'selected' : ''}>${escapeHtml(university.name)}</option>`)
        .join('');
    const departmentOptions = departments
        .filter(department => department.active && department.faculty_active && department.university_active)
        .map(department => `<option value="${escapeHtml(String(department.id))}" ${Number(filters.departmentId) === Number(department.id) ? 'selected' : ''}>${escapeHtml(department.university)} → ${escapeHtml(department.faculty)} → ${escapeHtml(department.name)}</option>`)
        .join('');
    const rows = users.length
        ? users.map(user => {
            const accountActive = user.account_active !== false;
            const registered = user.created_at
                ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                : '—';
            return `<tr>
                <td data-label="Student"><strong>${escapeHtml(user.username)}</strong><small>${escapeHtml(user.university_index_no || 'Index number not set')}</small></td>
                <td data-label="University"><span>${escapeHtml(user.university || 'Not selected')}</span><small>${user.organization_request_id ? 'Campus details awaiting admin approval' : `${escapeHtml(user.faculty || '')}${user.department ? ' · ' + escapeHtml(user.department) : ''}`}</small></td>
                <td data-label="Email">${escapeHtml(user.university_email || '—')}</td>
                <td data-label="Semester">${user.current_semester ? 'Semester ' + escapeHtml(String(user.current_semester)) : '—'}</td>
                <td data-label="Status"><span class="admin-status ${accountActive ? 'is-active' : 'is-inactive'}">${accountActive ? 'Active' : 'Disabled'}</span>${user.organization_request_id ? '<small class="admin-user-pending-note">Campus pending review</small>' : ''}</td>
                <td data-label="Joined">${escapeHtml(registered)}</td>
                <td data-label="Actions"><div class="admin-user-actions">
                    ${user.organization_request_id ? '<a class="admin-secondary-button" href="/admin/settings#organization-requests">Review campus</a>' : ''}
                    <form method="POST" action="/admin/users" onsubmit="return confirm('${accountActive ? 'Disable this account? The student will be signed out.' : 'Enable this account?'}')">
                        ${filterFields(filters)}
                        <input type="hidden" name="action" value="toggle-account">
                        <input type="hidden" name="username" value="${escapeHtml(user.username)}">
                        <input type="hidden" name="active" value="${accountActive ? 'false' : 'true'}">
                        <button class="admin-secondary-button" type="submit">${accountActive ? 'Disable' : 'Enable'}</button>
                    </form>
                    <form method="POST" action="/admin/users" onsubmit="return confirm('Permanently delete ${escapeHtml(user.username)}? This cannot be undone.')">
                        ${filterFields(filters)}
                        <input type="hidden" name="action" value="delete-account">
                        <input type="hidden" name="username" value="${escapeHtml(user.username)}">
                        <button class="admin-danger-button" type="submit">Delete</button>
                    </form>
                </div></td>
            </tr>`;
        }).join('')
        : '<tr><td class="admin-empty-table" colspan="7">No student accounts match these filters.</td></tr>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User management - UoVT Student Hub</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/admin.css" rel="stylesheet">
</head>
<body>
    <main class="admin-container admin-users-container">
        <p class="admin-eyebrow">UOVT STUDENT HUB · ADMIN</p>
        <h1>User management</h1>
        <p class="admin-page-intro">Search student accounts, review their university and department, or disable access. Disabled students are signed out immediately.</p>
        <nav class="admin-navigation" aria-label="Admin pages">
            <a href="/admin/dashboard">Overview</a>
            <a class="active" href="/admin/users" aria-current="page">User management</a>
            <a href="/admin/submit">Add resource</a>
            <a href="/admin/settings">Universities &amp; settings</a>
            <a href="/admin/translator">Translator</a>
        </nav>
        ${filters.message ? `<div class="admin-alert ${filters.messageType}" role="${filters.messageType === 'success' ? 'status' : 'alert'}">${escapeHtml(filters.message)}</div>` : ''}
        <section class="admin-users-summary">
            <strong>${new Intl.NumberFormat().format(users.length)}</strong>
            <span>matching accounts ${users.length === 1000 ? '(showing first 1,000 — narrow your search)' : ''}${filters.scope === 'pending' ? ' · Review and approve grouped campus details in Universities & settings.' : ''}</span>
            ${filters.scope === 'pending' ? '<a href="/admin/settings#organization-requests">Open pending campus approvals</a>' : ''}
        </section>
        <form class="admin-user-filters" method="GET" action="/admin/users">
            <label>Search
                <input type="search" name="q" value="${escapeHtml(filters.query)}" maxlength="100" placeholder="Username, index, email, university or department">
            </label>
            <label>Account group
                <select name="scope">
                    <option value="all" ${filters.scope === 'all' ? 'selected' : ''}>All accounts</option>
                    <option value="uovt" ${filters.scope === 'uovt' ? 'selected' : ''}>UoVT students</option>
                    <option value="other" ${filters.scope === 'other' ? 'selected' : ''}>Other universities</option>
                    <option value="disabled" ${filters.scope === 'disabled' ? 'selected' : ''}>Disabled accounts</option>
                    <option value="pending" ${filters.scope === 'pending' ? 'selected' : ''}>Campus pending review</option>
                </select>
            </label>
            <label>University
                <select name="universityId">
                    <option value="">All universities</option>${universityOptions}
                </select>
            </label>
            <label>Department
                <select name="departmentId">
                    <option value="">All departments</option>${departmentOptions}
                </select>
            </label>
            <div class="admin-filter-actions">
                <button class="admin-button" type="submit">Apply filters</button>
                <a class="admin-secondary-button" href="/admin/users">Clear</a>
            </div>
        </form>
        <div class="admin-users-table-wrap">
            <table class="admin-users-table">
                <thead><tr><th>Student</th><th>University / department</th><th>University email</th><th>Semester</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody id="userRows">${rows}</tbody>
            </table>
        </div>
        <div class="admin-pagination" id="userPagination" aria-label="User table pages"></div>
        <form class="admin-logout" action="/admin/logout" method="POST"><button class="admin-secondary-button" type="submit">Admin logout</button></form>
        <a class="admin-back-link" href="/">Back to website</a>
    </main>
    <script>
        const numberFormat = new Intl.NumberFormat();
        const tableRows = [...document.querySelectorAll('#userRows > tr')];
        const pagination = document.getElementById('userPagination');
        const pageSize = 25;
        let page = 0;
        function renderPage() {
            const pages = Math.max(1, Math.ceil(tableRows.length / pageSize));
            page = Math.min(page, pages - 1);
            tableRows.forEach((row, index) => row.hidden = index < page * pageSize || index >= (page + 1) * pageSize);
            pagination.replaceChildren();
            if (pages < 2) return;
            const previous = document.createElement('button');
            previous.type = 'button';
            previous.textContent = 'Previous';
            previous.disabled = page === 0;
            previous.addEventListener('click', () => { page--; renderPage(); });
            const label = document.createElement('span');
            label.textContent = 'Page ' + numberFormat.format(page + 1) + ' of ' + numberFormat.format(pages);
            const next = document.createElement('button');
            next.type = 'button';
            next.textContent = 'Next';
            next.disabled = page >= pages - 1;
            next.addEventListener('click', () => { page++; renderPage(); });
            pagination.append(previous, label, next);
        }
        renderPage();
    </script>
</body>
</html>`;
}

function filterFields(filters) {
    return `<input type="hidden" name="q" value="${escapeHtml(filters.query)}">
        <input type="hidden" name="scope" value="${escapeHtml(filters.scope)}">
        <input type="hidden" name="universityId" value="${escapeHtml(filters.universityId || '')}">
        <input type="hidden" name="departmentId" value="${escapeHtml(filters.departmentId || '')}">`;
}

function normalizeUsername(value) {
    if (typeof value !== 'string') return null;
    const username = value.trim().toLowerCase();
    return /^[a-z0-9._-]{3,32}$/.test(username) ? username : null;
}

function parsePositiveId(value) {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isAdminAuthenticated(req, store) {
    const cookieHeader = req.headers?.cookie || '';
    const cookie = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith('adminSessionToken='));
    if (!cookie) return false;
    return store.getSession(cookie.slice('adminSessionToken='.length), 'admin')
        .then(username => typeof username === 'string' && username === process.env.ADMIN_USERNAME);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}
