export default function Navbar() {
    return `
        <nav class="navbar">
            <div class="nav-container">
                <a href="/" class="logo">ශිෂ්‍ය අවකාශය</a>
                <ul class="nav-links" id="navLinks">
                    <li><a href="/">මුල් පිටුව</a></li>
                    <li><a href="/about">අපි ගැන</a></li>
                    <li><a href="/services">සේවා</a></li>
                    <li><a href="/contact">සම්බන්ධ වන්න</a></li>
                    <li><a href="/account">ඔබගේ ගිණුම</a></li>
                </ul>
                <button class="menu-toggle" id="mobileMenu" type="button" aria-label="Toggle navigation" aria-controls="navLinks" aria-expanded="false">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
        </nav>
        
        <script>
            // Mobile menu toggle script
            document.addEventListener("DOMContentLoaded", () => {
                const mobileMenu = document.getElementById("mobileMenu");
                const navLinks = document.getElementById("navLinks");
                
                if(mobileMenu) {
                    mobileMenu.addEventListener("click", () => {
                        const isExpanded = mobileMenu.getAttribute("aria-expanded") === "true";
                        mobileMenu.setAttribute("aria-expanded", String(!isExpanded));
                        navLinks.classList.toggle("active", !isExpanded);
                    });
                }
            });
        </script>
    `;
}