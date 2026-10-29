import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_SECONDS = 28800;

export default async function(req, res) {
    try {
        const store = req.app.locals.portalStore;
        const action = req.params?.action || 'index';
        const isAuthenticated = await getAdminSession(req, store);

        if (action === 'logout') {
            if (req.method === 'GET') {
                if (!isAuthenticated) return res.redirect(302, '/admin/login');
                return res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin logout</title><link href="/css/global.css" rel="stylesheet"><link href="/css/admin.css" rel="stylesheet"></head>
<body><main class="admin-auth-container"><section class="admin-auth-card"><h1>Admin logout</h1><form action="/admin/logout" method="POST"><button class="admin-button" type="submit">Logout</button></form><a class="admin-back-link" href="/admin/dashboard">Cancel</a></section></main></body></html>`);
            }
            if (req.method !== 'POST') return res.status(405).send('Method not allowed.');

            const token = getSessionToken(req);
            if (token) await store.deleteSession(token, 'admin');
            res.setHeader('Set-Cookie', makeSessionCookie('', req, true));
            return res.redirect(303, '/admin/login');
        }

        if (action === 'index') {
            return res.redirect(302, isAuthenticated ? '/admin/dashboard' : '/admin/login');
        }
        if (action !== 'login') return res.status(404).send('Admin page not found.');
        if (isAuthenticated) return res.redirect(302, '/admin/dashboard');

        if (req.method === 'POST') {
            const expectedUsername = process.env.ADMIN_USERNAME;
            const expectedPassword = process.env.ADMIN_PASSWORD;
            if (!expectedUsername || !expectedPassword) {
                console.error('Admin credentials are not configured.');
                return renderLogin(res, 'Admin login is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD.');
            }

            const usernameMatches = safeEqual(req.body?.username, expectedUsername);
            const passwordMatches = safeEqual(req.body?.password, expectedPassword);
            if (usernameMatches && passwordMatches) {
                const token = randomBytes(32).toString('base64url');
                await store.createSession(token, expectedUsername, 'admin', SESSION_TTL_SECONDS);
                res.setHeader('Set-Cookie', makeSessionCookie(token, req));
                return res.redirect(303, '/admin/dashboard');
            }

            return renderLogin(res, 'Username or password is incorrect.');
        }

        if (req.method !== 'GET') return res.status(405).send('Method not allowed.');
        return renderLogin(res);
    } catch (error) {
        console.error('Admin authentication error:', error);
        if (!res.headersSent) return res.status(500).send('Admin authentication is unavailable. Please try again later.');
    }
}

function renderLogin(res, errorMessage = '') {
    const errorMarkup = errorMessage
        ? `<p class="admin-alert" role="alert">${escapeHtml(errorMessage)}</p>`
        : '';

    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin login - UOVt Handle</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/admin.css" rel="stylesheet">
</head>
<body>
    <main class="admin-auth-container">
        <section class="admin-auth-card">
            <h1>Admin login</h1>
            ${errorMarkup}
            <form action="/admin/login" method="POST">
                <div class="admin-form-group">
                    <label for="username">Username</label>
                    <input id="username" name="username" autocomplete="username" required>
                </div>
                <div class="admin-form-group">
                    <label for="password">Password</label>
                    <input id="password" name="password" type="password" autocomplete="current-password" required>
                </div>
                <button class="admin-button" type="submit">Login</button>
            </form>
            <a class="admin-back-link" href="/">Back to website</a>
        </section>
    </main>
</body>
</html>`);
}

async function getAdminSession(req, store) {
    const token = getSessionToken(req);
    if (!token) return false;
    const username = await store.getSession(token, 'admin');
    return typeof username === 'string' && username === process.env.ADMIN_USERNAME;
}

function getSessionToken(req) {
    const cookieHeader = req.headers?.cookie || '';
    const cookie = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith('adminSessionToken='));
    return cookie ? cookie.slice('adminSessionToken='.length) : '';
}

function makeSessionCookie(token, req, clear = false) {
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    return `adminSessionToken=${token}; HttpOnly; Path=/admin; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_TTL_SECONDS}${secure ? '; Secure' : ''}`;
}

function safeEqual(value, expected) {
    if (typeof value !== 'string') return false;
    const valueHash = createHash('sha256').update(value).digest();
    const expectedHash = createHash('sha256').update(expected).digest();
    return timingSafeEqual(valueHash, expectedHash) && value === expected;
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
