export default async function(req, res) {
    try {
        const store = req.app.locals.portalStore;
        if (!await isAdminAuthenticated(req, store)) return res.redirect(302, '/admin/login');
        if (req.method !== 'GET' && req.method !== 'POST') {
            return res.status(405).send('Method not allowed.');
        }
        await store.initialize();

        let message = '';
        let messageType = '';
        if (req.method === 'POST') {
            const action = req.body?.action;
            if (action === 'review-organization-request') {
                const id = parsePositiveId(req.body?.id);
                const approved = req.body?.decision === 'approve';
                if (!id || !['approve', 'reject'].includes(req.body?.decision)) {
                    [message, messageType] = ['Organization request details are invalid.', 'error'];
                } else {
                    try {
                        if (await store.reviewOrganizationRequest(id, approved, process.env.ADMIN_USERNAME || 'admin')) {
                            [message, messageType] = [approved
                                ? 'Campus, faculty, and department verified. Matching pending student accounts have been linked to the approved options.'
                                : 'Organization request rejected. The student can correct and resubmit the details.', 'success'];
                        } else {
                            [message, messageType] = ['This organization request was already reviewed or could not be found.', 'error'];
                        }
                    } catch (error) {
                        console.error('Organization request review failed:', error);
                        [message, messageType] = [
                            'The request could not be reviewed. No changes were saved; check the server log and try again.',
                            'error'
                        ];
                    }
                }
            } else if (action === 'add-university') {
                const name = normalizeName(req.body?.name, 100);
                if (!name) {
                    [message, messageType] = ['University name එක අකුරු 1-100 අතර විය යුතුයි.', 'error'];
                } else if (await store.addUniversity(name)) {
                    [message, messageType] = ['University එක එකතු කළා. දැන් ඒ යටතේ faculties සහ departments එකතු කළ හැකියි.', 'success'];
                } else {
                    [message, messageType] = ['මෙම නම ඇති university එකක් දැනටමත් තිබෙනවා.', 'error'];
                }
            } else if (action === 'toggle-university') {
                const id = parsePositiveId(req.body?.id);
                const active = parseActiveValue(req.body?.active);
                if (!id || active === null) {
                    [message, messageType] = ['University තොරතුරු නිවැරදි නැහැ.', 'error'];
                } else if (await store.setUniversityActive(id, active)) {
                    [message, messageType] = [active ? 'University එක නැවත සක්‍රිය කළා.' : 'University එක අක්‍රිය කළා. එහි accounts හා content මැකෙන්නේ නැහැ.', 'success'];
                } else {
                    [message, messageType] = ['UoVT university එක අක්‍රිය කළ නොහැකියි.', 'error'];
                }
            } else if (action === 'delete-university') {
                const id = parsePositiveId(req.body?.id);
                if (!id) {
                    [message, messageType] = ['University ID එක නිවැරදි නැහැ.', 'error'];
                } else if (await store.deleteUniversity(id)) {
                    [message, messageType] = ['භාවිතයේ නොතිබූ university එක delete කළා.', 'success'];
                } else {
                    [message, messageType] = ['UoVT හෝ faculties/users තිබෙන university එක delete කරන්න බැහැ. මුලින් ඒවා move කරන්න.', 'error'];
                }
            } else if (action === 'add-faculty') {
                const name = normalizeName(req.body?.name);
                const universityId = parsePositiveId(req.body?.universityId);
                if (!name) {
                    [message, messageType] = ['Faculty name එක අකුරු 1-80 අතර විය යුතුයි.', 'error'];
                } else if (!universityId) {
                    [message, messageType] = ['Faculty එකට අදාළ university එක තෝරන්න.', 'error'];
                } else if (await store.addFaculty(name, universityId)) {
                    [message, messageType] = ['Faculty එක සාර්ථකව එකතු කළා.', 'success'];
                } else {
                    [message, messageType] = ['මෙම university එකේ එම නම ඇති faculty එකක් දැනටමත් තිබෙනවා.', 'error'];
                }
            } else if (action === 'add-department') {
                const name = normalizeName(req.body?.name);
                const facultyId = parsePositiveId(req.body?.facultyId);
                if (!name || !facultyId) {
                    [message, messageType] = ['Faculty එකක් තෝරා නිවැරදි department නමක් ඇතුළත් කරන්න.', 'error'];
                } else if (await store.addDepartment(name, facultyId)) {
                    [message, messageType] = ['Department එක එකතු කළා. Signup එකේදී department සහ එහි faculty එක දෙකම auto-fill වෙනවා.', 'success'];
                } else {
                    [message, messageType] = ['එම university/faculty එක active ද සහ නම duplicate නැද්ද කියලා පරීක්ෂා කරන්න.', 'error'];
                }
            } else if (action === 'toggle-faculty') {
                const id = parsePositiveId(req.body?.id);
                const active = parseActiveValue(req.body?.active);
                if (!id || active === null) {
                    [message, messageType] = ['Faculty мэдээлනය නිවැරදි නැහැ.', 'error'];
                } else if (await store.setFacultyActive(id, active)) {
                    [message, messageType] = [active ? 'Faculty එක නැවත සක්‍රිය කළා.' : 'Faculty එක අක්‍රිය කළා. එහි departments සහ student records මැකෙන්නේ නැහැ.', 'success'];
                } else {
                    [message, messageType] = ['Faculty එක සොයාගත නොහැකියි.', 'error'];
                }
            } else if (action === 'delete-faculty') {
                const id = parsePositiveId(req.body?.id);
                if (!id) {
                    [message, messageType] = ['Faculty ID එක නිවැරදි නැහැ.', 'error'];
                } else if (await store.deleteFaculty(id)) {
                    [message, messageType] = ['භාවිතයේ නොතිබූ faculty එක මකා දැම්මා.', 'success'];
                } else {
                    [message, messageType] = ['Departments තිබෙන faculty එකක් delete කරන්න බැහැ. මුලින් departments මකන්න හෝ වෙනස් කරන්න.', 'error'];
                }
            } else if (action === 'toggle-department') {
                const id = parsePositiveId(req.body?.id);
                const active = parseActiveValue(req.body?.active);
                if (!id || active === null) {
                    [message, messageType] = ['Department තොරතුරු නිවැරදි නැහැ.', 'error'];
                } else if (await store.setDepartmentActive(id, active)) {
                    [message, messageType] = [active ? 'Department එක නැවත සක්‍රිය කළා.' : 'Department එක අක්‍රිය කළා. Student accounts සහ links ඉතිරි වෙනවා.', 'success'];
                } else {
                    [message, messageType] = ['Department එක හෝ එහි active faculty එක සොයාගත නොහැකියි.', 'error'];
                }
            } else if (action === 'delete-department') {
                const id = parsePositiveId(req.body?.id);
                if (!id) {
                    [message, messageType] = ['Department ID එක නිවැරදි නැහැ.', 'error'];
                } else if (await store.deleteDepartment(id)) {
                    [message, messageType] = ['භාවිතයේ නොතිබූ department එක මකා දැම්මා.', 'success'];
                } else {
                    [message, messageType] = ['මෙම department එකට students හෝ resource links සම්බන්ධයි. Data නැතිවීම වැළැක්වීමට මුලින් ඒවා වෙනත් department එකකට මාරු කරන්න.', 'error'];
                }
            } else if (action === 'update-resource-details') {
                const resourceId = parsePositiveId(req.body?.resourceId);
                const subjectTitle = normalizeName(req.body?.subjectTitle, 120);
                const linkLabel = normalizeName(req.body?.linkLabel, 100);
                const linkType = req.body?.linkType;
                const linkUrl = normalizeHttpsUrl(req.body?.linkUrl);
                if (!resourceId || !subjectTitle || !linkLabel || !['yt', 'telegram', 'drive', 'whatsapp', 'default'].includes(linkType) || !linkUrl) {
                    [message, messageType] = ['Enter a valid subject, link name, link type, and secure HTTPS address.', 'error'];
                } else {
                    try {
                        if (await store.updateResourceDetails(resourceId, { subjectTitle, linkType, linkLabel, linkUrl })) {
                            [message, messageType] = ['Link details updated.', 'success'];
                        } else {
                            [message, messageType] = ['This resource link could not be found.', 'error'];
                        }
                    } catch (error) {
                        console.error('Resource details update failed:', error);
                        [message, messageType] = ['These details could not be saved. Check for an existing duplicate link and try again.', 'error'];
                    }
                }
            } else if (action === 'toggle-resource') {
                const resourceId = parsePositiveId(req.body?.resourceId);
                const active = parseActiveValue(req.body?.active);
                if (!resourceId || active === null) {
                    [message, messageType] = ['Resource link status is invalid.', 'error'];
                } else if (await store.setResourceActive(resourceId, active)) {
                    [message, messageType] = [active ? 'Link reactivated and visible to its selected students.' : 'Link deactivated. It is hidden from students but retained in admin settings.', 'success'];
                } else {
                    [message, messageType] = ['This resource link could not be found.', 'error'];
                }
            } else if (action === 'delete-resource') {
                const resourceId = parsePositiveId(req.body?.resourceId);
                if (!resourceId) {
                    [message, messageType] = ['Resource link ID is invalid.', 'error'];
                } else if (await store.deleteResource(resourceId)) {
                    [message, messageType] = ['Resource link and its department access assignments were deleted.', 'success'];
                } else {
                    [message, messageType] = ['This resource link could not be found.', 'error'];
                }
            } else if (action === 'update-visibility') {
                const resourceId = parsePositiveId(req.body?.resourceId);
                const mode = req.body?.visibilityMode;
                const departmentIds = normalizeDepartmentIds(req.body?.departmentIds);
                const departments = await store.getActiveDepartments();
                const validMode = mode === 'public' || mode === 'selected';
                const validSelection = mode === 'public' || (
                    mode === 'selected'
                    && departmentIds.length > 0
                    && departmentIds.every(id => departments.some(department => String(department.id) === id))
                );
                if (!resourceId || !validMode || !validSelection) {
                    [message, messageType] = ['Public තෝරන්න, නැත්නම් අවම වශයෙන් එක් active department එකක් තෝරන්න.', 'error'];
                } else if (await store.updateResourceVisibility(resourceId, {
                    all: mode === 'public',
                    departmentIds
                })) {
                    [message, messageType] = ['Link visibility සුරැකුණා.', 'success'];
                } else {
                    [message, messageType] = ['මෙම resource එක සොයාගත නොහැකියි.', 'error'];
                }
            } else {
                [message, messageType] = ['ඉල්ලූ admin ක්‍රියාව හඳුනාගත නොහැකියි.', 'error'];
            }
        }

        const [universities, faculties, departments, resources, pendingRequests] = await Promise.all([
            store.getUniversities(),
            store.getFaculties(),
            store.getDepartments(),
            store.getAdminResources(),
            store.getPendingOrganizationRequests()
        ]);
        return res.send(renderSettingsPage(universities, faculties, departments, resources, pendingRequests, message, messageType));
    } catch (error) {
        console.error('Admin settings error:', error);
        if (!res.headersSent) return res.status(500).send('Admin settings are unavailable. Please try again later.');
    }
}

function renderSettingsPage(universities, faculties, departments, resources, pendingRequests, message, messageType) {
    const activeUniversities = universities.filter(university => university.active);
    const activeFaculties = faculties.filter(faculty => faculty.active && faculty.university_active);
    const universityOptions = activeUniversities.map(university =>
        `<option value="${escapeHtml(String(university.id))}">${escapeHtml(university.name)}</option>`
    ).join('');
    const facultyOptions = activeFaculties.map(faculty =>
        `<option value="${escapeHtml(String(faculty.id))}">${escapeHtml(faculty.university)} → ${escapeHtml(faculty.name)}</option>`
    ).join('');

    const universityRows = universities.length
        ? universities.map(university => `<li class="admin-department-row" data-search="${escapeHtml(university.name.toLowerCase())}">
            <div class="admin-row-main">
                <strong>${escapeHtml(university.name)}</strong>
                ${university.is_uovt ? '<span class="admin-status is-active">Home university</span>' : ''}
                <span class="admin-status ${university.active ? 'is-active' : 'is-inactive'}">${university.active ? 'Active' : 'Inactive'}</span>
                <small>${escapeHtml(String(university.faculty_count))} faculties · ${escapeHtml(String(university.student_count))} students</small>
            </div>
            <div class="admin-row-actions">
                <form method="POST" action="/admin/settings">
                    <input type="hidden" name="action" value="toggle-university">
                    <input type="hidden" name="id" value="${escapeHtml(String(university.id))}">
                    <input type="hidden" name="active" value="${university.active ? 'false' : 'true'}">
                    <button class="admin-secondary-button" type="submit" ${university.is_uovt && university.active ? 'disabled title="The home university must stay active"' : ''}>${university.active ? 'Deactivate' : 'Activate'}</button>
                </form>
                <form method="POST" action="/admin/settings" onsubmit="return confirm('Delete this university? It must not contain faculties or student accounts.')">
                    <input type="hidden" name="action" value="delete-university">
                    <input type="hidden" name="id" value="${escapeHtml(String(university.id))}">
                    <button class="admin-danger-button" type="submit" ${university.is_uovt || Number(university.faculty_count) || Number(university.student_count) ? 'disabled title="Move or delete its faculties and users first"' : ''}>Delete</button>
                </form>
            </div>
        </li>`).join('')
        : '<li class="admin-empty-state">No universities yet.</li>';

    const facultyRows = faculties.length
        ? faculties.map(faculty => `<li class="admin-department-row admin-faculty-row" data-search="${escapeHtml(`${faculty.university} ${faculty.name}`.toLowerCase())}">
            <div class="admin-row-main">
                <strong>${escapeHtml(faculty.name)}</strong>
                <span class="admin-row-subtitle">${escapeHtml(faculty.university)}</span>
                <span class="admin-status ${faculty.active ? 'is-active' : 'is-inactive'}">${faculty.active ? 'Active' : 'Inactive'}</span>
                <small>${escapeHtml(String(faculty.department_count))} departments</small>
            </div>
            <div class="admin-row-actions">
                <form method="POST" action="/admin/settings">
                    <input type="hidden" name="action" value="toggle-faculty">
                    <input type="hidden" name="id" value="${escapeHtml(String(faculty.id))}">
                    <input type="hidden" name="active" value="${faculty.active ? 'false' : 'true'}">
                    <button class="admin-secondary-button" type="submit">${faculty.active ? 'Deactivate' : 'Activate'}</button>
                </form>
                <form method="POST" action="/admin/settings" onsubmit="return confirm('Delete this faculty? It must not contain departments.')">
                    <input type="hidden" name="action" value="delete-faculty">
                    <input type="hidden" name="id" value="${escapeHtml(String(faculty.id))}">
                    <button class="admin-danger-button" type="submit" ${Number(faculty.department_count) ? 'disabled title="Delete its departments first"' : ''}>Delete</button>
                </form>
            </div>
        </li>`).join('')
        : '<li class="admin-empty-state">No faculties yet. Add one above.</li>';

    const requestRows = pendingRequests.length
        ? pendingRequests.map(request => `<li class="admin-department-row" data-search="${escapeHtml(`${request.university_name} ${request.faculty_name} ${request.department_name} ${request.submitted_by}`.toLowerCase())}">
            <div class="admin-row-main">
                <strong>${escapeHtml(request.university_name)}</strong>
                <span class="admin-row-subtitle">${escapeHtml(request.faculty_name)} → ${escapeHtml(request.department_name)}</span>
                <span class="admin-status is-inactive">Pending verification</span>
                <small>${escapeHtml(String(request.student_count))} student account(s) · first request by ${escapeHtml(request.submitted_by)}</small>
            </div>
            <div class="admin-row-actions">
                <form method="POST" action="/admin/settings" onsubmit="return confirm('Verify these campus details and add or reuse the matching university, faculty, and department?')">
                    <input type="hidden" name="action" value="review-organization-request">
                    <input type="hidden" name="id" value="${escapeHtml(String(request.id))}">
                    <input type="hidden" name="decision" value="approve">
                    <button class="admin-secondary-button" type="submit">Approve &amp; match</button>
                </form>
                <form method="POST" action="/admin/settings" onsubmit="return confirm('Reject this campus request? Students can correct and resubmit.')">
                    <input type="hidden" name="action" value="review-organization-request">
                    <input type="hidden" name="id" value="${escapeHtml(String(request.id))}">
                    <input type="hidden" name="decision" value="reject">
                    <button class="admin-danger-button" type="submit">Reject</button>
                </form>
            </div>
        </li>`).join('')
        : '<li class="admin-empty-state">No organization requests are waiting for review.</li>';

    const departmentRows = departments.length
        ? departments.map(department => `<li class="admin-department-row admin-managed-department" data-search="${escapeHtml(`${department.university} ${department.faculty} ${department.name}`.toLowerCase())}">
            <div class="admin-row-main">
                <strong>${escapeHtml(department.name)}</strong>
                <span class="admin-row-subtitle">${escapeHtml(department.university)} → ${escapeHtml(department.faculty)}</span>
                <span class="admin-status ${department.active && department.faculty_active && department.university_active ? 'is-active' : 'is-inactive'}">${department.active && department.faculty_active && department.university_active ? 'Active' : 'Inactive'}</span>
                <small>${escapeHtml(String(department.student_count))} students · ${escapeHtml(String(department.resource_count))} links</small>
            </div>
            <div class="admin-row-actions">
                <form method="POST" action="/admin/settings">
                    <input type="hidden" name="action" value="toggle-department">
                    <input type="hidden" name="id" value="${escapeHtml(String(department.id))}">
                    <input type="hidden" name="active" value="${department.active ? 'false' : 'true'}">
                    <button class="admin-secondary-button" type="submit" ${!department.faculty_active || !department.university_active ? 'disabled title="Activate the university and faculty first"' : ''}>${department.active ? 'Deactivate' : 'Activate'}</button>
                </form>
                <form method="POST" action="/admin/settings" onsubmit="return confirm('Delete this department? It must not contain students or resource links.')">
                    <input type="hidden" name="action" value="delete-department">
                    <input type="hidden" name="id" value="${escapeHtml(String(department.id))}">
                    <button class="admin-danger-button" type="submit" ${Number(department.student_count) || Number(department.resource_count) ? 'disabled title="Move students and links before deleting"' : ''}>Delete</button>
                </form>
            </div>
        </li>`).join('')
        : '<li class="admin-empty-state">No departments yet. Add a faculty first.</li>';

    const resourceRows = resources.length
        ? resources.map(resource => {
            const selectedIds = new Set((resource.department_ids || []).map(String));
            const departmentChecks = departments
                .filter(department => department.active && department.faculty_active && department.university_active)
                .map(department => `<label class="admin-choice">
                    <input type="checkbox" name="departmentIds" value="${escapeHtml(String(department.id))}" ${selectedIds.has(String(department.id)) ? 'checked' : ''}>
                    <span>${escapeHtml(department.university)} → ${escapeHtml(department.faculty)} — ${escapeHtml(department.name)}</span>
                </label>`).join('');
            const mode = resource.visible_to_all_departments ? 'public' : 'selected';
            const audience = resource.visible_to_all_departments
                ? 'Public · all registered students'
                : resource.department_names.length
                    ? resource.department_names.map(escapeHtml).join(', ')
                    : 'No departments assigned';
            const searchable = `${resource.category} semester ${resource.semester} ${resource.subject_title} ${resource.link_label} ${resource.link_url} ${audience}`.toLowerCase();
            const linkTypes = [
                ['yt', 'YouTube'],
                ['telegram', 'Telegram'],
                ['drive', 'Google Drive'],
                ['whatsapp', 'WhatsApp'],
                ['default', 'Other link']
            ].map(([value, label]) => `<option value="${value}" ${resource.link_type === value ? 'selected' : ''}>${label}</option>`).join('');
            return `<article class="admin-resource-card${resource.active ? '' : ' is-resource-inactive'}" data-search="${escapeHtml(searchable)}" data-visibility="${mode}" data-active="${resource.active ? 'active' : 'inactive'}">
                <details>
                    <summary>
                        <span class="admin-resource-summary-main">
                            <span class="admin-resource-meta">${escapeHtml(resource.category)} · Semester ${escapeHtml(String(resource.semester))}</span>
                            <strong>${escapeHtml(resource.subject_title)}</strong>
                            <span class="admin-current-audience">${audience}</span>
                        </span>
                        <span class="admin-expand-label">${resource.active ? 'Manage link' : 'Inactive · Manage link'}</span>
                    </summary>
                    <div class="admin-resource-content">
                        <span class="admin-resource-status ${resource.active ? 'is-active' : 'is-inactive'}">${resource.active ? 'Visible to students' : 'Hidden from students'}</span>
                        <a class="admin-resource-preview" href="${escapeHtml(resource.link_url)}" target="_blank" rel="noopener noreferrer">Open current link in a new tab ↗</a>
                        <form method="POST" action="/admin/settings" class="admin-resource-edit">
                            <input type="hidden" name="action" value="update-resource-details">
                            <input type="hidden" name="resourceId" value="${escapeHtml(String(resource.id))}">
                            <label>Subject name
                                <input name="subjectTitle" maxlength="120" value="${escapeHtml(resource.subject_title)}" required>
                            </label>
                            <label>Link name
                                <input name="linkLabel" maxlength="100" value="${escapeHtml(resource.link_label)}" required>
                            </label>
                            <label>Link type
                                <select name="linkType">${linkTypes}</select>
                            </label>
                            <label>HTTPS address
                                <input name="linkUrl" type="url" inputmode="url" maxlength="2048" value="${escapeHtml(resource.link_url)}" required>
                            </label>
                            <div class="admin-resource-actions">
                                <button class="admin-button" type="submit">Save link details</button>
                            </div>
                        </form>
                        <form method="POST" action="/admin/settings" class="admin-resource-access">
                            <input type="hidden" name="action" value="update-visibility">
                            <input type="hidden" name="resourceId" value="${escapeHtml(String(resource.id))}">
                            <fieldset class="admin-visibility">
                                <legend>Who can see this link?</legend>
                                <label class="admin-choice">
                                    <input type="radio" name="visibilityMode" value="public" ${mode === 'public' ? 'checked' : ''}>
                                    <span>Public — all registered students, including other universities</span>
                                </label>
                                <label class="admin-choice">
                                    <input type="radio" name="visibilityMode" value="selected" ${mode === 'selected' ? 'checked' : ''}>
                                    <span>Selected departments only</span>
                                </label>
                                <div class="admin-department-choices" ${mode === 'public' ? 'hidden' : ''}>
                                    ${departmentChecks || '<p>No active departments available.</p>'}
                                </div>
                            </fieldset>
                            <button class="admin-secondary-button" type="submit">Save access</button>
                        </form>
                        <div class="admin-resource-actions admin-resource-management">
                            <form method="POST" action="/admin/settings">
                                <input type="hidden" name="action" value="toggle-resource">
                                <input type="hidden" name="resourceId" value="${escapeHtml(String(resource.id))}">
                                <input type="hidden" name="active" value="${resource.active ? 'false' : 'true'}">
                                <button class="admin-secondary-button" type="submit">${resource.active ? 'Deactivate link' : 'Reactivate link'}</button>
                            </form>
                            <form method="POST" action="/admin/settings" onsubmit="return confirm('Permanently delete this link and its department access settings? This cannot be undone.')">
                                <input type="hidden" name="action" value="delete-resource">
                                <input type="hidden" name="resourceId" value="${escapeHtml(String(resource.id))}">
                                <button class="admin-danger-button" type="submit">Delete link</button>
                            </form>
                        </div>
                    </div>
                </details>
            </article>`;
        }).join('')
        : '<p class="admin-empty-state">No resource links have been saved yet.</p>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin universities and settings - UoVT Student Hub</title>
    <link href="/css/global.css" rel="stylesheet">
    <link href="/css/admin.css" rel="stylesheet">
</head>
<body>
    <main class="admin-container admin-settings-container">
        <p class="admin-eyebrow">UoVT STUDENT HUB</p>
        <h1>Universities &amp; settings</h1>
        <nav class="admin-navigation" aria-label="Admin pages">
            <a href="/admin/dashboard">Overview</a>
            <a href="/admin/users">User management</a>
            <a href="/admin/submit">Add resource</a>
            <a class="active" href="/admin/settings" aria-current="page">Universities &amp; settings</a>
            <a href="/admin/translator">Translator</a>
            <a href="#manage-organization">Faculties &amp; departments</a>
            <a href="#link-access">Manage links</a>
        </nav>
        ${message ? `<div class="admin-alert ${messageType}" role="${messageType === 'success' ? 'status' : 'alert'}">${escapeHtml(message)}</div>` : ''}
        <section class="admin-settings-section" id="manage-organization">
            <h2>Faculties and departments</h2>
            <p>Add a university, then faculties and departments underneath it. When a student selects a department, their university and faculty are saved automatically. Public links are visible to all registered students, including other universities.</p>
            <div class="admin-setup-grid">
                <form method="POST" action="/admin/settings" class="admin-add-department">
                    <input type="hidden" name="action" value="add-university">
                    <div class="admin-form-group">
                        <label for="universityName">New university</label>
                        <input id="universityName" name="name" maxlength="100" placeholder="e.g. University name" required>
                    </div>
                    <button class="admin-button" type="submit">Add university</button>
                </form>
                <form method="POST" action="/admin/settings" class="admin-add-department">
                    <input type="hidden" name="action" value="add-faculty">
                    <div class="admin-form-group">
                        <label for="facultyUniversityId">University</label>
                        <select id="facultyUniversityId" name="universityId" required>
                            <option value="" selected disabled>Choose a university</option>
                            ${universityOptions}
                        </select>
                    </div>
                    <div class="admin-form-group">
                        <label for="facultyName">New faculty</label>
                        <input id="facultyName" name="name" maxlength="80" placeholder="e.g. Faculty of Information Technology" required>
                    </div>
                    <button class="admin-button" type="submit">Add faculty</button>
                </form>
                <form method="POST" action="/admin/settings" class="admin-add-department">
                    <input type="hidden" name="action" value="add-department">
                    <div class="admin-form-group">
                        <label for="facultyId">Faculty</label>
                        <select id="facultyId" name="facultyId" required>
                            <option value="" selected disabled>Choose a faculty</option>
                            ${facultyOptions}
                        </select>
                    </div>
                    <div class="admin-form-group">
                        <label for="departmentName">New department name</label>
                        <input id="departmentName" name="name" maxlength="80" placeholder="e.g. Software Engineering" required>
                    </div>
                    <button class="admin-button" type="submit" ${activeFaculties.length ? '' : 'disabled'}>Add department</button>
                </form>
            </div>
            <details class="admin-manage-group" id="organization-requests" ${pendingRequests.length ? 'open' : ''}>
                <summary>Pending campus requests <span>${pendingRequests.length}</span></summary>
                <p class="admin-review-help">Approving a request reuses matching existing entries or creates only the missing university/faculty/department. Matching student accounts are linked automatically.</p>
                <div class="admin-list-toolbar">
                    <label>Find a request<input type="search" data-search-list="requests" placeholder="Search campus, faculty, or department"></label>
                    <p data-list-count="requests" aria-live="polite"></p>
                </div>
                <ul class="admin-department-list" data-paginated-list="requests">${requestRows}</ul>
                <div class="admin-pagination" data-pagination="requests"></div>
            </details>
            <details class="admin-manage-group">
                <summary>Manage universities <span>${universities.length}</span></summary>
                <div class="admin-list-toolbar">
                    <label>Find a university<input type="search" data-search-list="universities" placeholder="Type a university name"></label>
                    <p data-list-count="universities" aria-live="polite"></p>
                </div>
                <ul class="admin-department-list" data-paginated-list="universities">${universityRows}</ul>
                <div class="admin-pagination" data-pagination="universities"></div>
            </details>
            <details class="admin-manage-group">
                <summary>Manage faculties <span>${faculties.length}</span></summary>
                <div class="admin-list-toolbar">
                    <label>Find a faculty<input type="search" data-search-list="faculties" placeholder="Type a faculty name"></label>
                    <p data-list-count="faculties" aria-live="polite"></p>
                </div>
                <ul class="admin-department-list" data-paginated-list="faculties">${facultyRows}</ul>
                <div class="admin-pagination" data-pagination="faculties"></div>
            </details>
            <details class="admin-manage-group">
                <summary>Manage departments <span>${departments.length}</span></summary>
                <div class="admin-list-toolbar">
                    <label>Find a department<input type="search" data-search-list="departments" placeholder="Search faculty or department"></label>
                    <p data-list-count="departments" aria-live="polite"></p>
                </div>
                <ul class="admin-department-list" data-paginated-list="departments">${departmentRows}</ul>
                <div class="admin-pagination" data-pagination="departments"></div>
            </details>
        </section>
        <section class="admin-settings-section" id="link-access">
            <h2>Manage resource links</h2>
            <p>Rename links, change their type or address, manage department visibility, pause and restore links, or permanently delete them. Changes are saved only when you choose an action.</p>
            <div class="admin-list-toolbar admin-resource-toolbar">
                <label>Search links<input id="resourceSearch" type="search" placeholder="Subject, category or link label"></label>
                <label>Visibility
                    <select id="resourceVisibilityFilter">
                        <option value="all">All links</option>
                        <option value="public">Public</option>
                        <option value="selected">Selected departments</option>
                    </select>
                </label>
                <label>Link status
                    <select id="resourceStatusFilter">
                        <option value="active">Active links</option>
                        <option value="inactive">Deactivated links</option>
                        <option value="all">All links</option>
                    </select>
                </label>
                <p id="resourceCount" aria-live="polite"></p>
            </div>
            <div class="admin-resource-list" id="resourceList">${resourceRows}</div>
            <div class="admin-pagination" id="resourcePagination"></div>
        </section>
        <form class="admin-logout" action="/admin/logout" method="POST">
            <button class="admin-secondary-button" type="submit">Admin logout</button>
        </form>
        <a class="admin-back-link" href="/">Back to website</a>
    </main>
    <script>
        function setupPagedList(name, rowSelector, pageSize) {
            const list = document.querySelector('[data-paginated-list="' + name + '"]');
            const search = document.querySelector('[data-search-list="' + name + '"]');
            const count = document.querySelector('[data-list-count="' + name + '"]');
            const pagination = document.querySelector('[data-pagination="' + name + '"]');
            if (!list || !search || !count || !pagination) return;
            const rows = [...list.querySelectorAll(rowSelector)];
            let page = 0;
            function render() {
                const query = search.value.trim().toLocaleLowerCase();
                const matched = rows.filter(row => (row.dataset.search || '').includes(query));
                const pages = Math.max(1, Math.ceil(matched.length / pageSize));
                page = Math.min(page, pages - 1);
                rows.forEach(row => row.hidden = true);
                matched.slice(page * pageSize, (page + 1) * pageSize).forEach(row => row.hidden = false);
                count.textContent = matched.length + (matched.length === 1 ? ' result' : ' results');
                pagination.innerHTML = '';
                if (pages < 2) return;
                const previous = document.createElement('button');
                previous.type = 'button';
                previous.textContent = 'Previous';
                previous.disabled = page === 0;
                previous.addEventListener('click', () => { page--; render(); });
                const label = document.createElement('span');
                label.textContent = 'Page ' + (page + 1) + ' of ' + pages;
                const next = document.createElement('button');
                next.type = 'button';
                next.textContent = 'Next';
                next.disabled = page >= pages - 1;
                next.addEventListener('click', () => { page++; render(); });
                pagination.append(previous, label, next);
            }
            search.addEventListener('input', () => { page = 0; render(); });
            render();
        }

        setupPagedList('universities', 'li', 10);
        setupPagedList('requests', 'li', 10);
        setupPagedList('faculties', 'li', 10);
        setupPagedList('departments', 'li', 15);

        const resourceList = document.getElementById('resourceList');
        const resourceCards = [...resourceList.querySelectorAll('.admin-resource-card')];
        const resourceSearch = document.getElementById('resourceSearch');
        const visibilityFilter = document.getElementById('resourceVisibilityFilter');
        const statusFilter = document.getElementById('resourceStatusFilter');
        const resourceCount = document.getElementById('resourceCount');
        const resourcePagination = document.getElementById('resourcePagination');
        let resourcePage = 0;
        function renderResources() {
            const query = resourceSearch.value.trim().toLocaleLowerCase();
            const visibility = visibilityFilter.value;
            const status = statusFilter.value;
            const filtered = resourceCards.filter(card =>
                card.dataset.search.includes(query)
                && (visibility === 'all' || card.dataset.visibility === visibility)
                && (status === 'all' || card.dataset.active === status)
            );
            const pageSize = 12;
            const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
            resourcePage = Math.min(resourcePage, pages - 1);
            resourceCards.forEach(card => card.hidden = true);
            filtered.slice(resourcePage * pageSize, (resourcePage + 1) * pageSize).forEach(card => card.hidden = false);
            resourceCount.textContent = filtered.length + (filtered.length === 1 ? ' link' : ' links');
            resourcePagination.innerHTML = '';
            if (pages < 2) return;
            const previous = document.createElement('button');
            previous.type = 'button';
            previous.textContent = 'Previous';
            previous.disabled = resourcePage === 0;
            previous.addEventListener('click', () => { resourcePage--; renderResources(); });
            const label = document.createElement('span');
            label.textContent = 'Page ' + (resourcePage + 1) + ' of ' + pages;
            const next = document.createElement('button');
            next.type = 'button';
            next.textContent = 'Next';
            next.disabled = resourcePage >= pages - 1;
            next.addEventListener('click', () => { resourcePage++; renderResources(); });
            resourcePagination.append(previous, label, next);
        }
        resourceSearch.addEventListener('input', () => { resourcePage = 0; renderResources(); });
        visibilityFilter.addEventListener('change', () => { resourcePage = 0; renderResources(); });
        statusFilter.addEventListener('change', () => { resourcePage = 0; renderResources(); });
        renderResources();

        document.querySelectorAll('.admin-resource-access').forEach(form => {
            const radios = form.querySelectorAll('input[name="visibilityMode"]');
            const choices = form.querySelector('.admin-department-choices');
            function updateChoices() {
                const selectedOnly = form.querySelector('input[name="visibilityMode"]:checked').value === 'selected';
                choices.hidden = !selectedOnly;
                const inputs = [...choices.querySelectorAll('input[type="checkbox"]')];
                const hasSelection = inputs.some(input => input.checked);
                inputs.forEach((input, index) => {
                    input.disabled = !selectedOnly;
                    input.required = selectedOnly && index === 0 && !hasSelection;
                });
            }
            radios.forEach(radio => radio.addEventListener('change', updateChoices));
            choices.addEventListener('change', updateChoices);
            updateChoices();
        });
    </script>
</body>
</html>`;
}

async function isAdminAuthenticated(req, store) {
    const cookieHeader = req.headers?.cookie || '';
    const cookie = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith('adminSessionToken='));
    if (!cookie) return false;
    const username = await store.getSession(cookie.slice('adminSessionToken='.length), 'admin');
    return typeof username === 'string' && username === process.env.ADMIN_USERNAME;
}

function normalizeName(value, maxLength = 80) {
    if (typeof value !== 'string') return null;
    const name = value.trim().replace(/\s+/g, ' ');
    return name.length > 0 && name.length <= maxLength && !/[\r\n]/.test(name) ? name : null;
}

function normalizeHttpsUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' && url.hostname ? url.toString() : null;
    } catch {
        return null;
    }
}

function normalizeDepartmentIds(value) {
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    return [...new Set(values.filter(item => typeof item === 'string' && /^\d+$/.test(item)))];
}

function parsePositiveId(value) {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseActiveValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}
