import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    useEffect(() => {
        function handleResize() {
            if (window.innerWidth > 760) setMobileMenuOpen(false);
        }

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const closeTimer = window.setTimeout(() => {
            setMobileMenuOpen(false);
        }, 0);

        return () => window.clearTimeout(closeTimer);
    }, [location.pathname]);

    useEffect(() => {
        function handleKeyDown(event) {
            // Avoid triggering when user is actively typing in an input or textarea
            const target = event.target;
            const isTyping =
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable;

            if (!isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                navigate("/search");
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [navigate]);

    const isMac =
        typeof navigator !== "undefined" &&
        /Mac|iPod|iPhone|iPad/.test(navigator.platform);

    return (
        <nav className="navbar">
            <Link to="/" className="logo" aria-label="MovieBox home" onClick={() => setMobileMenuOpen(false)}>
                MOVIEBOX
            </Link>

            <div className={`nav-links ${mobileMenuOpen ? "mobile-open" : ""}`}>
                <NavLink to="/" end onClick={() => setMobileMenuOpen(false)}>Home</NavLink>
                <NavLink to="/movies" onClick={() => setMobileMenuOpen(false)}>Movies</NavLink>
                <NavLink to="/tv-shows" onClick={() => setMobileMenuOpen(false)}>TV Shows</NavLink>
                <NavLink to="/anime" onClick={() => setMobileMenuOpen(false)}>Anime</NavLink>
                <NavLink to="/history" onClick={() => setMobileMenuOpen(false)}>History</NavLink>
            </div>

            <div className="navbar-actions">
                <button
                    type="button"
                    className={`search-button ${location.pathname === "/search" ? "active" : ""}`}
                    aria-label="Search"
                    title={isMac ? "Search (⌘K)" : "Search (Ctrl + K)"}
                    onClick={() => {
                        setMobileMenuOpen(false);
                        navigate("/search");
                    }}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="11" cy="11" r="7" />
                        <path d="m16.5 16.5 4.5 4.5" />
                    </svg>
                    <span className="search-button-text">Search...</span>
                    <span className="search-button-shortcut" aria-hidden="true">
                        <kbd>{isMac ? "⌘" : "Ctrl"}</kbd>
                        <kbd>K</kbd>
                    </span>
                </button>

                <button
                    type="button"
                    className={`mobile-menu-button ${mobileMenuOpen ? "open" : ""}`}
                    onClick={() => setMobileMenuOpen((open) => !open)}
                    aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                    aria-expanded={mobileMenuOpen}
                >
                    <span />
                    <span />
                    <span />
                </button>
            </div>
        </nav>
    );
}

export default Navbar;
