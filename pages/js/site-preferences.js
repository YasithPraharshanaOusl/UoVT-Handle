(async function initializeSitePreferences() {
    const locales = ['combined', 'sinhala', 'english'];
    const localeLabels = {
        combined: 'සිංහල + English',
        sinhala: 'සිංහල',
        english: 'English'
    };
    const storage = {
        locale: 'uovt-language',
        theme: 'uovt-theme'
    };
    const originalText = new WeakMap();
    const originalAttributes = new WeakMap();
    const style = document.documentElement;
    const controls = document.createElement('div');
    controls.className = 'site-preference-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Display settings');
    controls.innerHTML = `
        <button class="site-preference-trigger" type="button" aria-label="Display settings" aria-expanded="false" aria-controls="sitePreferencePanel">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"></path>
                <path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z"></path>
            </svg>
        </button>
        <section class="site-preference-panel" id="sitePreferencePanel" aria-label="Display preferences" hidden>
            <p class="site-preference-title">Display preferences</p>
            <label class="site-language-control">
                <span>Language / භාෂාව</span>
                <select aria-label="Choose language"></select>
            </label>
            <button class="site-theme-toggle" type="button" aria-pressed="false"></button>
        </section>`;
    const trigger = controls.querySelector('.site-preference-trigger');
    const panel = controls.querySelector('.site-preference-panel');
    const language = controls.querySelector('select');
    const themeButton = controls.querySelector('.site-theme-toggle');
    locales.forEach(locale => language.add(new Option(localeLabels[locale], locale)));
    document.body.append(controls);

    let activeTranslations = {};
    let observer;
    let languageRequest = 0;

    function currentText(node) {
        if (!originalText.has(node)) originalText.set(node, node.nodeValue);
        const source = originalText.get(node);
        const trimmed = source.trim();
        if (!trimmed) return;
        const translated = activeTranslations[trimmed];
        const value = translated ? source.replace(trimmed, translated) : source;
        if (node.nodeValue !== value) node.nodeValue = value;
    }

    function translateAttribute(element, attribute) {
        if (!originalAttributes.has(element)) originalAttributes.set(element, {});
        const attributes = originalAttributes.get(element);
        if (!(attribute in attributes)) attributes[attribute] = element.getAttribute(attribute);
        const source = attributes[attribute];
        if (!source) return;
        const translated = activeTranslations[source.trim()];
        const value = translated ? source.replace(source.trim(), translated) : source;
        if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
    }

    function translateNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            currentText(node);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const element = node;
        if (element.closest('script, style, textarea, [data-no-translate], .site-preference-controls')) return;
        ['placeholder', 'title', 'aria-label'].forEach(attribute => {
            if (element.hasAttribute(attribute)) translateAttribute(element, attribute);
        });
        if (element.matches('input[type="submit"], input[type="button"]') && element.hasAttribute('value')) {
            translateAttribute(element, 'value');
        }
        element.childNodes.forEach(translateNode);
    }

    function renderTheme(theme) {
        const dark = theme === 'dark';
        style.dataset.theme = dark ? 'dark' : 'light';
        themeButton.setAttribute('aria-pressed', String(dark));
        themeButton.textContent = dark ? '☀ Light mode' : '☾ Dark mode';
    }

    async function renderLanguage(locale) {
        if (!locales.includes(locale)) locale = 'combined';
        const requestId = ++languageRequest;
        language.value = locale;
        localStorage.setItem(storage.locale, locale);
        try {
            const response = await fetch('/api/translations?locale=' + encodeURIComponent(locale), {
                headers: { Accept: 'application/json' },
                cache: 'no-store'
            });
            if (!response.ok) throw new Error('Language translations could not be loaded.');
            const payload = await response.json();
            if (requestId !== languageRequest) return;
            activeTranslations = payload.translations || {};
            language.removeAttribute('aria-invalid');
            if (observer) observer.disconnect();
            translateNode(document.body);
            observer = new MutationObserver(records => records.forEach(record => {
                record.addedNodes.forEach(translateNode);
                if (record.type === 'characterData') currentText(record.target);
                if (record.type === 'attributes') translateAttribute(record.target, record.attributeName);
            }));
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['placeholder', 'title', 'aria-label', 'value']
            });
        } catch (error) {
            if (requestId !== languageRequest) return;
            console.error('Language preference error:', error);
            language.setAttribute('aria-invalid', 'true');
        }
    }

    language.addEventListener('change', () => renderLanguage(language.value));
    themeButton.addEventListener('click', () => {
        const theme = style.dataset.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem(storage.theme, theme);
        renderTheme(theme);
    });
    trigger.addEventListener('click', () => {
        const open = trigger.getAttribute('aria-expanded') !== 'true';
        trigger.setAttribute('aria-expanded', String(open));
        panel.hidden = !open;
        controls.classList.toggle('is-open', open);
    });
    document.addEventListener('pointerdown', event => {
        if (!controls.contains(event.target) && !panel.hidden) {
            panel.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            controls.classList.remove('is-open');
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) {
            panel.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            controls.classList.remove('is-open');
            trigger.focus();
        }
    });

    renderTheme(localStorage.getItem(storage.theme) || 'light');
    await renderLanguage(localStorage.getItem(storage.locale) || 'combined');
})();
