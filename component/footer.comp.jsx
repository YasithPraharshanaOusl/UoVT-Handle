export default function Footer() {
    return `
        <footer class="site-footer">
            <small>© ${new Date().getFullYear()} All rights reserved.</small>
            <nav class="footer-links" aria-label="Footer navigation">
                <a href="https://uovt.ac.lk">UoVT</a>
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms</a>
                <a href="/contact">Contact</a>
            </nav>
        </footer>
    `;
}
