export default function(req, res) {
    res.send(`
        <!DOCTYPE html>
        <html lang="si">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="description" content="Explore UoVT student learning resources: lecture videos, past papers, lecture notes and short notes organised by semester.">
            <title>Student services | UoVT Student Hub</title>
            <link href="/css/global.css" rel="stylesheet">
            <link href="/css/content.css" rel="stylesheet">
        </head>
        <body>
            <nav.comp></nav.comp>
            <main class="services-page">
                <section class="services-hero">
                    <p class="services-eyebrow">YOUR STUDY TOOLKIT</p>
                    <h1>Study resources, all in one place.</h1>
                    <p>Browse useful learning materials for your UoVT subjects. Pick a resource type, choose your semester, and get straight to studying.</p>
                    <a class="services-button" href="/account">Explore the student library <span aria-hidden="true">→</span></a>
                    <div class="services-hero-note"><span aria-hidden="true">✓</span> Organised by resource type and semester</div>
                </section>

                <section class="services-resources" aria-labelledby="resourcesTitle">
                    <div class="services-section-heading">
                        <p class="services-eyebrow">WHAT YOU CAN FIND</p>
                        <h2 id="resourcesTitle">Four ways to support your studies</h2>
                        <p>Choose the material you need. Available links are grouped by subject inside the student library.</p>
                    </div>
                    <div class="services-grid">
                        <article class="services-card">
                            <span class="services-icon video-icon" aria-hidden="true">▶</span>
                            <p class="services-card-label">WATCH & LEARN</p>
                            <h3>Lecture videos</h3>
                            <p>Revisit topics and learn at your own pace with lecture playlists and video links.</p>
                            <a href="/account?class=lectureVideo&amp;semNumber=1">Browse lecture videos <span aria-hidden="true">→</span></a>
                        </article>
                        <article class="services-card">
                            <span class="services-icon paper-icon" aria-hidden="true">▤</span>
                            <p class="services-card-label">PRACTISE & PREPARE</p>
                            <h3>Past papers</h3>
                            <p>Find practice papers by subject to help you prepare for upcoming assessments.</p>
                            <a href="/account?class=pastPaper&amp;semNumber=1">Browse past papers <span aria-hidden="true">→</span></a>
                        </article>
                        <article class="services-card">
                            <span class="services-icon notes-icon" aria-hidden="true">▧</span>
                            <p class="services-card-label">REVIEW THE LESSON</p>
                            <h3>Lecture notes</h3>
                            <p>Open shared lecture notes and presentation slides for a quick lesson recap.</p>
                            <a href="/account?class=lecturePresenNote&amp;semNumber=1">Browse lecture notes <span aria-hidden="true">→</span></a>
                        </article>
                        <article class="services-card">
                            <span class="services-icon short-icon" aria-hidden="true">✎</span>
                            <p class="services-card-label">REVISE THE ESSENTIALS</p>
                            <h3>Short notes</h3>
                            <p>Review concise study notes that make it easier to revisit important topics.</p>
                            <a href="/account?class=shortNote&amp;semNumber=1">Browse short notes <span aria-hidden="true">→</span></a>
                        </article>
                    </div>
                    <p class="services-access-note">Sign in to browse the library. Your semester can be changed inside each resource section.</p>
                </section>

                <section class="services-how" aria-labelledby="howTitle">
                    <div class="services-section-heading">
                        <p class="services-eyebrow">GET STARTED IN THREE STEPS</p>
                        <h2 id="howTitle">Less searching. More studying.</h2>
                    </div>
                    <ol class="services-steps">
                        <li><span>01</span><div><h3>Open your library</h3><p>Sign in or create a student account to get started.</p></div></li>
                        <li><span>02</span><div><h3>Choose a resource</h3><p>Select videos, past papers, lecture notes or short notes.</p></div></li>
                        <li><span>03</span><div><h3>Pick your semester</h3><p>Browse the subjects and open a resource link to study.</p></div></li>
                    </ol>
                </section>

                <section class="services-cta">
                    <div>
                        <p class="services-eyebrow">READY WHEN YOU ARE</p>
                        <h2>Your next study session starts here.</h2>
                        <p>Head to the student library and find materials for your semester.</p>
                    </div>
                    <a class="services-button" href="/account">Go to the student library <span aria-hidden="true">→</span></a>
                </section>
            </main>
            <footer.comp></footer.comp>
        </body>
        </html>
    `);
}