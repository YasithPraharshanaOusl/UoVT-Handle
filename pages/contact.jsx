export default function(req, res) {
    const contactEmail = typeof process.env.CONTACT_EMAIL === 'string'
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.CONTACT_EMAIL)
        ? process.env.CONTACT_EMAIL
        : '';
    const contactMarkup = contactEmail
        ? `<a class="contact-email-link" href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>`
        : `<p class="contact-unavailable">A project contact email has not been published yet. Please check back later; no university contact address is being presented as support for this independent student project.</p>`;

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Contact the student maintainer about a broken learning-resource link or an issue with the UoVT Student Hub.">
    <title>Contact the project maintainer | UoVT Student Hub</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/content.css" rel="stylesheet">
</head>
<body>
    <nav.comp></nav.comp>
    <main class="info-page">
        <section class="info-hero contact-hero">
            <p class="info-eyebrow">GET IN TOUCH</p>
            <h1>Help make this student resource hub better.</h1>
            <p>Found a broken link or something that could be clearer? A useful report helps the student maintainer improve this project for everyone.</p>
        </section>

        <div class="info-content contact-content">
            <section class="contact-card">
                <span class="contact-icon" aria-hidden="true">✉</span>
                <p class="info-eyebrow">PROJECT FEEDBACK</p>
                <h2>Contact the student maintainer</h2>
                ${contactMarkup}
                <p class="contact-detail">For a broken resource, include the page link, category, semester and subject name. Please do not send your password or other private account information.</p>
            </section>

            <aside class="contact-side-note">
                <h2>Independent student project</h2>
                <p>This hub was created by a UoVT student for the benefit of fellow students. It is not an official UoVT support channel.</p>
                <a href="/about">Learn more about the project <span aria-hidden="true">→</span></a>
                <a href="https://uovt.ac.lk" target="_blank" rel="noopener noreferrer">Visit the official UoVT website <span aria-hidden="true">↗</span></a>
            </aside>
        </div>
    </main>
    <footer.comp></footer.comp>
</body>
</html>`);
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
