# UoVT Student Hub

A small, server-rendered student resource portal built with Node.js, Express, plain HTML templates and CSS. It does not use React or Next.js. The `.jsx` files contain ordinary JavaScript functions and HTML template strings, so you can edit the page text and layout directly.

## Run it on your computer

1. Install Node.js 20 or newer.
2. Open this project folder in VS Code.
3. Open the VS Code terminal and run `npm install`.
4. Copy [`.env.example`](./.env.example) to `.env.local`, then replace the example database string and admin credentials with your own:

   ```text
   SUPABASE_DB_CONNECTION_STRING=replace-with-your-supabase-postgresql-connection-string
   ADMIN_USERNAME=choose-an-admin-name
   ADMIN_PASSWORD=choose-a-long-unique-password
   ```

   The older `SUPABASE_DB_URL` and `DATABASE_URL` names are also accepted. Keep these values private; do not put them in browser code or commit `.env.local`.
5. In Supabase, open **SQL Editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it once to create the tables.
6. Start the website with `npm run dev`, then open `http://localhost:5000`.

The database connection string is enough for student accounts, student profile details, sessions and learning resources. Upstash Redis is not needed for a new setup. If you have old resources or student accounts in the previous Redis store, you can configure its two `UPSTASH_REDIS_REST_*` values to let the app import those records into Supabase.

The signup form asks for a username, university index number, university/faculty/department, current semester, gender, birthday and university email; telephone is optional. Students choose their campus first, then the matching faculties and departments appear. If a campus, faculty, or department is missing, they can request it by entering the missing name(s). These details remain pending until an admin reviews them; duplicate requests are grouped, and matching student accounts receive library access after approval. Index numbers are unique within each university; university email addresses are unique across the portal.

To enable **Forgot your password?**, configure a real SMTP email service using `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. Set `APP_BASE_URL` to `http://localhost:5000` for local development and to the public HTTPS address of your deployed website in production. Never use a request's Host header to build password reset links. Reset tokens expire after 30 minutes, can only be used once, and are stored as hashes. Without SMTP settings, sign-up and login still work; password recovery tells students to contact the site administrator.

Run the updated [`supabase/schema.sql`](./supabase/schema.sql) in Supabase SQL Editor to add profile fields, the password-reset table, the university/faculty/department hierarchy, resource visibility and link activation to an existing database. You can run the schema again safely when you install later updates. Existing users keep their account and password; their existing departments are placed under UoVT and their records are retained. The UoVT BST department is stored under Engineering Technology, not as a separate faculty. On their next visit to the library, students whose organization details are incomplete are asked to finish their profile and accept the current Terms and Conditions before continuing.

The same schema also creates the translation table used by the admin translator. After running it, open **Admin → Translator** to add exact page phrases and their English, Sinhala and optional combined versions. The gear button in the bottom-right opens display settings; each visitor can choose English, Sinhala or combined wording and light or dark mode, with those choices saved in that browser.

If the login or sign-up page says **“Student accounts are not connected yet”**, the server cannot see a database connection setting. Check that `SUPABASE_DB_CONNECTION_STRING` is present in `.env.local` (local development) or in the hosting provider's environment-variable settings (deployed site), then restart the local server or redeploy.

If it says the **Supabase connection certificate needs setting up**, download your database CA certificate from **Supabase → Project Settings → Database → SSL Configuration**. Set `SUPABASE_DB_CA_CERT` to the certificate file's full path, PEM contents, or base64-encoded certificate. The app verifies the certificate and does not disable TLS verification.

## Add a learning resource

1. Sign in with the admin username and password from `.env.local` at `/admin/login`. The admin home page is `/admin/dashboard`; its enrollment charts refresh automatically.
2. Open **Universities & settings** to manage organizations and review pending campus requests. UoVT is already available. Students can also request a missing campus, faculty or department during signup; approve a request to match/create its organization entries and unlock the related student profiles.
3. Use **Add resource**, choose a category and semester, then enter the subject, button label and a complete `https://` link.
4. Links default to **Selected departments**. You can assign one link to multiple departments, or choose **Public** to show it to every signed-in student, including students from other universities.
   The student library loads the signed-in student's resource list once per page visit; changing its category or semester switches locally in the browser without another server request.
5. In **User management**, filter students by university, department, pending campus approval, account status or search text. The pending-campuses filter links directly to the grouped review queue in **Universities & settings**. Admins can disable accounts (which signs the student out) or permanently delete accounts after confirmation; large user lists are paginated.
6. In **Universities & settings → Manage links**, search for a saved link, edit its subject or link name/type/address, change its audience, deactivate or reactivate it, or permanently delete it. Large lists are paginated and collapsed so they stay manageable.
7. Universities, faculties and departments can be deactivated without losing accounts or links. Deleting an organization is blocked while it is still referenced, to prevent accidental data loss.
8. Use **Translator** to add or update exact phrases in English and Sinhala, and optionally provide a mixed-language version for the combined mode.

Resources already in Supabase when the updated schema is run, and resources imported later from the old Redis `portal_database`, are assigned to the **BST** department by default. The migration keeps existing profile and resource records and places existing UoVT faculties under the seeded UoVT university. Create other universities in the admin settings before adding their faculties and departments.

## Where to edit things

- [`pages/index.jsx`](./pages/index.jsx) — home page wording and sections.
- [`pages/about.jsx`](./pages/about.jsx), [`pages/services.jsx`](./pages/services.jsx), [`pages/contact.jsx`](./pages/contact.jsx) — project information, student resources, and project contact page.
- [`pages/privacy.jsx`](./pages/privacy.jsx), [`pages/terms.jsx`](./pages/terms.jsx) — plain-language privacy notice and usage guidelines.
- [`pages/account.jsx`](./pages/account.jsx) — student library, categories, semesters and subject search.
- [`pages/admin/submit.jsx`](./pages/admin/submit.jsx) — resource submission form.
- [`pages/admin/dashboard.jsx`](./pages/admin/dashboard.jsx) — live admin enrollment dashboard and charts.
- [`pages/admin/users.jsx`](./pages/admin/users.jsx) — student account search, filters and account controls.
- [`pages/admin/settings.jsx`](./pages/admin/settings.jsx) — university, faculty, department and saved-link visibility management.
- [`pages/admin/translator.jsx`](./pages/admin/translator.jsx) — admin phrase translation editor.
- [`pages/js/site-preferences.js`](./pages/js/site-preferences.js) and [`pages/css/theme.css`](./pages/css/theme.css) — saved language and light/dark display preferences.
- [`supabase/schema.sql`](./supabase/schema.sql) — database tables, departments and resource access mapping.
- [`component/nav.comp.jsx`](./component/nav.comp.jsx) — top navigation.
- [`component/footer.comp.jsx`](./component/footer.comp.jsx) — footer.
- [`pages/css/global.css`](./pages/css/global.css) — shared navigation and layout styles.
- [`pages/css/content.css`](./pages/css/content.css) — home page styles.
- [`pages/css/account.css`](./pages/css/account.css) — student library and sign-in styles.
- [`lib/portal-store.js`](./lib/portal-store.js) — Supabase database operations.

Restart `npm run dev` after changing server-side page code. CSS changes are usually visible after refreshing the browser.

To publish a project contact email, optionally add `CONTACT_EMAIL=your-project-email@example.com` to `.env.local` and your hosting provider's private environment settings. Without this setting, the contact page clearly says that no project contact email has been published; it does not invent an address or claim to be UoVT support.
