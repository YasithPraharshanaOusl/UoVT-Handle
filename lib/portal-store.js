import { Pool } from 'pg';
import { createHash, X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';

const REDIS_IMPORT_ID = 'import-portal-database-v1';
const DEFAULT_DATABASE = {
    lectureVideo: {},
    pastPaper: {},
    lecturePresenNote: {},
    shortNote: {}
};

export function createPortalStore({ PoolClass = Pool } = {}) {
    let pool;
    let importPromise;

    function getPool() {
        const connectionString = process.env.SUPABASE_DB_CONNECTION_STRING
            || process.env.SUPABASE_DB_URL
            || process.env.DATABASE_URL;
        if (!connectionString) {
            const error = new Error('Supabase PostgreSQL connection is not configured. Set SUPABASE_DB_CONNECTION_STRING, SUPABASE_DB_URL, or DATABASE_URL.');
            error.code = 'PORTAL_DATABASE_NOT_CONFIGURED';
            throw error;
        }

        if (!pool) {
            const ssl = { rejectUnauthorized: true };
            const caSetting = process.env.SUPABASE_DB_CA_CERT;
            if (caSetting) {
                ssl.ca = getCaCertificate(caSetting);
            }
            pool = new PoolClass({
                connectionString,
                ssl,
                max: 5,
                idleTimeoutMillis: 10000,
                connectionTimeoutMillis: 10000
            });
        }
        return pool;
    }

    async function ensureLegacyImport() {
        if (!isRedisConfigured()) return;
        if (!importPromise) {
            importPromise = importLegacyRedisDatabase().catch(error => {
                importPromise = null;
                throw error;
            });
        }
        await importPromise;
    }

    async function importLegacyRedisDatabase() {
        const client = await getPool().connect();
        try {
            await client.query('BEGIN');
            await client.query("SELECT pg_advisory_xact_lock(hashtext('uovt-handle-redis-import-v1'))");

            const migration = await client.query(
                'SELECT 1 FROM portal_migrations WHERE migration_id = $1',
                [REDIS_IMPORT_ID]
            );
            if (migration.rowCount > 0) {
                await client.query('COMMIT');
                return;
            }

            const legacy = await redisCommand('GET', 'portal_database');
            const database = parseLegacyDatabase(legacy);
            const departmentResult = await client.query(
                `SELECT department.id
                 FROM portal_departments AS department
                 JOIN portal_faculties AS faculty ON faculty.id = department.faculty_id
                 JOIN portal_universities AS university ON university.id = faculty.university_id
                 WHERE UPPER(department.name) = 'BST'
                   AND LOWER(faculty.name) = 'engineering technology'
                   AND university.is_uovt = TRUE`
            );
            if (departmentResult.rowCount !== 1) {
                throw new Error('The BST department under UoVT Engineering Technology is missing. Run supabase/schema.sql before importing legacy resources.');
            }
            const bstDepartmentId = departmentResult.rows[0].id;
            for (const [category, semesters] of Object.entries(database)) {
                if (!['lectureVideo', 'pastPaper', 'lecturePresenNote', 'shortNote'].includes(category)) continue;
                for (const [semester, subjects] of Object.entries(semesters || {})) {
                    if (!/^[1-8]$/.test(semester) || !Array.isArray(subjects)) continue;
                    for (const subject of subjects) {
                        if (!subject || typeof subject.title !== 'string' || !Array.isArray(subject.links)) continue;
                        for (const link of subject.links) {
                            if (!isValidResourceLink(link)) continue;
                            const resourceResult = await client.query(
                                `INSERT INTO portal_resources
                                    (category, semester, subject_title, link_type, link_label, link_url, visible_to_all_departments)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                                 ON CONFLICT DO NOTHING
                                 RETURNING id`,
                                [category, Number(semester), subject.title, link.type, link.label, link.url, false]
                            );
                            let resourceId = resourceResult.rows[0]?.id;
                            if (!resourceId) {
                                const existing = await client.query(
                                    `SELECT id FROM portal_resources
                                     WHERE category = $1 AND semester = $2
                                       AND LOWER(subject_title) = LOWER($3) AND link_url = $4`,
                                    [category, Number(semester), subject.title, link.url]
                                );
                                resourceId = existing.rows[0]?.id;
                            }
                            if (resourceId) {
                                await client.query(
                                    `INSERT INTO portal_resource_departments (resource_id, department_id)
                                     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                                    [resourceId, bstDepartmentId]
                                );
                            }
                        }
                    }
                }
            }

            await client.query(
                'INSERT INTO portal_migrations (migration_id) VALUES ($1) ON CONFLICT DO NOTHING',
                [REDIS_IMPORT_ID]
            );
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async function getPortalDatabase(departmentId = null) {
        await ensureLegacyImport();
        const result = await getPool().query(
            `SELECT resource.category, resource.semester, resource.subject_title,
                    resource.link_type, resource.link_label, resource.link_url
             FROM portal_resources AS resource
            WHERE resource.active = TRUE
              AND (resource.visible_to_all_departments = TRUE
               OR EXISTS (
                   SELECT 1
                   FROM portal_resource_departments AS access
                   WHERE access.resource_id = resource.id AND access.department_id = $1
               ))
             ORDER BY resource.category, resource.semester, LOWER(resource.subject_title), resource.id`,
            [departmentId]
        );
        const database = structuredClone(DEFAULT_DATABASE);
        for (const row of result.rows) {
            const semester = String(row.semester);
            const subjects = database[row.category][semester] ||= [];
            let subject = subjects.find(item => item.title.toLowerCase() === row.subject_title.toLowerCase());
            if (!subject) {
                subject = { title: row.subject_title, links: [] };
                subjects.push(subject);
            }
            subject.links.push({
                type: row.link_type,
                label: row.link_label,
                url: row.link_url
            });
        }

        return database;
    }

    async function saveResource(category, semester, resource, visibility) {
        await ensureLegacyImport();
        const departmentIds = validateVisibility(visibility);
        const client = await getPool().connect();
        try {
            await client.query('BEGIN');
            if (!visibility.all) {
                const departments = await client.query(
                    `SELECT department.id
                     FROM portal_departments AS department
                     JOIN portal_faculties AS faculty ON faculty.id = department.faculty_id
                     JOIN portal_universities AS university ON university.id = faculty.university_id
                     WHERE department.active = TRUE AND faculty.active = TRUE AND university.active = TRUE
                       AND department.id = ANY($1::BIGINT[])`,
                    [departmentIds]
                );
                if (departments.rowCount !== departmentIds.length) {
                    throw new Error('One or more selected departments are not active.');
                }
            }
            const result = await client.query(
                `INSERT INTO portal_resources
                    (category, semester, subject_title, link_type, link_label, link_url, visible_to_all_departments)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (category, semester, (LOWER(subject_title)), link_url)
                 DO UPDATE SET
                    link_type = EXCLUDED.link_type,
                    link_label = EXCLUDED.link_label,
                       visible_to_all_departments = EXCLUDED.visible_to_all_departments,
                       active = TRUE
                 RETURNING id`,
                [
                    category, Number(semester), resource.title, resource.link.type,
                    resource.link.label, resource.link.url, visibility.all
                ]
            );
            const resourceId = result.rows[0].id;
            await client.query('DELETE FROM portal_resource_departments WHERE resource_id = $1', [resourceId]);
            if (!visibility.all) {
                for (const departmentId of departmentIds) {
                    await client.query(
                        `INSERT INTO portal_resource_departments (resource_id, department_id)
                         VALUES ($1, $2)`,
                        [resourceId, departmentId]
                    );
                }
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        return true;
    }

    async function getActiveDepartments() {
        const result = await getPool().query(
            `SELECT department.id, department.name, faculty.name AS faculty,
                    university.id AS university_id, university.name AS university,
                    university.is_uovt
             FROM portal_departments AS department
             JOIN portal_faculties AS faculty ON faculty.id = department.faculty_id
             JOIN portal_universities AS university ON university.id = faculty.university_id
             WHERE department.active = TRUE AND faculty.active = TRUE AND university.active = TRUE
             ORDER BY LOWER(university.name), LOWER(faculty.name), LOWER(department.name), department.id`
        );
        return result.rows;
    }

    async function getSignupOrganizationOptions() {
        const [universities, faculties, departments] = await Promise.all([
            getPool().query(
                `SELECT id, name, is_uovt
                 FROM portal_universities
                 WHERE active = TRUE
                 ORDER BY is_uovt DESC, LOWER(name)`
            ),
            getPool().query(
                `SELECT faculty.id, faculty.name, faculty.university_id
                 FROM portal_faculties AS faculty
                 JOIN portal_universities AS university ON university.id = faculty.university_id
                 WHERE faculty.active = TRUE AND university.active = TRUE
                 ORDER BY LOWER(faculty.name)`
            ),
            getPool().query(
                `SELECT department.id, department.name, department.faculty_id
                 FROM portal_departments AS department
                 JOIN portal_faculties AS faculty ON faculty.id = department.faculty_id
                 JOIN portal_universities AS university ON university.id = faculty.university_id
                 WHERE department.active = TRUE AND faculty.active = TRUE AND university.active = TRUE
                 ORDER BY LOWER(department.name)`
            )
        ]);
        return {
            universities: universities.rows,
            faculties: faculties.rows,
            departments: departments.rows
        };
    }

    async function getPendingOrganizationRequests() {
        const result = await getPool().query(
            `SELECT request.id, request.university_name, request.faculty_name, request.department_name,
                    request.submitted_by, request.created_at,
                    COUNT(student.username)::INT AS student_count
             FROM portal_organization_requests AS request
             LEFT JOIN portal_users AS student ON student.organization_request_id = request.id
             WHERE request.status = 'pending'
             GROUP BY request.id
             ORDER BY request.created_at, request.id`
        );
        return result.rows;
    }

    async function getTranslations() {
        const result = await getPool().query(
            `SELECT id, source_text, english_text, sinhala_text, combined_text, updated_at
             FROM portal_translations
             ORDER BY LOWER(source_text), id`
        );
        return result.rows;
    }

    async function getTranslationMap() {
        const result = await getPool().query(
            `SELECT source_text, english_text, sinhala_text, combined_text
             FROM portal_translations
             WHERE english_text <> '' OR sinhala_text <> '' OR combined_text <> ''`
        );
        return result.rows;
    }

    async function saveTranslation({ sourceText, englishText, sinhalaText, combinedText }, updatedBy) {
        const result = await getPool().query(
            `INSERT INTO portal_translations
                (source_text, english_text, sinhala_text, combined_text, updated_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (LOWER(BTRIM(source_text)))
             DO UPDATE SET english_text = EXCLUDED.english_text,
                           sinhala_text = EXCLUDED.sinhala_text,
                           combined_text = EXCLUDED.combined_text,
                           updated_by = EXCLUDED.updated_by,
                           updated_at = NOW()
             RETURNING id`,
            [sourceText, englishText, sinhalaText, combinedText, updatedBy]
        );
        return result.rowCount === 1;
    }

    async function deleteTranslation(id) {
        const result = await getPool().query(
            'DELETE FROM portal_translations WHERE id = $1 RETURNING id',
            [id]
        );
        return result.rowCount === 1;
    }

    async function reviewOrganizationRequest(id, approved, reviewedBy) {
        const client = await getPool().connect();
        try {
            await client.query('BEGIN');
            const requestResult = await client.query(
                `SELECT id, university_name, faculty_name, department_name
                 FROM portal_organization_requests
                 WHERE id = $1 AND status = 'pending'
                 FOR UPDATE`,
                [id]
            );
            if (!requestResult.rowCount) {
                await client.query('ROLLBACK');
                return false;
            }
            const request = requestResult.rows[0];
            let universityId = null;
            let facultyId = null;
            let departmentId = null;
            if (approved) {
                universityId = await getOrCreateOrganizationId(
                    client,
                    'portal_universities',
                    null,
                    request.university_name
                );
                facultyId = await getOrCreateOrganizationId(
                    client,
                    'portal_faculties',
                    universityId,
                    request.faculty_name
                );
                departmentId = await getOrCreateOrganizationId(
                    client,
                    'portal_departments',
                    facultyId,
                    request.department_name
                );
                await client.query(
                    `UPDATE portal_users
                     SET university_id = university.id, university_name = university.name,
                         faculty = faculty.name, department_id = department.id,
                         department = department.name, organization_request_id = NULL
                     FROM portal_universities AS university,
                          portal_faculties AS faculty,
                          portal_departments AS department
                     WHERE portal_users.organization_request_id = $1
                       AND university.id = $2 AND faculty.id = $3 AND department.id = $4`,
                    [id, universityId, facultyId, departmentId]
                );
            }
            await client.query(
                `UPDATE portal_organization_requests
                 SET status = $2, resolved_university_id = $3, resolved_faculty_id = $4,
                     resolved_department_id = $5, reviewed_by = $6, reviewed_at = NOW()
                 WHERE id = $1`,
                [id, approved ? 'approved' : 'rejected', universityId, facultyId, departmentId, reviewedBy]
            );
            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async function getUniversities() {
        const result = await getPool().query(
            `SELECT university.id, university.name, university.is_uovt, university.active,
                    (SELECT COUNT(*) FROM portal_faculties AS faculty WHERE faculty.university_id = university.id) AS faculty_count,
                    (SELECT COUNT(*) FROM portal_users AS student WHERE student.university_id = university.id) AS student_count
             FROM portal_universities AS university
             ORDER BY university.is_uovt DESC, university.active DESC, LOWER(university.name)`
        );
        return result.rows;
    }

    async function addUniversity(name) {
        const result = await getPool().query(
            `INSERT INTO portal_universities (name)
             VALUES ($1) ON CONFLICT DO NOTHING RETURNING id`,
            [name]
        );
        return result.rowCount === 1;
    }

    async function setUniversityActive(id, active) {
        const result = await getPool().query(
            `UPDATE portal_universities
             SET active = $2
             WHERE id = $1 AND (is_uovt = FALSE OR $2 = TRUE)
             RETURNING id`,
            [id, active]
        );
        return result.rowCount === 1;
    }

    async function deleteUniversity(id) {
        const result = await getPool().query(
            `DELETE FROM portal_universities AS university
             WHERE university.id = $1 AND university.is_uovt = FALSE
               AND NOT EXISTS (SELECT 1 FROM portal_faculties AS faculty WHERE faculty.university_id = university.id)
               AND NOT EXISTS (SELECT 1 FROM portal_users AS student WHERE student.university_id = university.id)
             RETURNING id`,
            [id]
        );
        return result.rowCount === 1;
    }

    async function getDepartments() {
        const result = await getPool().query(
            `SELECT department.id, department.name, department.active, department.faculty_id,
                    faculty.name AS faculty, faculty.active AS faculty_active, faculty.university_id,
                    university.name AS university, university.active AS university_active,
                    university.is_uovt,
                    (SELECT COUNT(*) FROM portal_users AS student WHERE student.department_id = department.id) AS student_count,
                    (SELECT COUNT(*) FROM portal_resource_departments AS access WHERE access.department_id = department.id) AS resource_count
             FROM portal_departments AS department
             JOIN portal_faculties AS faculty ON faculty.id = department.faculty_id
             JOIN portal_universities AS university ON university.id = faculty.university_id
             ORDER BY university.is_uovt DESC, university.active DESC, LOWER(university.name),
                      faculty.active DESC, LOWER(faculty.name), department.active DESC, LOWER(department.name)`
        );
        return result.rows;
    }

    async function getFaculties() {
        const result = await getPool().query(
            `SELECT faculty.id, faculty.name, faculty.active, faculty.university_id,
                    university.name AS university, university.active AS university_active, university.is_uovt,
                    (SELECT COUNT(*) FROM portal_departments AS department WHERE department.faculty_id = faculty.id) AS department_count
             FROM portal_faculties AS faculty
             JOIN portal_universities AS university ON university.id = faculty.university_id
             ORDER BY university.is_uovt DESC, university.active DESC, LOWER(university.name),
                      faculty.active DESC, LOWER(faculty.name)`
        );
        return result.rows;
    }

    async function addFaculty(name, universityId) {
        const result = await getPool().query(
            `INSERT INTO portal_faculties (name, university_id)
             SELECT $1, university.id
             FROM portal_universities AS university
             WHERE university.id = $2 AND university.active = TRUE
             ON CONFLICT DO NOTHING RETURNING id`,
            [name, universityId]
        );
        return result.rowCount === 1;
    }

    async function setFacultyActive(id, active) {
        const result = await getPool().query(
            `UPDATE portal_faculties
             SET active = $2
             WHERE id = $1
               AND EXISTS (SELECT 1 FROM portal_universities AS university
                           WHERE university.id = portal_faculties.university_id AND university.active = TRUE)
               AND ($2 = TRUE OR EXISTS (
                    SELECT 1
                    FROM portal_faculties AS other_faculty
                    JOIN portal_universities AS university ON university.id = other_faculty.university_id
                    WHERE other_faculty.id <> $1
                      AND other_faculty.active = TRUE
                      AND university.active = TRUE
               ))
             RETURNING id`,
            [id, active]
        );
        return result.rowCount === 1;
    }

    async function deleteFaculty(id) {
        const result = await getPool().query(
            `DELETE FROM portal_faculties AS faculty
             WHERE faculty.id = $1
               AND NOT EXISTS (SELECT 1 FROM portal_departments AS department WHERE department.faculty_id = faculty.id)
             RETURNING id`,
            [id]
        );
        return result.rowCount === 1;
    }

    async function addDepartment(name, facultyId) {
        const result = await getPool().query(
            `INSERT INTO portal_departments (name, faculty_id)
             SELECT $1, faculty.id
             FROM portal_faculties AS faculty
             JOIN portal_universities AS university ON university.id = faculty.university_id
             WHERE faculty.id = $2 AND faculty.active = TRUE AND university.active = TRUE
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [name, facultyId]
        );
        return result.rowCount === 1;
    }

    async function setDepartmentActive(id, active) {
        const result = await getPool().query(
            `UPDATE portal_departments
             SET active = $2
             WHERE id = $1
               AND EXISTS (SELECT 1 FROM portal_faculties AS faculty
                           JOIN portal_universities AS university ON university.id = faculty.university_id
                           WHERE faculty.id = portal_departments.faculty_id
                             AND faculty.active = TRUE AND university.active = TRUE)
               AND ($2 = TRUE OR EXISTS (
                    SELECT 1
                    FROM portal_departments AS other_department
                    JOIN portal_faculties AS faculty ON faculty.id = other_department.faculty_id
                    JOIN portal_universities AS university ON university.id = faculty.university_id
                    WHERE other_department.id <> $1
                      AND other_department.active = TRUE
                      AND faculty.active = TRUE
                      AND university.active = TRUE
               ))
             RETURNING id`,
            [id, active]
        );
        return result.rowCount === 1;
    }

    async function deleteDepartment(id) {
        const result = await getPool().query(
            `DELETE FROM portal_departments AS department
             WHERE department.id = $1
               AND NOT EXISTS (SELECT 1 FROM portal_users AS student WHERE student.department_id = department.id)
               AND NOT EXISTS (SELECT 1 FROM portal_resource_departments AS access WHERE access.department_id = department.id)
             RETURNING id`,
            [id]
        );
        return result.rowCount === 1;
    }

    async function getAdminResources() {
        const result = await getPool().query(
            `SELECT resource.id, resource.category, resource.semester, resource.subject_title,
                    resource.link_type, resource.link_label, resource.link_url,
                    resource.visible_to_all_departments, resource.active,
                    COALESCE(
                        ARRAY_AGG(department.id ORDER BY LOWER(department.name))
                            FILTER (WHERE department.id IS NOT NULL),
                        ARRAY[]::BIGINT[]
                    ) AS department_ids,
                    COALESCE(
                        ARRAY_AGG(university.name || ' → ' || faculty.name || ' → ' || department.name
                                  ORDER BY LOWER(university.name), LOWER(faculty.name), LOWER(department.name))
                            FILTER (WHERE department.id IS NOT NULL),
                        ARRAY[]::TEXT[]
                    ) AS department_names
             FROM portal_resources AS resource
             LEFT JOIN portal_resource_departments AS access ON access.resource_id = resource.id
             LEFT JOIN portal_departments AS department ON department.id = access.department_id
             LEFT JOIN portal_faculties AS faculty ON faculty.id = department.faculty_id
             LEFT JOIN portal_universities AS university ON university.id = faculty.university_id
             GROUP BY resource.id
             ORDER BY resource.category, resource.semester, LOWER(resource.subject_title), resource.id`
        );
        return result.rows;
    }

    async function updateResourceDetails(resourceId, { subjectTitle, linkType, linkLabel, linkUrl }) {
        const result = await getPool().query(
            `UPDATE portal_resources
             SET subject_title = $2, link_type = $3, link_label = $4, link_url = $5
             WHERE id = $1
             RETURNING id`,
            [resourceId, subjectTitle, linkType, linkLabel, linkUrl]
        );
        return result.rowCount === 1;
    }

    async function setResourceActive(resourceId, active) {
        const result = await getPool().query(
            `UPDATE portal_resources
             SET active = $2
             WHERE id = $1
             RETURNING id`,
            [resourceId, active]
        );
        return result.rowCount === 1;
    }

    async function deleteResource(resourceId) {
        const result = await getPool().query(
            `DELETE FROM portal_resources
             WHERE id = $1
             RETURNING id`,
            [resourceId]
        );
        return result.rowCount === 1;
    }

    async function getAdminDashboardStats() {
        const [
            totals,
            universities,
            departments,
            faculties,
            registrations
        ] = await Promise.all([
            getPool().query(
                `SELECT COUNT(*)::INT AS total_users,
                        COUNT(*) FILTER (WHERE university.is_uovt = TRUE)::INT AS uovt_users,
                        COUNT(*) FILTER (WHERE university.is_uovt = FALSE)::INT AS other_university_users,
                        COUNT(*) FILTER (WHERE student.account_active = TRUE)::INT AS active_users,
                        COUNT(*) FILTER (WHERE student.account_active = FALSE)::INT AS disabled_users,
                        COUNT(*) FILTER (WHERE student.organization_request_id IS NOT NULL)::INT AS pending_organization_users,
                        COUNT(*) FILTER (WHERE student.created_at >= NOW() - INTERVAL '30 days')::INT AS new_users_30_days,
                        COUNT(*) FILTER (WHERE student.created_at >= NOW() - INTERVAL '7 days')::INT AS new_users_7_days,
                        (SELECT COUNT(*)::INT FROM portal_universities WHERE active = TRUE) AS active_universities,
                        (SELECT COUNT(*)::INT
                         FROM portal_faculties AS faculty
                         JOIN portal_universities AS university ON university.id = faculty.university_id
                         WHERE faculty.active = TRUE AND university.active = TRUE) AS active_faculties,
                        (SELECT COUNT(*)::INT
                         FROM portal_departments AS department
                         JOIN portal_faculties AS faculty ON faculty.id = department.faculty_id
                         JOIN portal_universities AS university ON university.id = faculty.university_id
                         WHERE department.active = TRUE AND faculty.active = TRUE AND university.active = TRUE) AS active_departments,
                        (SELECT COUNT(*)::INT FROM portal_resources) AS total_resources
                 FROM portal_users AS student
                 LEFT JOIN portal_universities AS university ON university.id = student.university_id`
            ),
            getPool().query(
                `SELECT university.id, university.name, university.is_uovt, university.active,
                       COUNT(student.username)::INT AS user_count
                FROM portal_universities AS university
                LEFT JOIN portal_users AS student ON student.university_id = university.id
                 GROUP BY university.id
                 ORDER BY user_count DESC, LOWER(university.name)`
            ),
            getPool().query(
                `SELECT department.id, department.name, faculty.name AS faculty,
                        university.name AS university, COUNT(student.username)::INT AS user_count
                 FROM portal_departments AS department
                 JOIN portal_faculties AS faculty ON faculty.id = department.faculty_id
                 JOIN portal_universities AS university ON university.id = faculty.university_id
                 LEFT JOIN portal_users AS student ON student.department_id = department.id
                 WHERE department.active = TRUE AND faculty.active = TRUE AND university.active = TRUE
                 GROUP BY department.id, faculty.name, university.name
                 ORDER BY user_count DESC, LOWER(department.name)
                 LIMIT 15`
            ),
            getPool().query(
                `SELECT faculty.id, faculty.name, university.name AS university,
                        COUNT(student.username)::INT AS user_count
                 FROM portal_faculties AS faculty
                 JOIN portal_universities AS university ON university.id = faculty.university_id
                 LEFT JOIN portal_departments AS department ON department.faculty_id = faculty.id
                 LEFT JOIN portal_users AS student ON student.department_id = department.id
                 WHERE faculty.active = TRUE AND university.active = TRUE
                 GROUP BY faculty.id, university.name
                 ORDER BY user_count DESC, LOWER(faculty.name)
                 LIMIT 12`
            ),
            getPool().query(
                `SELECT TO_CHAR(day::DATE, 'YYYY-MM-DD') AS date,
                        COUNT(student.username)::INT AS user_count
                 FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS day
                 LEFT JOIN portal_users AS student ON student.created_at::DATE = day::DATE
                 GROUP BY day
                 ORDER BY day`
            )
        ]);
        return {
            totals: totals.rows[0],
            universities: universities.rows,
            departments: departments.rows,
            faculties: faculties.rows,
            registrations: registrations.rows
        };
    }

    async function getAdminUsers({ query = '', scope = 'all', universityId = null, departmentId = null } = {}) {
        const result = await getPool().query(
            `SELECT student.username, student.university_index_no, student.university_email,
                    student.created_at, student.current_semester, student.account_active,
                    university.id AS university_id, COALESCE(university.name, student.university_name) AS university,
                    university.is_uovt, student.organization_request_id,
                    faculty.name AS faculty, department.id AS department_id, department.name AS department
             FROM portal_users AS student
             LEFT JOIN portal_universities AS university ON university.id = student.university_id
             LEFT JOIN portal_departments AS department ON department.id = student.department_id
             LEFT JOIN portal_faculties AS faculty ON faculty.id = department.faculty_id
             WHERE ($1::TEXT = '' OR
                    student.username ILIKE '%' || $1 || '%' OR
                    COALESCE(student.university_index_no, '') ILIKE '%' || $1 || '%' OR
                    COALESCE(student.university_email, '') ILIKE '%' || $1 || '%' OR
                    COALESCE(university.name, student.university_name, '') ILIKE '%' || $1 || '%' OR
                    COALESCE(department.name, '') ILIKE '%' || $1 || '%')
               AND ($2::TEXT = 'all'
                    OR ($2 = 'uovt' AND university.is_uovt = TRUE)
                    OR ($2 = 'other' AND university.is_uovt = FALSE)
                    OR ($2 = 'disabled' AND student.account_active = FALSE)
                    OR ($2 = 'pending' AND student.organization_request_id IS NOT NULL))
               AND ($3::BIGINT IS NULL OR student.university_id = $3)
               AND ($4::BIGINT IS NULL OR student.department_id = $4)
             ORDER BY student.created_at DESC
             LIMIT 1000`,
            [query.trim().slice(0, 100), scope, universityId, departmentId]
        );
        return result.rows;
    }

    async function setUserAccountActive(username, active) {
        const client = await getPool().connect();
        try {
            await client.query('BEGIN');
            const result = await client.query(
                'UPDATE portal_users SET account_active = $2 WHERE username = $1 RETURNING username',
                [username, active]
            );
            if (result.rowCount === 1 && !active) {
                await client.query(
                    "DELETE FROM portal_sessions WHERE username = $1 AND session_type = 'student'",
                    [username]
                );
            }
            await client.query('COMMIT');
            return result.rowCount === 1;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async function deleteUser(username) {
        const client = await getPool().connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM portal_sessions WHERE username = $1 AND session_type = $2', [username, 'student']);
            await client.query('DELETE FROM portal_password_resets WHERE username = $1', [username]);
            const result = await client.query('DELETE FROM portal_users WHERE username = $1 RETURNING username', [username]);
            await client.query('COMMIT');
            return result.rowCount === 1;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async function updateResourceVisibility(resourceId, visibility) {
        const departmentIds = validateVisibility(visibility);
        const client = await getPool().connect();
        try {
            await client.query('BEGIN');
            if (!visibility.all) {
                const departments = await client.query(
                    `SELECT department.id
                     FROM portal_departments AS department
                     JOIN portal_faculties AS faculty ON faculty.id = department.faculty_id
                     WHERE department.active = TRUE AND faculty.active = TRUE
                       AND department.id = ANY($1::BIGINT[])`,
                    [departmentIds]
                );
                if (departments.rowCount !== departmentIds.length) {
                    throw new Error('One or more selected departments are not active.');
                }
            }
            const result = await client.query(
                `UPDATE portal_resources
                 SET visible_to_all_departments = $2
                 WHERE id = $1
                 RETURNING id`,
                [resourceId, visibility.all]
            );
            if (result.rowCount !== 1) {
                await client.query('ROLLBACK');
                return false;
            }
            await client.query('DELETE FROM portal_resource_departments WHERE resource_id = $1', [resourceId]);
            if (!visibility.all) {
                for (const departmentId of departmentIds) {
                    await client.query(
                        `INSERT INTO portal_resource_departments (resource_id, department_id)
                         VALUES ($1, $2)`,
                        [resourceId, departmentId]
                    );
                }
            }
            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async function findUser(username) {
        const result = await getPool().query(
            'SELECT username, password_salt AS salt, password_hash AS "passwordHash", account_active FROM portal_users WHERE username = $1',
            [username]
        );
        if (result.rows[0]) return result.rows[0];

        if (!isRedisConfigured()) return null;
        const legacy = await redisCommand('GET', legacyUserKey(username));
        if (!legacy) return null;
        const user = JSON.parse(legacy);
        if (user.username !== username || typeof user.salt !== 'string' || typeof user.passwordHash !== 'string') {
            throw new Error('Stored legacy account record has an invalid format.');
        }
        return { ...user, legacy: true };
    }

    async function findUserByUniversityEmail(email) {
        const result = await getPool().query(
            `SELECT username, university_email
             FROM portal_users
             WHERE LOWER(university_email) = $1`,
            [email]
        );
        return result.rows[0] || null;
    }

    async function getStudentProfile(username) {
        const result = await getPool().query(
            `SELECT student.university_index_no, student.department, student.faculty,
                    student.university_name, student.organization_request_id,
                    request.status AS organization_request_status,
                    student.university_id, student.department_id, university.name AS university,
                    student.current_semester, student.gender, student.date_of_birth,
                    student.university_email, student.terms_accepted_at
             FROM portal_users AS student
             LEFT JOIN portal_universities AS university ON university.id = student.university_id
             LEFT JOIN portal_organization_requests AS request ON request.id = student.organization_request_id
             WHERE student.username = $1`,
            [username]
        );
        return result.rows[0] || null;
    }

    async function createUser(user) {
        const client = await getPool().connect();
        try {
            await client.query('BEGIN');
            const organization = await resolveOrganization(client, user, user.username);
            const result = await client.query(
                `INSERT INTO portal_users (
                    username, password_salt, password_hash, university_index_no, university_id,
                    university_name, department, faculty, department_id, organization_request_id,
                    current_semester, gender, date_of_birth, telephone, university_email,
                    terms_accepted_at, terms_version
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                 ON CONFLICT DO NOTHING
                 RETURNING username`,
                [
                    user.username, user.salt, user.passwordHash, user.universityIndexNo || null,
                    organization.universityId, organization.universityName, organization.departmentName,
                    organization.facultyName, organization.departmentId, organization.requestId,
                    user.currentSemester || null, user.gender || null, user.dateOfBirth || null,
                    user.telephone || null, user.universityEmail || null,
                    user.termsAcceptedAt || null, user.termsVersion || null
                ]
            );
            if (!result.rowCount) {
                await client.query('ROLLBACK');
                return false;
            }
            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async function updateStudentProfile(username, profile) {
        const client = await getPool().connect();
        try {
            await client.query('BEGIN');
            const organization = await resolveOrganization(client, profile, username);
            const result = await client.query(
                `UPDATE portal_users
                 SET university_index_no = $2, university_id = $3, university_name = $4,
                     department = $5, faculty = $6, department_id = $7, organization_request_id = $8,
                     current_semester = $9, gender = $10, date_of_birth = $11, telephone = $12,
                     university_email = $13, terms_accepted_at = $14, terms_version = $15
                 WHERE username = $1
                 RETURNING username`,
                [
                    username, profile.universityIndexNo, organization.universityId,
                    organization.universityName, organization.departmentName, organization.facultyName,
                    organization.departmentId, organization.requestId, profile.currentSemester,
                    profile.gender, profile.dateOfBirth, profile.telephone || null,
                    profile.universityEmail, profile.termsAcceptedAt, profile.termsVersion
                ]
            );
            await client.query('COMMIT');
            return result.rowCount === 1;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async function createPasswordReset(token, username, ttlSeconds) {
        const result = await getPool().query(
            `INSERT INTO portal_password_resets (token_hash, username, expires_at)
             VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 second'))
             ON CONFLICT (username) DO UPDATE
             SET token_hash = EXCLUDED.token_hash,
                 expires_at = EXCLUDED.expires_at,
                 created_at = NOW()
             WHERE portal_password_resets.created_at < NOW() - INTERVAL '1 minute'
             RETURNING username`,
            [hashSessionToken(token), username, ttlSeconds]
        );
        return result.rowCount === 1;
    }

    async function deletePasswordReset(token) {
        await getPool().query(
            'DELETE FROM portal_password_resets WHERE token_hash = $1',
            [hashSessionToken(token)]
        );
    }

    async function getPasswordResetUsername(token) {
        const result = await getPool().query(
            `SELECT username
             FROM portal_password_resets
             WHERE token_hash = $1 AND expires_at > NOW()`,
            [hashSessionToken(token)]
        );
        return result.rows[0]?.username || null;
    }

    async function updatePasswordFromReset(token, salt, passwordHash) {
        const result = await getPool().query(
            `WITH used_token AS (
                DELETE FROM portal_password_resets
                WHERE token_hash = $1 AND expires_at > NOW()
                RETURNING username
             ),
             updated_user AS (
                UPDATE portal_users
                SET password_salt = $2, password_hash = $3
                FROM used_token
                WHERE portal_users.username = used_token.username
                RETURNING portal_users.username
             ),
             removed_sessions AS (
                DELETE FROM portal_sessions
                USING updated_user
                WHERE portal_sessions.username = updated_user.username
                  AND portal_sessions.session_type = 'student'
                RETURNING portal_sessions.token_hash
             )
             SELECT username FROM updated_user`,
            [hashSessionToken(token), salt, passwordHash]
        );
        return result.rowCount === 1;
    }

    async function createSession(token, username, sessionType, ttlSeconds) {
        await getPool().query(
            `INSERT INTO portal_sessions (token_hash, username, session_type, expires_at)
             VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 second'))`,
            [hashSessionToken(token), username, sessionType, ttlSeconds]
        );
    }

    async function getSession(token, sessionType) {
        const result = await getPool().query(
            `SELECT username FROM portal_sessions
             WHERE token_hash = $1 AND session_type = $2 AND expires_at > NOW()`,
            [hashSessionToken(token), sessionType]
        );
        return result.rows[0]?.username || null;
    }

    async function deleteSession(token, sessionType) {
        await getPool().query(
            'DELETE FROM portal_sessions WHERE token_hash = $1 AND session_type = $2',
            [hashSessionToken(token), sessionType]
        );
    }

    async function redisCommand(...command) {
        const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
        const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
        if (!redisUrl || !redisToken) {
            throw new Error('Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
        }

        const response = await fetch(redisUrl.replace(/\/+$/, ''), {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + redisToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(command)
        });
        if (!response.ok) throw new Error('Redis request failed with status ' + response.status + '.');
        const result = await response.json();
        if (result.error) throw new Error('Redis command failed: ' + result.error);
        return result.result;
    }

    return {
        initialize: ensureLegacyImport,
        getPortalDatabase,
        saveResource,
        getActiveDepartments,
        getSignupOrganizationOptions,
        getPendingOrganizationRequests,
        reviewOrganizationRequest,
        getTranslations,
        getTranslationMap,
        saveTranslation,
        deleteTranslation,
        getUniversities,
        addUniversity,
        setUniversityActive,
        deleteUniversity,
        getDepartments,
        getFaculties,
        addFaculty,
        setFacultyActive,
        deleteFaculty,
        addDepartment,
        setDepartmentActive,
        deleteDepartment,
        getAdminResources,
        getAdminDashboardStats,
        getAdminUsers,
        setUserAccountActive,
        deleteUser,
        updateResourceVisibility,
        updateResourceDetails,
        setResourceActive,
        deleteResource,
        findUser,
        findUserByUniversityEmail,
        getStudentProfile,
        createUser,
        updateStudentProfile,
        createPasswordReset,
        deletePasswordReset,
        getPasswordResetUsername,
        updatePasswordFromReset,
        createSession,
        getSession,
        deleteSession,
        redisCommand
    };
}

async function resolveOrganization(client, profile, submittedBy) {
    if (profile.universityId && profile.departmentId) {
        const selected = await client.query(
            `SELECT university.id AS university_id, university.name AS university_name,
                    faculty.id AS faculty_id, faculty.name AS faculty_name,
                    department.id AS department_id, department.name AS department_name
             FROM portal_departments AS department
             JOIN portal_faculties AS faculty ON faculty.id = department.faculty_id
             JOIN portal_universities AS university ON university.id = faculty.university_id
             WHERE university.id = $1 AND department.id = $2
               AND university.active = TRUE AND faculty.active = TRUE AND department.active = TRUE`,
            [profile.universityId, profile.departmentId]
        );
        if (!selected.rowCount) throw new Error('The selected campus, faculty, or department is no longer active.');
        return {
            universityId: selected.rows[0].university_id,
            universityName: selected.rows[0].university_name,
            facultyName: selected.rows[0].faculty_name,
            departmentId: selected.rows[0].department_id,
            departmentName: selected.rows[0].department_name,
            requestId: null
        };
    }

    const universityName = normalizeOrganizationName(profile.universityName);
    const facultyName = normalizeOrganizationName(profile.facultyName);
    const departmentName = normalizeOrganizationName(profile.departmentName);
    if (!universityName || !facultyName || !departmentName) {
        throw new TypeError('A campus, faculty, and department are required for an organization request.');
    }

    const existing = await client.query(
        `SELECT university.id AS university_id, university.name AS university_name,
                faculty.name AS faculty_name, department.id AS department_id,
                department.name AS department_name
         FROM portal_universities AS university
         JOIN portal_faculties AS faculty ON faculty.university_id = university.id
         JOIN portal_departments AS department ON department.faculty_id = faculty.id
         WHERE LOWER(REGEXP_REPLACE(BTRIM(university.name), '[[:space:]]+', ' ', 'g')) =
                   LOWER(REGEXP_REPLACE(BTRIM($1), '[[:space:]]+', ' ', 'g'))
           AND LOWER(REGEXP_REPLACE(BTRIM(faculty.name), '[[:space:]]+', ' ', 'g')) =
                   LOWER(REGEXP_REPLACE(BTRIM($2), '[[:space:]]+', ' ', 'g'))
           AND LOWER(REGEXP_REPLACE(BTRIM(department.name), '[[:space:]]+', ' ', 'g')) =
                   LOWER(REGEXP_REPLACE(BTRIM($3), '[[:space:]]+', ' ', 'g'))
           AND university.active = TRUE AND faculty.active = TRUE AND department.active = TRUE`,
        [universityName, facultyName, departmentName]
    );
    if (existing.rowCount) {
        return {
            universityId: existing.rows[0].university_id,
            universityName: existing.rows[0].university_name,
            facultyName: existing.rows[0].faculty_name,
            departmentId: existing.rows[0].department_id,
            departmentName: existing.rows[0].department_name,
            requestId: null
        };
    }

    const request = await client.query(
        `INSERT INTO portal_organization_requests (university_name, faculty_name, department_name, submitted_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (
             LOWER(REGEXP_REPLACE(BTRIM(university_name), '[[:space:]]+', ' ', 'g')),
             LOWER(REGEXP_REPLACE(BTRIM(faculty_name), '[[:space:]]+', ' ', 'g')),
             LOWER(REGEXP_REPLACE(BTRIM(department_name), '[[:space:]]+', ' ', 'g'))
         ) WHERE status = 'pending'
         DO UPDATE SET university_name = portal_organization_requests.university_name
         RETURNING id`,
        [universityName, facultyName, departmentName, submittedBy]
    );
    return {
        universityId: null,
        universityName,
        facultyName,
        departmentId: null,
        departmentName,
        requestId: request.rows[0].id
    };
}

async function getOrCreateOrganizationId(client, table, parentId, name) {
    const normalizedName = normalizeOrganizationName(name);
    if (!normalizedName) throw new TypeError('Organization names must contain 1-100 characters.');
    if (table === 'portal_universities') {
        await client.query(
            `INSERT INTO portal_universities (name) VALUES ($1)
             ON CONFLICT DO NOTHING`,
            [normalizedName]
        );
        const result = await client.query(
            `SELECT id FROM portal_universities
             WHERE LOWER(REGEXP_REPLACE(BTRIM(name), '[[:space:]]+', ' ', 'g')) =
                   LOWER(REGEXP_REPLACE(BTRIM($1), '[[:space:]]+', ' ', 'g'))
             ORDER BY active DESC, id LIMIT 1`,
            [normalizedName]
        );
        if (!result.rowCount) throw new Error('Could not resolve the approved university.');
        await client.query('UPDATE portal_universities SET active = TRUE WHERE id = $1', [result.rows[0].id]);
        return result.rows[0].id;
    }

    const parentColumn = table === 'portal_faculties' ? 'university_id' : 'faculty_id';
    await client.query(
        `INSERT INTO ${table} (${parentColumn}, name) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [parentId, normalizedName]
    );
    const result = await client.query(
        `SELECT id FROM ${table}
         WHERE ${parentColumn} = $1
           AND LOWER(REGEXP_REPLACE(BTRIM(name), '[[:space:]]+', ' ', 'g')) =
               LOWER(REGEXP_REPLACE(BTRIM($2), '[[:space:]]+', ' ', 'g'))
         ORDER BY active DESC, id LIMIT 1`,
        [parentId, normalizedName]
    );
    if (!result.rowCount) throw new Error('Could not resolve the approved faculty or department.');
    await client.query(`UPDATE ${table} SET active = TRUE WHERE id = $1`, [result.rows[0].id]);
    return result.rows[0].id;
}

function normalizeOrganizationName(value) {
    if (typeof value !== 'string') return null;
    const name = value.trim().replace(/\s+/g, ' ');
    return name.length >= 2 && name.length <= 100 && !/[\r\n<>]/.test(name) ? name : null;
}

function isRedisConfigured() {
    return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function hashSessionToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

function getCaCertificate(value) {
    if (value.includes('-----BEGIN CERTIFICATE-----')) return value;

    if (/^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.replace(/\s/g, '').length > 100) {
        try {
            return new X509Certificate(Buffer.from(value.replace(/\s/g, ''), 'base64')).toString();
        } catch {
            throw new Error('SUPABASE_DB_CA_CERT is not a valid PEM or base64-encoded X.509 certificate.');
        }
    }

    return readFileSync(value, 'utf8');
}

function parseLegacyDatabase(value) {
    if (!value) return DEFAULT_DATABASE;
    let database = value;
    for (let attempt = 0; attempt < 2 && typeof database === 'string'; attempt++) {
        database = JSON.parse(database);
    }
    if (!database || typeof database !== 'object' || Array.isArray(database)) {
        throw new Error('Redis portal_database has an invalid format; refusing to import it.');
    }
    return database;
}

function isValidResourceLink(link) {
    return link
        && ['yt', 'telegram', 'drive', 'whatsapp', 'default'].includes(link.type)
        && typeof link.label === 'string'
        && typeof link.url === 'string'
        && /^https:\/\//.test(link.url);
}

function validateVisibility(visibility) {
    if (!visibility || typeof visibility.all !== 'boolean' || !Array.isArray(visibility.departmentIds)) {
        throw new TypeError('Resource visibility must include an all-departments choice and a department list.');
    }
    if (visibility.all) return [];
    const ids = [...new Set(visibility.departmentIds.map(Number))];
    if (ids.length === 0 || ids.some(id => !Number.isSafeInteger(id) || id < 1)) {
        throw new TypeError('Choose at least one valid active department for this resource.');
    }
    return ids;
}

function legacyUserKey(username) {
    return `portal_user:${Buffer.from(username).toString('base64url')}`;
}
