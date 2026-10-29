export default function(req, res) {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Learn why a UoVT student created this independent learning-resource hub for the benefit of fellow students.">
    <title>About this student project | UoVT Student Hub</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/content.css" rel="stylesheet">
</head>
<body>
    <nav.comp></nav.comp>
    <main class="info-page">
        <section class="info-hero">
            <p class="info-eyebrow">ABOUT THIS PROJECT</p>
            <h1>Made by a UoVT student, for fellow students.</h1>
            <p>This independent student project brings useful learning links together, so UoVT students can spend less time searching and more time studying.</p>
            <a class="info-button" href="/services">See what you can find <span aria-hidden="true">→</span></a>
        </section>

        <div class="info-content">
            <section class="info-section">
                <p class="info-eyebrow">WHY IT EXISTS</p>
                <h2>One easier place to find study materials.</h2>
                <p>Lecture videos, past papers, lecture notes and short notes can be scattered across different links and conversations. This hub is intended to make those shared learning resources easier for students to browse by category and semester.</p>
            </section>

            <section class="info-highlight">
                <span class="info-highlight-icon" aria-hidden="true">✦</span>
                <div>
                    <h2>A student initiative—not an official UoVT website.</h2>
                    <p>This website was created and is maintained independently by a UoVT student for the benefit of fellow students. It is not operated, approved, or officially affiliated with the University of Vocational Technology (UoVT). For official university information, please visit <a href="https://uovt.ac.lk" target="_blank" rel="noopener noreferrer">the UoVT website</a>.</p>
                </div>
            </section>

            <section class="info-section">
                <p class="info-eyebrow">HOW TO USE IT</p>
                <h2>Browse at your own pace.</h2>
                <div class="info-feature-grid">
                    <article class="info-feature">
                        <span aria-hidden="true">01</span>
                        <h3>Choose a resource</h3>
                        <p>Open the student library and select videos, past papers, lecture notes, or short notes.</p>
                    </article>
                    <article class="info-feature">
                        <span aria-hidden="true">02</span>
                        <h3>Select a semester</h3>
                        <p>Browse the resources shared for the semester and subject you are studying.</p>
                    </article>
                    <article class="info-feature">
                        <span aria-hidden="true">03</span>
                        <h3>Use shared links</h3>
                        <p>Study materials may open on third-party websites. Check each link before relying on it.</p>
                    </article>
                </div>
            </section>

            <section class="info-bottom-cta">
                <div>
                    <h2>Ready to find a resource?</h2>
                    <p>Open the library or learn more about the available student services.</p>
                </div>
                <div class="info-cta-links">
                    <a class="info-button" href="/account">Open student library <span aria-hidden="true">→</span></a>
                    <a class="info-text-link" href="/contact">Contact about this project</a>
                </div>
            </section>
        </div>
    </main>
    <footer.comp></footer.comp>
</body>
</html>`);
}
