const PAGE_CLASSES = ['lectureVideo', 'pastPaper', 'lecturePresenNote', 'shortNote'];
const LINK_TYPES = ['yt', 'telegram', 'drive', 'whatsapp', 'default'];

export default async function(req, res) {
    try {
        const store = req.app.locals.portalStore;
        if (!await isAdminAuthenticated(req, store)) return res.redirect(302, '/admin/login');
        if (req.method !== 'GET' && req.method !== 'POST') {
            return res.status(405).send('Method not allowed.');
        }
        await store.initialize();
        const departments = await store.getActiveDepartments();

        let message = '';
        let messageType = '';
        if (req.method === 'POST') {
            const { pageClass, semNumber, title, linkType, label, url, visibilityMode } = req.body || {};
            const departmentIds = normalizeDepartmentIds(req.body?.departmentIds);
            const visibleToAll = visibilityMode === 'public';
            const validSubmission = PAGE_CLASSES.includes(pageClass)
                && /^[1-8]$/.test(String(semNumber))
                && typeof title === 'string' && title.trim().length > 0 && title.trim().length <= 160
                && LINK_TYPES.includes(linkType)
                && typeof label === 'string' && label.trim().length > 0 && label.trim().length <= 120
                && isValidUrl(url)
                && (visibleToAll || (
                    visibilityMode === 'selected'
                    && departmentIds.length > 0
                    && departmentIds.every(id => departments.some(department => String(department.id) === id))
                ));

            if (!validSubmission) {
                message = 'කරුණාකර සියලුම ක්ෂේත්‍ර නිවැරදිව පුරවන්න.';
                messageType = 'error';
            } else if (await store.saveResource(pageClass, String(semNumber), {
                title: title.trim(),
                link: { type: linkType, label: label.trim(), url: url.trim() }
            }, { all: visibleToAll, departmentIds })) {
                message = 'Resource එක සාර්ථකව සුරැකුණා. Link එක duplicate නොකර තෝරාගත් departments සඳහා access යාවත්කාලීන කළා.';
                messageType = 'success';
            }
        }

        return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin - Add learning resource</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/admin.css" rel="stylesheet">
</head>
<body>
    <main class="admin-container">
        <h1>Admin: add a learning resource</h1>
        ${message ? `<div class="admin-alert ${messageType}">${escapeHtml(message)}</div>` : ''}
        <nav class="admin-navigation" aria-label="Admin pages">
            <a href="/admin/dashboard">Overview</a>
            <a href="/admin/users">User management</a>
            <a class="active" href="/admin/submit">Add resource</a>
            <a href="/admin/settings">Universities &amp; settings</a>
            <a href="/admin/translator">Translator</a>
        </nav>
        <form method="POST" action="/admin/submit">
            <div class="admin-form-group">
                <label for="pageClass">අංශය (Category)</label>
                <select id="pageClass" name="pageClass" required>
                    <option value="lectureVideo">Lecture Videos</option>
                    <option value="pastPaper">Past Papers</option>
                    <option value="lecturePresenNote">Lecture Notes</option>
                    <option value="shortNote">Short Notes</option>
                </select>
            </div>
            <div class="admin-form-group">
                <label for="semNumber">සෙමෙස්ටරය (Semester)</label>
                <select id="semNumber" name="semNumber" required>
                    ${Array.from({ length: 8 }, (_, index) => `<option value="${index + 1}">Semester ${index + 1}</option>`).join('')}
                </select>
            </div>
            <div class="admin-form-group">
                <label for="title">විෂයේ නම (Subject / Title)</label>
                <input id="title" type="text" name="title" maxlength="160" placeholder="උදා: Mathematics for IT (IT1101)" required>
            </div>
            <div class="admin-form-group">
                <label for="linkType">ලින්ක් වර්ගය (Link Type)</label>
                <select id="linkType" name="linkType" required>
                    <option value="yt">YouTube Playlist</option>
                    <option value="telegram">Telegram Group / Channel</option>
                    <option value="drive">Google Drive Notes</option>
                    <option value="whatsapp">WhatsApp Group</option>
                    <option value="default">Other Website</option>
                </select>
            </div>
            <div class="admin-form-group">
                <label for="label">බටන් එකේ නම (Button Label)</label>
                <input id="label" type="text" name="label" maxlength="120" placeholder="YouTube Playlist 1" required>
            </div>
            <div class="admin-form-group">
                <label for="url">සම්පූර්ණ ලින්ක් ලිපිනය (URL)</label>
                <input id="url" type="url" name="url" maxlength="2048" placeholder="https://..." required>
            </div>
            <fieldset class="admin-visibility">
                <legend>Who can see this link?</legend>
                <label class="admin-choice">
                    <input type="radio" name="visibilityMode" value="public">
                    <span>Public — all registered students, including other universities</span>
                </label>
                <label class="admin-choice">
                    <input type="radio" name="visibilityMode" value="selected" checked>
                    <span>Only selected departments</span>
                </label>
                <div id="departmentChoices" class="admin-department-choices" hidden>
                    ${departments.length
                        ? departments.map((department, index) => `<label class="admin-choice"><input type="checkbox" name="departmentIds" value="${escapeHtml(String(department.id))}" ${index === 0 ? 'checked' : ''}><span>${escapeHtml(department.faculty)} — ${escapeHtml(department.name)}</span></label>`).join('')
                        : '<p>No active departments yet. Add one in Departments &amp; settings first.</p>'}
                </div>
            </fieldset>
            <button class="admin-button" type="submit">දත්ත සුරකින්න (Submit)</button>
        </form>
        <a class="admin-back-link" href="/">මුල් පිටුවට යන්න</a>
        <form class="admin-logout" action="/admin/logout" method="POST">
            <button class="admin-button" type="submit">Admin logout</button>
        </form>
    </main>
    <script>
        const departmentChoices = document.getElementById('departmentChoices');
        const visibilityRadios = document.querySelectorAll('input[name="visibilityMode"]');
        function updateDepartmentChoices() {
            const selectedOnly = document.querySelector('input[name="visibilityMode"]:checked').value === 'selected';
            departmentChoices.hidden = !selectedOnly;
            const inputs = [...departmentChoices.querySelectorAll('input[type="checkbox"]')];
            const hasSelection = inputs.some(input => input.checked);
            inputs.forEach((input, index) => {
                input.disabled = !selectedOnly;
                input.required = selectedOnly && index === 0 && !hasSelection;
            });
        }
        visibilityRadios.forEach(input => input.addEventListener('change', updateDepartmentChoices));
        departmentChoices.addEventListener('change', updateDepartmentChoices);
        updateDepartmentChoices();
    </script>
</body>
</html>`);
    } catch (error) {
        console.error('Admin submit error:', error);
        if (!res.headersSent) return res.status(500).send('Admin service is unavailable. Please try again later.');
    }
}

async function isAdminAuthenticated(req, store) {
    const cookieHeader = req.headers?.cookie || '';
    const cookie = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith('adminSessionToken='));
    if (!cookie) return false;

    const username = await store.getSession(cookie.slice('adminSessionToken='.length), 'admin');
    return typeof username === 'string' && username === process.env.ADMIN_USERNAME;
}

function normalizeDepartmentIds(value) {
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    return [...new Set(values.filter(item => typeof item === 'string' && /^\d+$/.test(item)))];
}

function isValidUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return false;
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}
