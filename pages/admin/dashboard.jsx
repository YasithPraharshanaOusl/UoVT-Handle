export default async function(req, res) {
    try {
        const store = req.app.locals.portalStore;
        if (!await isAdminAuthenticated(req, store)) return res.redirect(302, '/admin/login');
        if (req.method !== 'GET') return res.status(405).send('Method not allowed.');
        await store.initialize();

        return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin dashboard - UoVT Student Hub</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/admin.css" rel="stylesheet">
</head>
<body>
    <main class="admin-container admin-dashboard-container">
        <p class="admin-eyebrow">UOVT STUDENT HUB · ADMIN</p>
        <header class="admin-dashboard-heading">
            <div>
                <h1>Overview</h1>
                <p>Enrollment and account activity across every university.</p>
            </div>
            <div class="admin-live-status"><span class="admin-live-dot"></span><span id="refreshStatus" aria-live="polite">Loading live statistics…</span></div>
        </header>
        <nav class="admin-navigation" aria-label="Admin pages">
            <a class="active" href="/admin/dashboard" aria-current="page">Overview</a>
            <a href="/admin/users">User management</a>
            <a href="/admin/submit">Add resource</a>
            <a href="/admin/settings">Universities &amp; settings</a>
            <a href="/admin/translator">Translator</a>
        </nav>
        <div id="dashboardError" class="admin-alert" role="alert" hidden></div>
        <section class="admin-stat-grid" aria-label="Student account totals">
            <article class="admin-stat-card"><span>Total students</span><strong id="totalUsers">—</strong><small>Registered accounts</small></article>
            <article class="admin-stat-card"><span>UoVT students</span><strong id="uovtUsers">—</strong><small>University of Vocational Technology</small></article>
            <article class="admin-stat-card"><span>Other universities</span><strong id="otherUsers">—</strong><small>Registered outside UoVT</small></article>
            <article class="admin-stat-card"><span>Active accounts</span><strong id="activeUsers">—</strong><small id="disabledSummary">Disabled: —</small></article>
            <article class="admin-stat-card"><span>Joined in 7 days</span><strong id="newUsersWeek">—</strong><small>New student accounts</small></article>
            <article class="admin-stat-card"><span>Joined in 30 days</span><strong id="newUsersMonth">—</strong><small>New student accounts</small></article>
            <a class="admin-stat-card admin-stat-card-link" href="/admin/settings#organization-requests"><span>Campus verification</span><strong id="pendingOrganizationUsers">—</strong><small>Student accounts awaiting organization approval · review requests</small></a>
        </section>
        <section class="admin-dashboard-grid">
            <article class="admin-chart-card">
                <div class="admin-card-heading"><div><h2>Students by university</h2><p>Share of all registered accounts</p></div></div>
                <div class="admin-donut-layout">
                    <div class="admin-donut" id="universityDonut" role="img" aria-label="Student distribution by university"><span id="universityTotal">—</span></div>
                    <ul class="admin-chart-legend" id="universityLegend"></ul>
                </div>
            </article>
            <article class="admin-chart-card">
                <div class="admin-card-heading"><div><h2>New signups</h2><p>Daily totals · last 14 days</p></div></div>
                <div class="admin-registration-chart" id="registrationChart" role="img" aria-label="Daily student signups over the last 14 days"></div>
            </article>
            <article class="admin-chart-card">
                <div class="admin-card-heading"><div><h2>Largest faculties</h2><p>Student accounts by selected faculty</p></div></div>
                <div class="admin-bar-chart" id="facultyChart"></div>
            </article>
            <article class="admin-chart-card">
                <div class="admin-card-heading"><div><h2>Largest departments</h2><p>Student accounts by selected department</p></div></div>
                <div class="admin-bar-chart" id="departmentChart"></div>
            </article>
        </section>
        <section class="admin-structure-summary" aria-label="Portal structure totals">
            <h2>Portal structure</h2>
            <div><span>Active universities</span><strong id="activeUniversities">—</strong></div>
            <div><span>Active faculties</span><strong id="activeFaculties">—</strong></div>
            <div><span>Active departments</span><strong id="activeDepartments">—</strong></div>
            <div><span>Learning resources</span><strong id="totalResources">—</strong></div>
        </section>
        <form class="admin-logout" action="/admin/logout" method="POST"><button class="admin-secondary-button" type="submit">Admin logout</button></form>
        <a class="admin-back-link" href="/">Back to website</a>
    </main>
    <script>
        const numberFormat = new Intl.NumberFormat();
        const palette = ['#2563eb', '#0f766e', '#7c3aed', '#ea580c', '#0891b2', '#be123c', '#4d7c0f', '#9333ea', '#ca8a04', '#475569', '#0284c7', '#c026d3'];
        const setText = (id, value) => { document.getElementById(id).textContent = numberFormat.format(Number(value) || 0); };
        const svgElement = (name, attributes = {}) => {
            const element = document.createElementNS('http://www.w3.org/2000/svg', name);
            Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
            return element;
        };
        function renderDonut(universities, total) {
            const donut = document.getElementById('universityDonut');
            const legend = document.getElementById('universityLegend');
            const segments = [];
            let current = 0;
            universities.forEach((university, index) => {
                const count = Number(university.user_count) || 0;
                if (!count || !total) return;
                const end = current + count / total * 100;
                segments.push(palette[index % palette.length] + ' ' + current.toFixed(2) + '% ' + end.toFixed(2) + '%');
                current = end;
            });
            donut.style.background = segments.length ? 'conic-gradient(' + segments.join(', ') + ')' : '#e2e8f0';
            document.getElementById('universityTotal').textContent = numberFormat.format(total);
            donut.setAttribute('aria-label', universities.map(item => item.name + ': ' + item.user_count).join(', ') || 'No student accounts');
            legend.replaceChildren();
            universities.forEach((university, index) => {
                const item = document.createElement('li');
                const swatch = document.createElement('span');
                swatch.className = 'admin-legend-swatch';
                swatch.style.backgroundColor = palette[index % palette.length];
                const label = document.createElement('span');
                label.textContent = university.name + (university.active === false ? ' (inactive)' : '');
                const count = document.createElement('strong');
                count.textContent = numberFormat.format(Number(university.user_count) || 0);
                item.append(swatch, label, count);
                legend.append(item);
            });
            if (!universities.length) legend.innerHTML = '<li>No universities have been added.</li>';
        }
        function renderBars(containerId, rows, labelFor) {
            const container = document.getElementById(containerId);
            container.replaceChildren();
            const max = Math.max(1, ...rows.map(row => Number(row.user_count) || 0));
            rows.forEach((row, index) => {
                const item = document.createElement('div');
                item.className = 'admin-bar-row';
                const text = document.createElement('div');
                text.className = 'admin-bar-label';
                const label = document.createElement('span');
                label.textContent = labelFor(row);
                const count = document.createElement('strong');
                count.textContent = numberFormat.format(Number(row.user_count) || 0);
                text.append(label, count);
                const track = document.createElement('div');
                track.className = 'admin-bar-track';
                const fill = document.createElement('span');
                fill.style.width = Math.max(0, (Number(row.user_count) || 0) / max * 100) + '%';
                fill.style.backgroundColor = palette[index % palette.length];
                track.append(fill);
                item.append(text, track);
                container.append(item);
            });
            if (!rows.length) container.textContent = 'No active organization data yet.';
        }
        function renderRegistrations(rows) {
            const container = document.getElementById('registrationChart');
            container.replaceChildren();
            const svg = svgElement('svg', { viewBox: '0 0 640 220', role: 'presentation', focusable: 'false' });
            const values = rows.map(row => Number(row.user_count) || 0);
            const max = Math.max(1, ...values);
            const points = values.map((value, index) => {
                const x = rows.length < 2 ? 320 : 34 + index * 572 / (rows.length - 1);
                const y = 172 - value / max * 132;
                return { x, y, value, row: rows[index] };
            });
            [0, 1, 2, 3].forEach(index => {
                const y = 40 + index * 44;
                svg.append(svgElement('line', { x1: 32, x2: 610, y1: y, y2: y, class: 'admin-chart-gridline' }));
            });
            const areaPoints = points.map(point => point.x + ',' + point.y).join(' ');
            if (points.length) {
                const area = svgElement('polygon', { points: '34,174 ' + areaPoints + ' 606,174', class: 'admin-chart-area' });
                const line = svgElement('polyline', { points: areaPoints, class: 'admin-chart-line' });
                svg.append(area, line);
                points.forEach(point => {
                    const circle = svgElement('circle', { cx: point.x, cy: point.y, r: 4, class: 'admin-chart-point' });
                    const title = svgElement('title');
                    title.textContent = point.row.date + ': ' + point.value + ' signups';
                    circle.append(title);
                    svg.append(circle);
                });
            }
            container.append(svg);
            const labels = document.createElement('div');
            labels.className = 'admin-chart-date-labels';
            [rows[0], rows[Math.floor((rows.length - 1) / 2)], rows[rows.length - 1]].filter(Boolean).forEach(row => {
                const label = document.createElement('span');
                label.textContent = new Date(row.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                labels.append(label);
            });
            container.append(labels);
            const summary = document.createElement('p');
            summary.className = 'admin-chart-text-summary';
            summary.textContent = rows.map(row => row.date + ': ' + row.user_count + ' signups').join('; ') || 'No registrations recorded.';
            container.append(summary);
        }
        async function refreshDashboard() {
            const status = document.getElementById('refreshStatus');
            const errorBox = document.getElementById('dashboardError');
            try {
                const response = await fetch('/admin/api/stats', { credentials: 'same-origin', cache: 'no-store' });
                if (!response.ok) throw new Error(response.status === 401 ? 'Admin session expired. Please sign in again.' : 'Statistics could not be loaded. Please try again.');
                const data = await response.json();
                const totals = data.totals || {};
                setText('totalUsers', totals.total_users);
                setText('uovtUsers', totals.uovt_users);
                setText('otherUsers', totals.other_university_users);
                setText('activeUsers', totals.active_users);
                document.getElementById('disabledSummary').textContent = 'Disabled: ' + numberFormat.format(Number(totals.disabled_users) || 0);
                setText('newUsersWeek', totals.new_users_7_days);
                setText('newUsersMonth', totals.new_users_30_days);
                setText('pendingOrganizationUsers', totals.pending_organization_users);
                setText('activeUniversities', totals.active_universities);
                setText('activeFaculties', totals.active_faculties);
                setText('activeDepartments', totals.active_departments);
                setText('totalResources', totals.total_resources);
                const total = Number(totals.total_users) || 0;
                const universityRows = data.universities || [];
                const classifiedUsers = universityRows.reduce((sum, university) => sum + (Number(university.user_count) || 0), 0);
                if (classifiedUsers < total) {
                    universityRows.push({
                        name: 'University not selected',
                        user_count: total - classifiedUsers,
                        active: false
                    });
                }
                renderDonut(universityRows, total);
                renderRegistrations(data.registrations || []);
                renderBars('facultyChart', data.faculties || [], row => row.university + ' · ' + row.name);
                renderBars('departmentChart', data.departments || [], row => row.university + ' · ' + row.faculty + ' · ' + row.name);
                errorBox.hidden = true;
                status.textContent = 'Live · updated ' + new Date().toLocaleTimeString();
            } catch (error) {
                errorBox.textContent = error.message || 'Statistics could not be loaded.';
                errorBox.hidden = false;
                status.textContent = 'Refresh failed';
            }
        }
        refreshDashboard();
        window.setInterval(refreshDashboard, 30000);
    </script>
</body>
</html>`);
    } catch (error) {
        console.error('Admin dashboard error:', error);
        if (!res.headersSent) return res.status(500).send('Admin dashboard is unavailable. Please try again later.');
    }
}

async function isAdminAuthenticated(req, store) {
    const cookieHeader = req.headers?.cookie || '';
    const cookie = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith('adminSessionToken='));
    if (!cookie) return false;
    const username = await store.getSession(cookie.slice('adminSessionToken='.length), 'admin');
    return typeof username === 'string' && username === process.env.ADMIN_USERNAME;
}
