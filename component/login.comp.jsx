export default function LoginForm() {
    return `
        <h2>Log in</h2>
        <form action="/account/login" method="POST">
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" autocomplete="username" required>
            </div>
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" autocomplete="current-password" required>
            </div>
            <p class="forgot-password-link"><a href="/account/forgot-password">Forgot your password?</a></p>
            <button type="submit">Log in</button>
        </form>
        <p class="auth-switch">Don't have an account? <a href="/account/signup">Sign up</a></p>
    `;
}