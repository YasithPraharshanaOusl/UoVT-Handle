export default function(req, res) {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>UoVT Student Hub | Learning resources</title>
            <link href="/css/global.css" rel="stylesheet">
            <link href="/css/content.css" rel="stylesheet">
        </head>
        <body>
            <nav.comp></nav.comp>

            <main>
                <section class="home-hero">
                    <div class="home-hero-content">
                        <p class="home-eyebrow">A STUDENT-FRIENDLY LEARNING SPACE</p>
                        <h1>Make every semester easier.</h1>
                        <p>Find lecture videos, past papers and notes for your UoVT studies, all in one organised place.</p>
                        <div class="home-actions">
                            <a class="home-button primary" href="/account">Explore learning resources</a>
                            <a class="home-button secondary" href="/account/signup">Create a free account</a>
                        </div>
                        <p class="home-note">Already have an account? <a href="/account/login">Log in</a></p>
                    </div>
                    <div class="home-visual" aria-hidden="true">
                        <div class="study-card">
                            <span class="study-card-icon">▤</span>
                            <strong>Your study library</strong>
                            <span>Resources by subject & semester</span>
                            <div class="study-card-row"><span>Lecture videos</span><span>↗</span></div>
                            <div class="study-card-row"><span>Past papers</span><span>↗</span></div>
                            <div class="study-card-row"><span>Notes & slides</span><span>↗</span></div>
                        </div>
                    </div>
                </section>

                <section class="home-features" aria-labelledby="featuresTitle">
                    <p class="home-eyebrow">BUILT FOR YOUR STUDY ROUTINE</p>
                    <h2 id="featuresTitle">Everything you need to stay on track</h2>
                    <div class="feature-grid">
                        <article class="feature-card">
                            <span class="feature-icon" aria-hidden="true">▶</span>
                            <h3>Learn at your pace</h3>
                            <p>Open lecture playlists and revisit topics whenever you need a refresher.</p>
                        </article>
                        <article class="feature-card">
                            <span class="feature-icon" aria-hidden="true">▤</span>
                            <h3>Prepare with past papers</h3>
                            <p>Find practice material arranged by course category and semester.</p>
                        </article>
                        <article class="feature-card">
                            <span class="feature-icon" aria-hidden="true">▧</span>
                            <h3>Keep resources organised</h3>
                            <p>Browse lecture notes, slides and short notes without hunting through chats.</p>
                        </article>
                    </div>
                </section>
            </main>
            <footer.comp></footer.comp>
        </body>
        </html>
    `);
}