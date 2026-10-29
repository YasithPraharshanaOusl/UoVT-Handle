export default function ForgotPasswordForm() {
    return `
        <h2>Forgot your password?</h2>
        <p class="auth-intro">Enter the university email address on your account. If it matches, we will send a secure password reset link.</p>
        <form action="/account/forgot-password" method="POST">
            <div class="form-group">
                <label for="universityEmail">University email address</label>
                <input type="email" id="universityEmail" name="universityEmail" maxlength="254" autocomplete="email" required>
            </div>
            <button type="submit">Send reset link</button>
        </form>
        <p class="auth-switch"><a href="/account/login">Back to log in</a></p>
    `;
}