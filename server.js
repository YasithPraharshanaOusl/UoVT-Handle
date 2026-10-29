import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import esbuild from 'esbuild';
import { createPortalStore } from './lib/portal-store.js';
import { createMailService } from './lib/mail-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.locals.portalStore = createPortalStore();
app.locals.mailService = createMailService();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use((req, res, next) => {
    const send = res.send.bind(res);
    res.send = body => {
        if (typeof body !== 'string' || !body.includes('</body>') || body.includes('/js/site-preferences.js')) {
            return send(body);
        }
        const head = '<link rel="stylesheet" href="/css/theme.css">';
        const scripts = '<script src="/js/site-preferences.js" defer></script>';
        const html = body
            .replace('</head>', head + '</head>')
            .replace('</body>', scripts + '</body>');
        return send(html);
    };
    next();
});
const DEFAULT_PORT = Number(process.env.PORT) || 5000;

const pagesDir = path.join(__dirname, 'pages');
const componentsDir = path.join(__dirname, 'component');

// 1. .jsx ගොනු කෙලින්ම URL එකෙන් ඉල්ලීම වැළැක්වීම (Security)
app.use((req, res, next) => {
    if (req.path.endsWith('.jsx')) {
        return res.status(404).send('Page not found');
    }
    next();
});

// 2. ෆ්‍රන්ට්එන්ඩ් ස්ථාවර ගොනු (CSS, Images ආදී) සඳහා static middleware එක
app.use(express.static(pagesDir));

// 3. /submit සහ සාමාන්‍ය පිටු හැසිරවීම සඳහා පොදු කාර්ය රවුටරය
const handleJsxPage = async (pageName, req, res, next) => {
    const filePath = path.join(pagesDir, `${pageName}.jsx`);

    if (fs.existsSync(filePath)) {
        try {
            let fileContent = fs.readFileSync(filePath, 'utf8');

            // Custom Components (<tag.comp></tag.comp>) ස්වයංක්‍රීයව ප්‍රතිස්ථාපනය කිරීම
            const componentPattern = /<([a-zA-Z0-9_-]+)\.comp\s*>\s*<\/\1\.comp>/g;
            const componentMatches = [...fileContent.matchAll(componentPattern)];

            for (const [componentTag, tagName] of componentMatches) {
                const componentPath = path.join(componentsDir, `${tagName}.comp.jsx`);
                if (fs.existsSync(componentPath)) {
                    const componentSource = fs.readFileSync(componentPath, 'utf8');
                    
                    // esbuild මඟින් කම්පොනන්ට් එක ට්‍රාන්ස්ෆෝම් කර ගැනීම
                    const compiledComponent = await esbuild.transform(componentSource, {
                        loader: 'jsx',
                        format: 'esm',
                        target: 'node20',
                    });

                    // ඩේටා යූආර්එල් එකක් හරහා කම්පොනන්ට් මොඩියුලය లోඩ් කර ගැනීම
                    const componentUrl = `data:text/javascript;base64,${Buffer.from(compiledComponent.code).toString('base64')}`;
                    const componentModule = await import(componentUrl);
                    
                    if (typeof componentModule.default === 'function') {
                        const componentMarkup = componentModule.default();
                        fileContent = fileContent.replace(componentTag, componentMarkup);
                    }
                }
            }

            // esbuild.build හරහා ප්‍රධාන .jsx පිටුව කම්පයිල් කිරීම
            const result = await esbuild.build({
                stdin: {
                    contents: fileContent,
                    loader: 'jsx',
                    resolveDir: path.dirname(filePath),
                },
                bundle: false,
                write: false,
                format: 'esm',
                target: 'node20',
                banner: { js: '/* auto-imported components */' }
            });

            const outputCode = result.outputFiles[0].text;
            const dataUrl = `data:text/javascript;base64,${Buffer.from(outputCode).toString('base64')}`;
            const jsxModule = await import(dataUrl);

            if (typeof jsxModule.default === 'function') {
                return await jsxModule.default(req, res);
            }

            return res.status(500).send('Error: .jsx file must export a default function.');
        } catch (error) {
            console.error("Server Error in .jsx file:", error);
            return res.status(500).send('Server Error in .jsx file: ' + error.message);
        }
    }

    next();
};

app.all('/account/:action?', async (req, res, next) => {
    await handleJsxPage('account', req, res, next);
});

app.get('/api/departments', async (req, res) => {
    try {
        const departments = await app.locals.portalStore.getActiveDepartments();
        return res.json(departments.map(department => ({
            id: department.id,
            name: department.name,
            faculty: department.faculty,
            university: department.university,
            universityId: department.university_id,
            isUovt: department.is_uovt
        })));
    } catch (error) {
        console.error('Department list request failed:', error);
        return res.status(503).json({ error: 'The department list is temporarily unavailable.' });
    }
});

app.get('/api/organization-options', async (req, res) => {
    try {
        const store = app.locals.portalStore;
        await store.initialize();
        res.setHeader('Cache-Control', 'no-store');
        return res.json(await store.getSignupOrganizationOptions());
    } catch (error) {
        console.error('Organization option request failed:', error);
        return res.status(503).json({ error: 'Campus, faculty, and department choices are temporarily unavailable.' });
    }
});

app.get('/api/translations', async (req, res) => {
    try {
        const locale = ['english', 'sinhala', 'combined'].includes(req.query.locale)
            ? req.query.locale
            : 'combined';
        const translations = await app.locals.portalStore.getTranslationMap();
        const map = Object.fromEntries(translations.map(item => {
            const value = locale === 'sinhala'
                ? item.sinhala_text || item.english_text
                : locale === 'english'
                    ? item.english_text || item.sinhala_text
                    : item.combined_text || item.sinhala_text || item.english_text;
            return [item.source_text, value || item.source_text];
        }));
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ locale, translations: map });
    } catch (error) {
        console.error('Translation lookup failed:', error);
        return res.status(503).json({ error: 'Language choices are temporarily unavailable.' });
    }
});

app.get('/admin/api/stats', async (req, res) => {
    try {
        const store = app.locals.portalStore;
        if (!await isAdminAuthenticated(req, store)) {
            return res.status(401).json({ error: 'Admin authentication is required.' });
        }
        await store.initialize();
        res.setHeader('Cache-Control', 'no-store');
        return res.json(await store.getAdminDashboardStats());
    } catch (error) {
        console.error('Admin dashboard statistics request failed:', error);
        return res.status(503).json({ error: 'Dashboard statistics are temporarily unavailable.' });
    }
});

app.all('/admin/:action?', async (req, res, next) => {
    const action = req.params.action || 'index';
    const pages = {
        dashboard: 'admin/dashboard',
        users: 'admin/users',
        translator: 'admin/translator',
        submit: 'admin/submit',
        settings: 'admin/settings',
        login: 'admin/login',
        logout: 'admin/login'
    };
    const pageName = action === 'index'
        ? 'admin/login'
        : pages[action];
    if (!pageName) return res.status(404).send('Admin page not found.');
    await handleJsxPage(pageName, req, res, next);
});

app.all('/submit', async (req, res, next) => {
    if (req.method === 'GET') return res.redirect(302, '/admin/submit');
    req.params.action = 'submit';
    await handleJsxPage('admin/submit', req, res, next);
});

app.all('/login', async (req, res, next) => {
    await handleJsxPage('login', req, res, next);
});

async function isAdminAuthenticated(req, store) {
    const cookieHeader = req.headers?.cookie || '';
    const cookie = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith('adminSessionToken='));
    if (!cookie) return false;
    const username = await store.getSession(cookie.slice('adminSessionToken='.length), 'admin');
    return typeof username === 'string' && username === process.env.ADMIN_USERNAME;
}

// අනෙකුත් සියලුම පිටු සඳහා රවුටරය
app.get('/:page?', async (req, res, next) => {
    let pageName = req.params.page || 'index';

    if (pageName.endsWith('.jsx')) {
        pageName = pageName.replace(/\.jsx$/, '');
    }

    await handleJsxPage(pageName, req, res, next);
});

// 4. සියලුම නොපවතින පිටු සඳහා අභිරුචි (Custom) 404 Handler එක
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>404 - Not Found</title>
            <link href="/css/global.css" rel="stylesheet">
        </head>
        <body class="error-page">
            <h1>404</h1>
            <p>Oops! ඔබ ඉල්ලන පිටුව හමුවුණේ නැත.</p>
            <a href="/">මුල් පිටුවට යන්න</a>
        </body>
        </html>
    `);
});

const startServer = (port = DEFAULT_PORT, attempts = 0) => {
    const server = app.listen(port, () => {
        console.log('Server running on http://localhost:' + port);
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE' && attempts < 10) {
            console.warn(`Port ${port} is busy. Trying ${port + 1}...`);
            server.close(() => startServer(port + 1, attempts + 1));
            return;
        }

        throw error;
    });
};

if (!process.env.VERCEL) {
    startServer();
}

export default app;