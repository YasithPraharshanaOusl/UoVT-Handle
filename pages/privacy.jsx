export default function(req, res) {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="A plain-language overview of account information, session cookies, database storage and third-party links on this student project.">
    <title>Privacy | UoVT Student Hub</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/content.css" rel="stylesheet">
</head>
<body>
    <nav.comp></nav.comp>
    <main class="info-page">
        <section class="info-hero info-hero-compact">
            <p class="info-eyebrow">PLAIN-LANGUAGE NOTICE</p>
            <h1>Your privacy matters.</h1>
            <p>This notice explains what this student-run learning-resource website handles when you create an account or browse shared links.</p>
        </section>

        <div class="info-content legal-content">
            <p class="info-last-updated">Last updated: 29 October 2026</p>
            <section class="legal-section">
                <h2>About this website</h2>
                <p>This is an independent project created by a UoVT student for the benefit of fellow students. It is not an official University of Vocational Technology (UoVT) website or service.</p>
            </section>
            <section class="legal-section">
                <h2>Information used for student accounts</h2>
                <p>To create an account, the website asks for a username, university index number, department and its faculty, current semester, gender, date of birth and university email address. The faculty is linked automatically to the department selected from the administrator-managed list. A telephone number is optional. Please choose “Prefer not to say” if you do not want to state a gender.</p>
                <p>This information is stored in the project's Supabase database and is used to create and maintain your student account and support password recovery. Your profile details are not shown on public pages or to other student accounts. The project maintainer can access the information to operate the service. Do not enter information that is not needed for your student account.</p>
                <p>The password is stored as a salted password hash; the original password is not stored as plain text. Do not use a password that you use for another important account.</p>
            </section>
            <section class="legal-section">
                <h2>Sign-in cookies and sessions</h2>
                <p>After sign-in, the website uses an HttpOnly session cookie to keep your account signed in. The session token is stored as a hash in the project's database and expires after its set lifetime. Signing out ends the session and clears the cookie.</p>
            </section>
            <section class="legal-section">
                <h2>Password recovery emails</h2>
                <p>If you request a password reset, the website checks the university email address saved on your account and may send a single-use reset link. Reset links expire after 30 minutes. The website stores a hash of the reset token, not the usable token itself; using a reset link changes your password and signs out your existing student sessions.</p>
            </section>
            <section class="legal-section">
                <h2>Learning resources and external websites</h2>
                <p>Resource links are stored in the project's database so they can be listed by category, semester and subject. When you open a link, you leave this website and the destination's privacy practices apply. Review that website before sharing information or downloading files.</p>
            </section>
            <section class="legal-section">
                <h2>Hosting and technical information</h2>
                <p>The website uses Supabase to store account profile, session and resource records. A configured email provider is used to deliver password-reset links. The hosting platform or service providers may process basic technical information needed to deliver and protect the website. This is a student project, not an official university system.</p>
                <p>Please do not send passwords, payment details, government identity numbers or other sensitive information through a resource link or feedback report.</p>
            </section>
            <section class="legal-section">
                <h2>Your choices and questions</h2>
                <p>You can choose “Prefer not to say” for gender and leave the telephone field blank. The other profile fields are required to register for the student account. You can sign out after using the library. If you have a question about this project's data handling, use the <a href="/contact">project contact page</a>. A project contact email may not yet be available. Do not send your password.</p>
            </section>
            <aside class="legal-note">
                <strong>Student project notice</strong>
                <p>This plain-language notice describes the website's current features. It is not legal advice, a promise of service availability, or an official UoVT privacy notice.</p>
            </aside>
        </div>
    </main>
    <footer.comp></footer.comp>
</body>
</html>`);
}
