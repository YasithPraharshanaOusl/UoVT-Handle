(async function initializeOrganizationSelectors() {
    const form = document.querySelector('[data-organization-form]');
    if (!form) return;

    const university = form.querySelector('[name="universityId"]');
    const faculty = form.querySelector('[name="facultyId"]');
    const department = form.querySelector('[name="departmentId"]');
    const universityName = form.querySelector('[name="universityName"]');
    const facultyName = form.querySelector('[name="facultyName"]');
    const departmentName = form.querySelector('[name="departmentName"]');
    const status = form.querySelector('[data-organization-status]');
    let data;

    function setCustomField(select, input, visible, placeholder) {
        input.hidden = !visible;
        input.required = visible;
        input.disabled = !visible;
        select.setAttribute('aria-describedby', visible ? input.id : '');
        if (visible && !input.value) input.placeholder = placeholder;
    }

    function reset(select, label, rows, parentId, parentKey) {
        select.replaceChildren(new Option(label, '', true, true));
        select.options[0].disabled = true;
        rows.filter(row => parentId !== null && String(row[parentKey]) === String(parentId))
            .forEach(row => select.add(new Option(row.name, row.id)));
        select.add(new Option('Not listed — request admin approval', '__new__'));
        select.disabled = parentId === null;
    }

    function updateUniversity() {
        const isNew = university.value === '__new__';
        setCustomField(university, universityName, isNew, 'Enter the official university / campus name');
        reset(faculty, 'Choose your faculty', data.faculties, isNew ? null : university.value, 'university_id');
        faculty.disabled = false;
        if (isNew) faculty.value = '__new__';
        updateFaculty();
    }

    function updateFaculty() {
        const isNew = faculty.value === '__new__';
        setCustomField(faculty, facultyName, isNew || university.value === '__new__', 'Enter the faculty name');
        reset(
            department,
            'Choose your department',
            data.departments,
            isNew || university.value === '__new__' ? null : faculty.value,
            'faculty_id'
        );
        department.disabled = !isNew && university.value !== '__new__' && !faculty.value;
        if (isNew || university.value === '__new__') department.value = '__new__';
        updateDepartment();
    }

    function updateDepartment() {
        const isNew = department.value === '__new__'
            || faculty.value === '__new__'
            || university.value === '__new__';
        setCustomField(department, departmentName, isNew, 'Enter the department name');
        const isPending = university.value === '__new__'
            || faculty.value === '__new__'
            || department.value === '__new__';
        status.hidden = !isPending;
        status.textContent = isPending
            ? 'New campus, faculty, or department details are sent to the admin for verification. The learning library is available after approval.'
            : '';
    }

    try {
        const response = await fetch('/api/organization-options', {
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Organization options could not be loaded.');
        data = await response.json();
        university.replaceChildren(new Option('Choose your university / campus', '', true, true));
        university.options[0].disabled = true;
        data.universities.forEach(item => university.add(new Option(item.name, item.id)));
        university.add(new Option('Not listed — request admin approval', '__new__'));
        faculty.replaceChildren(new Option('Choose your university first', '', true, true));
        department.replaceChildren(new Option('Choose your faculty first', '', true, true));
        university.disabled = false;
        faculty.disabled = true;
        department.disabled = true;
        university.addEventListener('change', updateUniversity);
        faculty.addEventListener('change', updateFaculty);
        department.addEventListener('change', updateDepartment);
    } catch (error) {
        university.replaceChildren(new Option('Campus list unavailable', '', true, true));
        university.disabled = true;
        faculty.disabled = true;
        department.disabled = true;
        status.hidden = false;
        status.textContent = error.message || 'Campus details could not be loaded. Refresh and try again.';
    }
})();
