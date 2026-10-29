import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SESSION_TTL_SECONDS = 86400;
const PASSWORD_RESET_TTL_SECONDS = 1800;
const TERMS_VERSION = '2026-10-29';
const GENDER_OPTIONS = ['female', 'male', 'other', 'prefer_not_to_say'];

export default async function(req, res) {
    try {
        const store = req.app.locals.portalStore;
        const action = req.params?.action || 'index';

        if (action === 'complete-profile') return await handleCompleteProfile(req, res, store);
        if (action === 'login') return await handleLogin(req, res, store);
        if (action === 'signup') return await handleSignup(req, res, store);
        if (action === 'forgot-password') return await handleForgotPassword(req, res, store);
        if (action === 'reset-password') return await handleResetPassword(req, res, store);
        if (action === 'logout') return await handleLogout(req, res, store);
        if (action !== 'index') return res.status(404).send('Account page not found.');

        const username = await getSessionUsername(req, store);
        if (!username) {
            return res.redirect(302, '/account/login');
        }
        const studentProfile = await store.getStudentProfile(username);
        if (!isStudentProfileComplete(studentProfile)) {
            return res.redirect(302, '/account/complete-profile');
        }

        const pageClass = ['lectureVideo', 'pastPaper', 'lecturePresenNote', 'shortNote'].includes(req.query.class)
            ? req.query.class
            : 'lectureVideo';
        const semNumber = /^[1-8]$/.test(String(req.query.semNumber || '1'))
            ? String(req.query.semNumber || '1')
            : '1';
        const dbData = await content.getDatabase(store, studentProfile.department_id);

        return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UOVt Handle - Learning Portal</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/account.css" rel="stylesheet">
</head>
<body>
    <nav.comp></nav.comp>
    <div class="main-layout">
        <aside class="portal-sidebar">
            <p class="sidebar-eyebrow">STUDENT PORTAL</p>
            <h2 class="sidebar-title">Learning library</h2>
            <ul>
                <li><a href="?class=lectureVideo&semNumber=${semNumber}" data-category="lectureVideo" class="${pageClass === 'lectureVideo' ? 'active' : ''}"><span aria-hidden="true">▶</span> Lecture videos</a></li>
                <li><a href="?class=pastPaper&semNumber=${semNumber}" data-category="pastPaper" class="${pageClass === 'pastPaper' ? 'active' : ''}"><span aria-hidden="true">▤</span> Past papers</a></li>
                <li><a href="?class=lecturePresenNote&semNumber=${semNumber}" data-category="lecturePresenNote" class="${pageClass === 'lecturePresenNote' ? 'active' : ''}"><span aria-hidden="true">▧</span> Lecture notes</a></li>
                <li><a href="?class=shortNote&semNumber=${semNumber}" data-category="shortNote" class="${pageClass === 'shortNote' ? 'active' : ''}"><span aria-hidden="true">▤</span> Short notes</a></li>
            </ul>
            <form class="account-logout" action="/account/logout" method="POST">
                <button type="submit">Log out</button>
            </form>
        </aside>
        <main class="content portal-content">
            <section class="account-hero">
                <p class="account-eyebrow">UoVT STUDENT LEARNING PORTAL</p>
                <h1>Welcome back, ${escapeHtml(username)}.</h1>
                <p>Find your next study resource. Choose a collection and semester to explore.</p>
            </section>
            <div class="content-heading" aria-live="polite">
                ${content.getPageHeader(pageClass)}
            </div>
            ${content.renderSemesterTabs(semNumber, pageClass)}
            <section class="resource-tools" aria-label="Search resources">
                <label for="resourceSearch">Find a subject
                    <input id="resourceSearch" type="search" placeholder="Search subjects..." autocomplete="off">
                </label>
                <p id="resourceCount" aria-live="polite"></p>
            </section>
            <div id="resourceResults" aria-live="polite"></div>
        </main>
    </div>
    <footer.comp></footer.comp>
    <script>
        const portalData = ${content.serializeForScript(dbData)};
        const headingMarkup = ${JSON.stringify(Object.fromEntries(
            ['lectureVideo', 'pastPaper', 'lecturePresenNote', 'shortNote']
                .map(category => [category, content.getPageHeader(category)])
        ))};
        const allowedCategories = new Set(Object.keys(headingMarkup));
        const searchInput = document.getElementById('resourceSearch');
        const resultCount = document.getElementById('resourceCount');
        const results = document.getElementById('resourceResults');
        const state = {
            category: ${JSON.stringify(pageClass)},
            semester: ${JSON.stringify(semNumber)}
        };
        const categoryLinks = [...document.querySelectorAll('[data-category]')];
        const semesterLinks = [...document.querySelectorAll('[data-semester]')];

        function resourceButtonStyle(type) {
            return ({
                yt: 'btn-yt',
                telegram: 'btn-telegram',
                drive: 'btn-drive',
                whatsapp: 'btn-whatsapp'
            })[type] || 'btn-default';
        }

        function isSafeResourceUrl(value) {
            try {
                return new URL(value).protocol === 'https:';
            } catch {
                return false;
            }
        }

        function renderResources() {
            const query = searchInput.value.trim().toLocaleLowerCase();
            const subjects = portalData[state.category]?.[state.semester] || [];
            const matchingSubjects = subjects.filter(subject =>
                [subject.title, ...(subject.links || []).map(link => link.label)]
                    .join(' ')
                    .toLocaleLowerCase()
                    .includes(query)
            );
            const title = document.createElement('h2');
            title.className = 'subject-list-title';
            title.textContent = 'Semester ' + state.semester + ' subjects';
            results.replaceChildren(title);

            if (!subjects.length) {
                const empty = document.createElement('div');
                empty.className = 'empty-state library-empty-state';
                empty.textContent = 'මෙම සෙමෙස්ටර් එක සඳහා තවදුරටත් දත්ත එකතු කර නොමැත.';
                results.append(empty);
            } else if (!matchingSubjects.length) {
                const empty = document.createElement('div');
                empty.className = 'empty-state library-empty-state';
                empty.textContent = 'No subjects match your search. Try another word.';
                results.append(empty);
            } else {
                const grid = document.createElement('section');
                grid.className = 'subject-grid';
                grid.setAttribute('aria-label', 'Learning resources');
                for (const subject of matchingSubjects) {
                    const card = document.createElement('article');
                    card.className = 'subject-card';
                    const heading = document.createElement('h3');
                    heading.textContent = subject.title || 'Untitled subject';
                    card.append(heading);
                    const links = document.createElement('div');
                    links.className = 'btn-group';
                    for (const link of subject.links || []) {
                        if (!isSafeResourceUrl(link.url)) continue;
                        const anchor = document.createElement('a');
                        anchor.href = link.url;
                        anchor.target = '_blank';
                        anchor.rel = 'noopener noreferrer';
                        anchor.className = 'btn ' + resourceButtonStyle(link.type);
                        anchor.textContent = link.label || 'Open resource';
                        links.append(anchor);
                    }
                    card.append(links);
                    grid.append(card);
                }
                results.append(grid);
            }

            resultCount.textContent = matchingSubjects.length
                + (matchingSubjects.length === 1 ? ' subject' : ' subjects');
        }

        function renderSelection(updateUrl = true) {
            document.querySelector('.content-heading').innerHTML = headingMarkup[state.category];
            categoryLinks.forEach(link => {
                const selected = link.dataset.category === state.category;
                link.classList.toggle('active', selected);
                if (selected) link.setAttribute('aria-current', 'page');
                else link.removeAttribute('aria-current');
                link.href = '?class=' + encodeURIComponent(link.dataset.category) + '&semNumber=' + state.semester;
            });
            semesterLinks.forEach(link => {
                const selected = link.dataset.semester === state.semester;
                link.classList.toggle('active', selected);
                if (selected) link.setAttribute('aria-current', 'page');
                else link.removeAttribute('aria-current');
                link.href = '?class=' + encodeURIComponent(state.category) + '&semNumber=' + link.dataset.semester;
            });
            renderResources();
            if (updateUrl) {
                const url = new URL(window.location.href);
                url.searchParams.set('class', state.category);
                url.searchParams.set('semNumber', state.semester);
                window.history.pushState({ ...state }, '', url);
            }
        }

        categoryLinks.forEach(link => link.addEventListener('click', event => {
            event.preventDefault();
            state.category = link.dataset.category;
            renderSelection();
        }));
        semesterLinks.forEach(link => link.addEventListener('click', event => {
            event.preventDefault();
            state.semester = link.dataset.semester;
            renderSelection();
        }));
        searchInput.addEventListener('input', renderResources);
        window.addEventListener('popstate', () => {
            const url = new URL(window.location.href);
            const category = url.searchParams.get('class');
            const semester = url.searchParams.get('semNumber');
            if (allowedCategories.has(category)) state.category = category;
            if (/^[1-8]$/.test(semester || '')) state.semester = semester;
            renderSelection(false);
        });
        renderSelection(false);
    </script>
</body>
</html>`);
    } catch (error) {
        console.error('Account route error:', error);
        if (!res.headersSent) {
            if (error.code === 'PORTAL_DATABASE_NOT_CONFIGURED') {
                return renderDatabaseSetupMessage(res);
            }
            if (isDatabaseCertificateError(error)) {
                return renderDatabaseCertificateMessage(res);
            }
            return res.status(500).send('Account service is unavailable. Please try again later.');
        }
    }
}

function isDatabaseCertificateError(error) {
    return ['SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT']
        .includes(error.code);
}

function renderDatabaseSetupMessage(res) {
    return res.status(503).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setup needed - UoVT Student Hub</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/account.css" rel="stylesheet">
</head>
<body>
    <main class="setup-message">
        <p class="account-eyebrow">ONE-TIME WEBSITE SETUP</p>
        <h1>Student accounts are not connected yet.</h1>
        <p>The website admin needs to add the Supabase database connection string before students can sign up or log in.</p>
        <ol>
            <li>In Supabase, open <strong>Project Settings → Database</strong> and copy the PostgreSQL connection string.</li>
            <li>Add it as <code>SUPABASE_DB_CONNECTION_STRING</code> in the local <code>.env.local</code> file or the deployment's environment variables.</li>
            <li>Run the SQL in <code>supabase/schema.sql</code> in Supabase's SQL Editor, then restart or redeploy the website.</li>
        </ol>
        <p class="setup-note">Keep the connection string private. Never paste it into a public chat, website form, or browser code.</p>
        <a class="setup-home-link" href="/">Go back to the home page</a>
    </main>
</body>
</html>`);
}

function renderDatabaseCertificateMessage(res) {
    return res.status(503).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database certificate setup - UoVT Student Hub</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/account.css" rel="stylesheet">
</head>
<body>
    <main class="setup-message">
        <p class="account-eyebrow">DATABASE CONNECTION CHECK</p>
        <h1>The Supabase connection certificate needs setting up.</h1>
        <p>The website has a database connection string, but Node.js cannot verify the certificate Supabase presented. The connection is kept secure; certificate verification has not been disabled.</p>
        <ol>
            <li>In Supabase, open <strong>Project Settings → Database → SSL Configuration</strong> and download the database CA certificate.</li>
            <li>Add the certificate's PEM text, base64 text, or private file path as <code>SUPABASE_DB_CA_CERT</code> in <code>.env.local</code>, then restart the website.</li>
        </ol>
        <p class="setup-note">For deployment, set <code>SUPABASE_DB_CA_CERT</code> to the certificate's PEM or base64 text in the host's private environment variables. Do not turn off certificate verification.</p>
        <a class="setup-home-link" href="/">Go back to the home page</a>
    </main>
</body>
</html>`);
}

async function handleLogin(req, res, store) {
    if (await getSessionUsername(req, store)) return res.redirect(302, '/account');
    if (req.method === 'POST') {
        const username = normalizeUsername(req.body?.username);
        const password = req.body?.password;

        if (username && typeof password === 'string') {
            const user = await store.findUser(username);
            if (user && await verifyPassword(password, user)) {
                if (user.account_active === false) {
                    return renderAuthPage(res, 'login', 'This account has been disabled. Please contact the site administrator.');
                }
                if (user.legacy) {
                    await store.createUser(user);
                }
                await startSession(username, req, res, store);
                return res.redirect(303, '/account');
            }
        }

        return renderAuthPage(res, 'login', 'Username or password is incorrect.');
    }
    if (req.method !== 'GET') return res.status(405).send('Method not allowed.');
    return renderAuthPage(
        res,
        'login',
        req.query.reset === 'success' ? 'Your password has been updated. You can now log in.' : '',
        req.query.reset === 'success' ? 'success' : 'error'
    );
}

async function handleSignup(req, res, store) {
    if (await getSessionUsername(req, store)) return res.redirect(302, '/account');
    if (req.method === 'POST') {
        const username = normalizeUsername(req.body?.username);
        const password = req.body?.password;
        const passwordConfirm = req.body?.passwordConfirm;

        if (!username) {
            return renderAuthPage(res, 'signup', 'Username must be 3–32 characters: letters, numbers, dot, underscore, or hyphen.');
        }
        const organizationOptions = await store.getSignupOrganizationOptions();
        const profileResult = validateStudentProfile(req.body, organizationOptions);
        if (profileResult.error) {
            return renderAuthPage(res, 'signup', profileResult.error);
        }
        if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
            return renderAuthPage(res, 'signup', 'Password must be at least 8 characters long.');
        }
        if (password !== passwordConfirm) {
            return renderAuthPage(res, 'signup', 'Passwords do not match.');
        }
        if (req.body?.termsAccepted !== 'yes') {
            return renderAuthPage(res, 'signup', 'Please agree to the Terms and Conditions and confirm that you have read the Privacy Notice.');
        }

        const salt = randomBytes(16).toString('hex');
        const passwordHash = (await scrypt(password, salt, 64)).toString('hex');
        const created = await store.createUser({
            username,
            salt,
            passwordHash,
            ...profileResult.profile,
            termsAcceptedAt: new Date().toISOString(),
            termsVersion: TERMS_VERSION
        });

        if (!created) {
            return renderAuthPage(res, 'signup', 'That username, university index number, or university email is already registered. Please check your details or log in.');
        }

        await startSession(username, req, res, store);
        return res.redirect(303, '/account');
    }
    if (req.method !== 'GET') return res.status(405).send('Method not allowed.');
    return renderAuthPage(res, 'signup');
}

async function handleCompleteProfile(req, res, store) {
    const username = await getSessionUsername(req, store);
    if (!username) return res.redirect(302, '/account/login');

    const currentProfile = await store.getStudentProfile(username);
    if (isStudentProfileComplete(currentProfile)) return res.redirect(302, '/account');
    if (req.method === 'GET') return renderProfileCompletionPage(res, '', currentProfile);
    if (req.method !== 'POST') return res.status(405).send('Method not allowed.');
    if (currentProfile?.organization_request_status === 'pending') {
        res.status(409);
        return renderProfileCompletionPage(res, '', currentProfile);
    }

    const organizationOptions = await store.getSignupOrganizationOptions();
    const profileResult = validateStudentProfile(req.body, organizationOptions);
    if (profileResult.error) {
        return renderProfileCompletionPage(res, profileResult.error, currentProfile);
    }

    try {
        const updated = await store.updateStudentProfile(username, {
            ...profileResult.profile,
            termsAcceptedAt: new Date().toISOString(),
            termsVersion: TERMS_VERSION
        });
        if (!updated) throw new Error('Student account no longer exists.');
    } catch (error) {
        if (error.code === '23505') {
            return renderProfileCompletionPage(
                res,
                'That university index number or university email is already linked to another account. Please check your details.',
                currentProfile
            );
        }
        throw error;
    }
    return res.redirect(303, '/account');
}

async function handleForgotPassword(req, res, store) {
    if (req.method === 'GET') return renderAuthPage(res, 'forgot');
    if (req.method !== 'POST') return res.status(405).send('Method not allowed.');

    const universityEmail = normalizeUniversityEmail(req.body?.universityEmail);
    if (!universityEmail) {
        return renderAuthPage(res, 'forgot', 'Enter a valid university email address.');
    }

    try {
        await req.app.locals.mailService.prepare();
        const user = await store.findUserByUniversityEmail(universityEmail);
        if (user) {
            const token = randomBytes(32).toString('base64url');
            const created = await store.createPasswordReset(token, user.username, PASSWORD_RESET_TTL_SECONDS);
            if (created) {
                try {
                    await req.app.locals.mailService.sendPasswordReset(universityEmail, token);
                } catch (error) {
                    await store.deletePasswordReset(token);
                    console.error('Password reset email delivery failed:', error.code || 'SMTP_ERROR');
                    return renderAuthPage(
                        res,
                        'forgot',
                        'We could not send a reset email right now. Please try again later or contact the project maintainer.'
                    );
                }
            }
        }

        return renderAuthPage(
            res,
            'forgot',
            'If an account uses that email, a password reset link will be sent. Check your inbox and spam folder.',
            'success'
        );
    } catch (error) {
        if (error.code === 'PORTAL_EMAIL_NOT_CONFIGURED') {
            return renderAuthPage(
                res,
                'forgot',
                'Password recovery is not set up yet. Please ask the site administrator to configure the email service.'
            );
        }
        console.error('Password recovery request failed:', error.code || 'DATABASE_ERROR');
        return renderAuthPage(res, 'forgot', 'Password recovery is temporarily unavailable. Please try again later.');
    }
}

async function handleResetPassword(req, res, store) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const token = req.method === 'POST' ? req.body?.token : req.query.token;
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
        return renderPasswordResetPage(res, '', 'This password reset link is invalid or has expired.');
    }

    if (req.method === 'GET') {
        const username = await store.getPasswordResetUsername(token);
        if (!username) {
            return renderPasswordResetPage(res, '', 'This password reset link is invalid or has expired.');
        }
        return renderPasswordResetPage(res, token);
    }
    if (req.method !== 'POST') return res.status(405).send('Method not allowed.');

    const password = req.body?.password;
    const passwordConfirm = req.body?.passwordConfirm;
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return renderPasswordResetPage(res, token, 'Password must be between 8 and 128 characters.');
    }
    if (password !== passwordConfirm) {
        return renderPasswordResetPage(res, token, 'Passwords do not match.');
    }

    const salt = randomBytes(16).toString('hex');
    const passwordHash = (await scrypt(password, salt, 64)).toString('hex');
    const updated = await store.updatePasswordFromReset(token, salt, passwordHash);
    if (!updated) {
        return renderPasswordResetPage(res, '', 'This password reset link is invalid or has expired.');
    }
    return res.redirect(303, '/account/login?reset=success');
}

async function handleLogout(req, res, store) {
    if (req.method === 'GET') {
        if (!await getSessionUsername(req, store)) return res.redirect(302, '/account/login');
        return res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Logout</title></head>
<body><main><h1>Logout</h1><form action="/account/logout" method="POST"><button type="submit">Logout</button></form><a href="/account">Cancel</a></main></body></html>`);
    }
    if (req.method !== 'POST') return res.status(405).send('Method not allowed.');

    const token = getSessionToken(req);
    if (token) await store.deleteSession(token, 'student');
    res.setHeader('Set-Cookie', makeSessionCookie('', req, true));
    return res.redirect(303, '/account/login');
}

function renderAuthPage(res, componentName, errorMessage = '', messageType = 'error') {
    const errorMarkup = errorMessage
        ? `<p class="auth-message ${messageType === 'success' ? 'success' : ''}" role="${messageType === 'success' ? 'status' : 'alert'}">${escapeHtml(errorMessage)}</p>`
        : '';
    const formMarkup = componentName === 'login'
        ? `<login.comp></login.comp>`
        : componentName === 'signup'
            ? `<signup.comp></signup.comp>`
            : `<forgot.comp></forgot.comp>`;
    const title = componentName === 'login'
        ? 'Log in'
        : componentName === 'signup'
            ? 'Sign up'
            : 'Password recovery';

    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - UoVT Student Hub</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/account.css" rel="stylesheet">
</head>
<body>
    <nav.comp></nav.comp>
    <main class="auth-container"><section class="auth-card${componentName === 'signup' ? ' signup-card' : ''}">
        ${errorMarkup}
        ${formMarkup}
    </section></main>
    <footer.comp></footer.comp>
</body>
</html>`);
}

function renderPasswordResetPage(res, token, message = '') {
    const messageMarkup = message
        ? `<p class="auth-message" role="alert">${escapeHtml(message)}</p>`
        : '';
    const formMarkup = token
        ? `<form action="/account/reset-password" method="POST">
            <input type="hidden" name="token" value="${escapeHtml(token)}">
            <div class="form-group">
                <label for="password">New password</label>
                <input type="password" id="password" name="password" minlength="8" maxlength="128" autocomplete="new-password" required>
            </div>
            <div class="form-group">
                <label for="passwordConfirm">Confirm new password</label>
                <input type="password" id="passwordConfirm" name="passwordConfirm" minlength="8" maxlength="128" autocomplete="new-password" required>
            </div>
            <button type="submit">Update password</button>
        </form>`
        : '';

    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset password - UoVT Student Hub</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/account.css" rel="stylesheet">
</head>
<body>
    <nav.comp></nav.comp>
    <main class="auth-container"><section class="auth-card">
        <h2>Choose a new password</h2>
        ${messageMarkup}
        ${formMarkup}
        <p class="auth-switch"><a href="/account/login">Back to log in</a></p>
    </section></main>
    <footer.comp></footer.comp>
</body>
</html>`);
}

function renderProfileCompletionPage(res, message = '', profile = null) {
    if (profile?.organization_request_status === 'pending') {
        return res.send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Organization verification pending - UoVT Student Hub</title><link href="/css/global.css" rel="stylesheet"><link href="/css/account.css" rel="stylesheet"></head>
<body>
    <nav.comp></nav.comp>
    <main class="auth-container"><section class="auth-card">
        <p class="account-eyebrow">ADMIN REVIEW IN PROGRESS</p>
        <h2>Your campus details are being checked</h2>
        <p class="auth-intro">Your account is created, but the learning library will unlock after an admin verifies this campus, faculty, and department. This helps keep campus names consistent for all students.</p>
        <div class="organization-pending-summary">
            <strong>${escapeHtml(profile.university_name || profile.university || '')}</strong>
            <span>${escapeHtml(profile.faculty || '')} → ${escapeHtml(profile.department || '')}</span>
        </div>
        <form class="completion-logout" action="/account/logout" method="POST"><button class="completion-logout-button" type="submit">Log out</button></form>
    </section></main>
    <footer.comp></footer.comp>
</body>
</html>`);
    }

    if (profile?.organization_request_status === 'rejected' && !message) {
        message = 'The admin could not verify the submitted campus details. Please select an existing option or correct the details and submit them again.';
    }
    const messageMarkup = message
        ? `<p class="auth-message" role="alert">${escapeHtml(message)}</p>`
        : '';
    const semesterOptions = Array.from({ length: 8 }, (_, index) =>
        `<option value="${index + 1}">Semester ${index + 1}</option>`
    ).join('');

    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Complete student profile - UoVT Student Hub</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/account.css" rel="stylesheet">
</head>
<body>
    <nav.comp></nav.comp>
    <main class="auth-container"><section class="auth-card signup-card completion-card">
        <p class="account-eyebrow">ONE-TIME PROFILE UPDATE</p>
        <h2>Complete your student profile</h2>
        <p class="auth-intro">We have updated student registration. Add these details and accept the current Terms and Conditions to continue to your learning library. Your telephone number is optional.</p>
        ${messageMarkup}
        <form action="/account/complete-profile" method="POST">
            <div class="signup-grid">
                <div class="form-group">
                    <label for="universityIndexNo">University index number</label>
                    <input type="text" id="universityIndexNo" name="universityIndexNo" minlength="3" maxlength="32" placeholder="e.g. 2024/ICT/001" autocomplete="off" required>
                </div>
                <fieldset class="organization-selectors" data-organization-form>
                    <legend>University / campus → faculty → department</legend>
                    <div class="form-group">
                        <label for="universityId">University / campus</label>
                        <select id="universityId" name="universityId" required disabled>
                            <option value="">Loading campuses...</option>
                        </select>
                        <input id="universityName" name="universityName" maxlength="100" placeholder="Enter campus name" hidden disabled>
                    </div>
                    <div class="form-group">
                        <label for="facultyId">Faculty</label>
                        <select id="facultyId" name="facultyId" required disabled>
                            <option value="">Choose your campus first</option>
                        </select>
                        <input id="facultyName" name="facultyName" maxlength="100" placeholder="Enter faculty name" hidden disabled>
                    </div>
                    <div class="form-group">
                        <label for="departmentId">Department</label>
                        <select id="departmentId" name="departmentId" required disabled>
                            <option value="">Choose your faculty first</option>
                        </select>
                        <input id="departmentName" name="departmentName" maxlength="100" placeholder="Enter department name" hidden disabled>
                    </div>
                    <small data-organization-status aria-live="polite" hidden></small>
                </fieldset>
                <div class="form-group">
                    <label for="currentSemester">Current semester</label>
                    <select id="currentSemester" name="currentSemester" required>
                        <option value="" selected disabled>Choose your semester</option>
                        ${semesterOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="gender">Gender</label>
                    <select id="gender" name="gender" required>
                        <option value="" selected disabled>Choose an option</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="dateOfBirth">Birthday</label>
                    <input type="date" id="dateOfBirth" name="dateOfBirth" max="${new Date().toISOString().slice(0, 10)}" autocomplete="bday" required>
                </div>
                <div class="form-group">
                    <label for="telephone">Telephone <span class="optional-label">Optional</span></label>
                    <input type="tel" id="telephone" name="telephone" maxlength="24" placeholder="+94 7X XXX XXXX" autocomplete="tel">
                </div>
                <div class="form-group form-group-wide">
                    <label for="universityEmail">University email address</label>
                    <input type="email" id="universityEmail" name="universityEmail" maxlength="254" placeholder="name@university.edu" autocomplete="email" required>
                </div>
            </div>
            <label class="terms-consent">
                <input type="checkbox" name="termsAccepted" value="yes" required>
                <span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms and Conditions</a> and confirm that I have read the <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</a>.</span>
            </label>
            <button type="submit">Save details and continue</button>
        </form>
        <form class="completion-logout" action="/account/logout" method="POST"><button class="completion-logout-button" type="submit">Log out instead</button></form>
    </section></main>
    <footer.comp></footer.comp>
    <script src="/js/organization-selector.js" defer></script>
</body>
</html>`);
}

async function startSession(username, req, res, store) {
    const token = randomBytes(32).toString('base64url');
    await store.createSession(token, username, 'student', SESSION_TTL_SECONDS);
    res.setHeader('Set-Cookie', makeSessionCookie(token, req));
}

function makeSessionCookie(token, req, clear = false) {
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    return `sessionToken=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_TTL_SECONDS}${secure ? '; Secure' : ''}`;
}

function getSessionToken(req) {
    const cookieHeader = req.headers?.cookie || '';
    const sessionCookie = cookieHeader.split(';').map(cookie => cookie.trim()).find(cookie => cookie.startsWith('sessionToken='));
    return sessionCookie ? sessionCookie.slice('sessionToken='.length) : '';
}

async function getSessionUsername(req, store) {
    const token = getSessionToken(req);
    if (!token) return null;
    return store.getSession(token, 'student');
}

function normalizeUsername(value) {
    if (typeof value !== 'string') return null;
    const username = value.trim().toLowerCase();
    return /^[a-z0-9._-]{3,32}$/.test(username) ? username : null;
}

function validateStudentProfile(body, organizationOptions) {
    const universityIndexNo = normalizeUniversityIndexNo(body?.universityIndexNo);
    const universitySelection = typeof body?.universityId === 'string' ? body.universityId : '';
    const facultySelection = typeof body?.facultyId === 'string' ? body.facultyId : '';
    const departmentSelection = typeof body?.departmentId === 'string' ? body.departmentId : '';
    const currentSemester = Number(body?.currentSemester);
    const gender = body?.gender;
    const dateOfBirth = body?.dateOfBirth;
    const telephone = normalizeTelephone(body?.telephone);
    const universityEmail = normalizeUniversityEmail(body?.universityEmail);

    if (!universityIndexNo) {
        return { error: 'Enter a valid university index number (letters, numbers, slash, or hyphen).' };
    }
    const university = organizationOptions.universities.find(item => String(item.id) === universitySelection);
    const faculty = organizationOptions.faculties.find(item =>
        String(item.id) === facultySelection && String(item.university_id) === universitySelection
    );
    const department = organizationOptions.departments.find(item =>
        String(item.id) === departmentSelection && faculty && String(item.faculty_id) === String(faculty.id)
    );
    const newUniversity = universitySelection === '__new__';
    const newFaculty = facultySelection === '__new__';
    const newDepartment = departmentSelection === '__new__';

    if ((!newUniversity && !university)
        || (!newFaculty && !faculty)
        || (!newDepartment && !department)
        || (newUniversity && (!newFaculty || !newDepartment))
        || (newFaculty && !newDepartment)) {
        return { error: 'Choose a campus, faculty, and department from the lists, or choose “Not listed” to request a new option.' };
    }
    const universityName = newUniversity
        ? normalizeOrganizationRequestName(body?.universityName)
        : university.name;
    const facultyName = newFaculty
        ? normalizeOrganizationRequestName(body?.facultyName)
        : faculty.name;
    const departmentName = newDepartment
        ? normalizeOrganizationRequestName(body?.departmentName)
        : department.name;
    if (!universityName || !facultyName || !departmentName) {
        return { error: 'Enter valid campus, faculty, and department names for the new option.' };
    }
    if (!Number.isInteger(currentSemester) || currentSemester < 1 || currentSemester > 8) {
        return { error: 'Choose your current semester.' };
    }
    if (!GENDER_OPTIONS.includes(gender)) {
        return { error: 'Choose a gender option or select “Prefer not to say”.' };
    }
    if (!isValidBirthDate(dateOfBirth)) {
        return { error: 'Enter a valid birthday that is not in the future.' };
    }
    if (body?.telephone && !telephone) {
        return { error: 'Enter a valid telephone number, or leave that optional field blank.' };
    }
    if (!universityEmail) {
        return { error: 'Enter a valid university email address. We use it for password recovery.' };
    }
    if (body?.termsAccepted !== 'yes') {
        return { error: 'Please agree to the Terms and Conditions and confirm that you have read the Privacy Notice.' };
    }

    return {
        profile: {
            universityIndexNo,
            universityId: newUniversity ? null : university.id,
            universityName,
            facultyName,
            departmentName,
            department: departmentName,
            faculty: facultyName,
            departmentId: newDepartment ? null : department.id,
            currentSemester,
            gender,
            dateOfBirth,
            telephone,
            universityEmail
        }
    };
}

function normalizeOrganizationRequestName(value) {
    if (typeof value !== 'string') return null;
    const name = value.trim().replace(/\s+/g, ' ');
    return name.length >= 2 && name.length <= 100 && !/[\r\n<>]/.test(name) ? name : null;
}

function isStudentProfileComplete(profile) {
    return Boolean(
        profile?.university_index_no
        && profile.department
        && profile.university_id
        && profile.faculty
        && profile.department_id
        && profile.current_semester
        && profile.gender
        && profile.date_of_birth
        && profile.university_email
        && profile.terms_accepted_at
    );
}

function normalizeUniversityIndexNo(value) {
    if (typeof value !== 'string') return null;
    const indexNo = value.trim().toUpperCase();
    return /^[A-Z0-9][A-Z0-9/-]{2,31}$/.test(indexNo) ? indexNo : null;
}

function normalizeUniversityEmail(value) {
    if (typeof value !== 'string') return null;
    const email = value.trim().toLowerCase();
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizeTelephone(value) {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') return null;
    const telephone = value.trim();
    if (!telephone) return '';
    return /^[+0-9() .-]{7,24}$/.test(telephone)
        && (telephone.match(/[0-9]/g) || []).length >= 7
        ? telephone
        : null;
}

function isValidBirthDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime())
        && date.toISOString().slice(0, 10) === value
        && value <= new Date().toISOString().slice(0, 10);
}

async function verifyPassword(password, user) {
    const expectedHash = Buffer.from(user.passwordHash, 'hex');
    if (expectedHash.length !== 64) return false;
    const actualHash = await scrypt(password, user.salt, 64);
    return timingSafeEqual(actualHash, expectedHash);
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

class content {
    static getPageHeader(pageClass) {
        const headers = {
            lectureVideo: '<h2>Lecture Videos අංශය</h2><p>ඔබගේ අධ්‍යයන වර්ෂයට අදාළ දේශන වීඩියෝ සහ ප්ලේලිස්ට් මෙහි ඇත.</p>',
            pastPaper: '<h2>Past Papers අංශය</h2><p>පසුගිය විභාග ප්‍රශ්න පත්‍ර සහ පිළිතුරු මෙහි ඇත.</p>',
            lecturePresenNote: '<h2>Presentations & Notes</h2><p>දේශන සටහන් සහ විනිවිදක (Slides) මෙහි ඇත.</p>',
            shortNote: '<h2>Short Notes</h2><p>විභාගය සඳහා වැදගත් කෙටි සටහන් මෙහි ඇත.</p>'
        };
        return headers[pageClass] || '<h2>සාදරයෙන් පිළිගනිමු!</h2><p>කරුණාකර වම්පස මෙනුවෙන් අංශයක් තෝරන්න.</p>';
    }

    static renderSemesterTabs(semNumber, pageClass) {
        let html = '<section class="semester-tabs">';
        html += '<div class="semester-tabs-heading"><div><p class="control-eyebrow">YOUR STUDY PLAN</p><h3>Semester එක තෝරන්න:</h3></div><p>Switch instantly without reloading the library.</p></div>';
        html += '<div class="semester-tabs-list">';
        
        for (let i = 1; i <= 8; i++) {
            const isActive = String(semNumber) === String(i);
            html += `<a href="?class=${pageClass}&semNumber=${i}" data-semester="${i}" class="semester-tab${isActive ? ' active' : ''}"${isActive ? ' aria-current="page"' : ''}>Sem ${i}</a>`;
        }
        
        return `${html}</div></section>`;
    }

    static serializeForScript(value) {
        return JSON.stringify(value)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029');
    }

    static getButtonStyle(type) {
        switch (type) {
            case 'yt': return 'btn-yt';
            case 'telegram': return 'btn-telegram';
            case 'drive': return 'btn-drive';
            case 'whatsapp': return 'btn-whatsapp';
            default: return 'btn-default';
        }
    }

    static async getDatabase(store, departmentId) {
        return store.getPortalDatabase(departmentId);
    }

    static renderSubjectsContent(db, pageClass, semNumber) {
        const subjects = db[pageClass]?.[semNumber] || [];

        if (subjects.length === 0) {
            return `<div class="empty-state">
                <p>මෙම සෙමෙස්ටර් එක සඳහා තවදුරටත් දත්ත එකතු කර නොමැත.</p>
            </div>`;
        }

        let html = `<h2 class="subject-list-title">Semester ${semNumber} subjects</h2><section class="subject-grid" aria-label="Learning resources">`;
        subjects.forEach(sub => {
            html += `<div class="subject-card"><h4>${escapeHtml(String(sub.title || ''))}</h4><div class="btn-group">`;
            if (Array.isArray(sub.links)) {
                sub.links.forEach(link => {
                    const url = safeHttpsUrl(link.url);
                    if (url) {
                        html += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn ${this.getButtonStyle(link.type)}">${escapeHtml(String(link.label || 'Link'))}</a>`;
                    }
                });
            }
            html += '</div></div>';
        });
        return `${html}</section><p id="noSearchResults" class="empty-state search-empty" hidden>No subjects match your search. Try another word.</p>`;
    }
}

function safeHttpsUrl(value) {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.toString() : null;
    } catch {
        return null;
    }
}
