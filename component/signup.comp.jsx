export default function SignupForm() {
    return `
        <h2>Create account</h2>
        <p class="auth-intro">Create your student account to access learning resources. Your information stays private and is used only to run this student project.</p>
        <form action="/account/signup" method="POST">
            <div class="signup-grid">
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" name="username" minlength="3" maxlength="32" autocomplete="username" required>
                </div>
                <div class="form-group">
                    <label for="universityIndexNo">University index number</label>
                    <input type="text" id="universityIndexNo" name="universityIndexNo" minlength="3" maxlength="32" placeholder="e.g. 2024/ICT/001" autocomplete="off" required>
                </div>
                <fieldset class="organization-selectors" data-organization-form>
                    <legend>University / campus → faculty → department</legend>
                    <div class="form-group">
                        <label for="universityId">University / campus</label>
                        <select id="universityId" name="universityId" required disabled>
                            <option value="">Loading campuses...</option>
                        </select>
                        <input id="universityName" name="universityName" maxlength="100" placeholder="Enter campus name" hidden disabled>
                    </div>
                    <div class="form-group">
                        <label for="facultyId">Faculty</label>
                        <select id="facultyId" name="facultyId" required disabled>
                            <option value="">Choose your campus first</option>
                        </select>
                        <input id="facultyName" name="facultyName" maxlength="100" placeholder="Enter faculty name" hidden disabled>
                    </div>
                    <div class="form-group">
                        <label for="departmentId">Department</label>
                        <select id="departmentId" name="departmentId" required disabled>
                            <option value="">Choose your faculty first</option>
                        </select>
                        <input id="departmentName" name="departmentName" maxlength="100" placeholder="Enter department name" hidden disabled>
                    </div>
                    <small data-organization-status aria-live="polite" hidden></small>
                </fieldset>
                <div class="form-group">
                    <label for="currentSemester">Current semester</label>
                    <select id="currentSemester" name="currentSemester" required>
                        <option value="" selected disabled>Choose your semester</option>
                        ${Array.from({ length: 8 }, (_, index) => `<option value="${index + 1}">Semester ${index + 1}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="gender">Gender</label>
                    <select id="gender" name="gender" required>
                        <option value="" selected disabled>Choose an option</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="dateOfBirth">Birthday</label>
                    <input type="date" id="dateOfBirth" name="dateOfBirth" max="${new Date().toISOString().slice(0, 10)}" autocomplete="bday" required>
                </div>
                <div class="form-group">
                    <label for="telephone">Telephone <span class="optional-label">Optional</span></label>
                    <input type="tel" id="telephone" name="telephone" maxlength="24" placeholder="+94 7X XXX XXXX" autocomplete="tel">
                </div>
                <div class="form-group">
                    <label for="universityEmail">University email address</label>
                    <input type="email" id="universityEmail" name="universityEmail" maxlength="254" placeholder="name@university.edu" autocomplete="email" required>
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" minlength="8" maxlength="128" autocomplete="new-password" required>
                </div>
                <div class="form-group">
                    <label for="passwordConfirm">Confirm password</label>
                    <input type="password" id="passwordConfirm" name="passwordConfirm" minlength="8" maxlength="128" autocomplete="new-password" required>
                </div>
            </div>
            <label class="terms-consent">
                <input type="checkbox" name="termsAccepted" value="yes" required>
                <span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms and Conditions</a> and confirm that I have read the <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</a>.</span>
            </label>
            <button type="submit">Create student account</button>
        </form>
        <p class="auth-switch">Already have an account? <a href="/account/login">Log in</a></p>
        <script src="/js/organization-selector.js" defer></script>
    `;
}