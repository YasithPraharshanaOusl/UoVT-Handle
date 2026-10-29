export default async function(req, res) {
    try {
        const store = req.app.locals.portalStore;
        if (!await isAdminAuthenticated(req, store)) return res.redirect(302, '/admin/login');
        if (!['GET', 'POST'].includes(req.method)) return res.status(405).send('Method not allowed.');
        await store.initialize();

        let message = '';
        let messageType = 'success';
        if (req.method === 'POST') {
            const action = req.body?.action;
            if (action === 'save') {
                const sourceText = normalizeText(req.body?.sourceText);
                const englishText = normalizeText(req.body?.englishText, true);
                const sinhalaText = normalizeText(req.body?.sinhalaText, true);
                const combinedText = normalizeText(req.body?.combinedText, true);
                if (!sourceText || englishText === null || sinhalaText === null || combinedText === null) {
                    [message, messageType] = ['Each phrase and translation must be no more than 400 characters.', 'error'];
                } else if (!englishText && !sinhalaText && !combinedText) {
                    [message, messageType] = ['Add the source phrase and at least one translation.', 'error'];
                } else if (await store.saveTranslation(
                    { sourceText, englishText, sinhalaText, combinedText },
                    process.env.ADMIN_USERNAME
                )) {
                    message = 'Translation saved. Visitors will see it when they choose that language.';
                } else {
                    [message, messageType] = ['The translation could not be saved.', 'error'];
                }
            } else if (action === 'delete') {
                const id = parsePositiveId(req.body?.id);
                if (!id) {
                    [message, messageType] = ['Translation ID is invalid.', 'error'];
                } else if (await store.deleteTranslation(id)) {
                    message = 'Translation removed.';
                } else {
                    [message, messageType] = ['That translation could not be found.', 'error'];
                }
            } else {
                [message, messageType] = ['Unknown translation action.', 'error'];
            }
        }

        return res.send(renderTranslatorPage(await store.getTranslations(), message, messageType));
    } catch (error) {
        console.error('Admin translation tool error:', error);
        if (!res.headersSent) return res.status(500).send('The translation tool is temporarily unavailable.');
    }
}

function renderTranslatorPage(translations, message, messageType) {
    const rows = translations.length
        ? translations.map(item => `<tr data-search="${escapeHtml(`${item.source_text} ${item.english_text} ${item.sinhala_text} ${item.combined_text}`.toLowerCase())}">
            <td><strong>${escapeHtml(item.source_text)}</strong></td>
            <td>${escapeHtml(item.english_text || '—')}</td>
            <td>${escapeHtml(item.sinhala_text || '—')}</td>
            <td>${escapeHtml(item.combined_text || 'Automatic mix')}</td>
            <td><form method="POST" action="/admin/translator" onsubmit="return confirm('Remove this translation?')">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="id" value="${escapeHtml(String(item.id))}">
                <button class="admin-danger-button" type="submit">Delete</button>
            </form></td>
        </tr>`).join('')
        : '<tr><td class="admin-empty-table" colspan="5">No custom translations yet. Add phrases above.</td></tr>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Language translator - UoVT Student Hub</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/admin.css" rel="stylesheet">
</head>
<body>
    <main class="admin-container admin-translator-container">
        <p class="admin-eyebrow">UOVT STUDENT HUB · ADMIN</p>
        <h1>Language translator</h1>
        <p class="admin-page-intro">Add or improve Sinhala and English labels used around the website. Combined language uses the custom combined phrase when provided; otherwise it falls back to Sinhala, then English.</p>
        <nav class="admin-navigation" aria-label="Admin pages">
            <a href="/admin/dashboard">Overview</a>
            <a href="/admin/users">User management</a>
            <a href="/admin/submit">Add resource</a>
            <a href="/admin/settings">Universities &amp; settings</a>
            <a class="active" href="/admin/translator" aria-current="page">Translator</a>
        </nav>
        ${message ? `<div class="admin-alert ${messageType}" role="${messageType === 'success' ? 'status' : 'alert'}">${escapeHtml(message)}</div>` : ''}
        <form class="admin-translation-form" method="POST" action="/admin/translator">
            <input type="hidden" name="action" value="save">
            <label>Original phrase
                <textarea name="sourceText" maxlength="400" rows="2" placeholder="Type the exact text that appears on a page" required></textarea>
            </label>
            <label>English
                <textarea name="englishText" maxlength="400" rows="2" placeholder="English wording"></textarea>
            </label>
            <label>සිංහල
                <textarea name="sinhalaText" maxlength="400" rows="2" placeholder="සිංහල පරිවර්තනය"></textarea>
            </label>
            <label>Combined / mixed
                <textarea name="combinedText" maxlength="400" rows="2" placeholder="Optional mixed wording, e.g. සිංහල label (English)"></textarea>
            </label>
            <p class="admin-translation-help">Use Combined / mixed for terms that are clearer in English but where the rest of the interface is Sinhala. Leave it empty to use the automatic Sinhala → English fallback.</p>
            <button class="admin-button" type="submit">Save translation</button>
        </form>
        <section class="admin-translations-list">
            <div class="admin-card-heading">
                <div><h2>Saved phrases <span class="admin-count-badge">${translations.length}</span></h2><p>Changes apply when a visitor selects a language in the display controls.</p></div>
            </div>
            <label class="admin-translation-search">Search phrases
                <input id="translationSearch" type="search" placeholder="Search original or translated wording">
            </label>
            <div class="admin-users-table-wrap">
                <table class="admin-users-table">
                    <thead><tr><th>Original phrase</th><th>English</th><th>සිංහල</th><th>Combined</th><th>Action</th></tr></thead>
                    <tbody id="translationRows">${rows}</tbody>
                </table>
            </div>
        </section>
        <form class="admin-logout" action="/admin/logout" method="POST"><button class="admin-secondary-button" type="submit">Admin logout</button></form>
        <a class="admin-back-link" href="/">Back to website</a>
    </main>
    <script>
        const search = document.getElementById('translationSearch');
        const rows = [...document.querySelectorAll('#translationRows tr[data-search]')];
        search.addEventListener('input', () => {
            const query = search.value.trim().toLocaleLowerCase();
            rows.forEach(row => row.hidden = !row.dataset.search.includes(query));
        });
    </script>
</body>
</html>`;
}

function normalizeText(value, allowEmpty = false) {
    if (allowEmpty && (value === undefined || value === null)) return '';
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (allowEmpty && !text) return '';
    return text.length > 0 && text.length <= 400 && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)
        ? text
        : null;
}

function parsePositiveId(value) {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function isAdminAuthenticated(req, store) {
    const cookieHeader = req.headers?.cookie || '';
    const cookie = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith('adminSessionToken='));
    if (!cookie) return false;
    const username = await store.getSession(cookie.slice('adminSessionToken='.length), 'admin');
    return typeof username === 'string' && username === process.env.ADMIN_USERNAME;
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
