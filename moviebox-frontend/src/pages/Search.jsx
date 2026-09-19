import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { API_URL } from "../config";
import {
    clearSearchHistory,
    getSearchHistory,
    removeSearchHistory,
    saveSearchHistory,
    SEARCH_HISTORY_UPDATED_EVENT,
} from "../utils/searchHistory";


function Search() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const suggestionRequestRef = useRef(null);

    const initialQuery = searchParams.get("q") || "";
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [searchHistory, setSearchHistory] = useState(getSearchHistory);
    const [loading, setLoading] = useState(false);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    useEffect(() => {
        function refreshHistory() {
            setSearchHistory(getSearchHistory());
        }

        window.addEventListener("storage", refreshHistory);
        window.addEventListener(SEARCH_HISTORY_UPDATED_EVENT, refreshHistory);

        return () => {
            window.removeEventListener("storage", refreshHistory);
            window.removeEventListener(SEARCH_HISTORY_UPDATED_EVENT, refreshHistory);
        };
    }, []);

    useEffect(() => {
        const searchQuery = searchParams.get("q")?.trim() || "";
        if (!searchQuery) {
            return undefined;
        }

        const controller = new AbortController();

        async function searchMovies() {
            try {
                setLoading(true);
                const response = await fetch(
                    `${API_URL}/search?q=${encodeURIComponent(searchQuery)}`,
                    { signal: controller.signal }
                );

                if (!response.ok) throw new Error("Search request failed");
                const data = await response.json();
                setResults(Array.isArray(data.items) ? data.items : []);
            } catch (error) {
                if (error.name !== "AbortError") {
                    console.error("Search failed:", error);
                    setResults([]);
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        searchMovies();
        return () => controller.abort();
    }, [searchParams]);

    useEffect(() => {
        const value = query.trim();

        if (!value) {
            return undefined;
        }

        const controller = new AbortController();
        suggestionRequestRef.current = controller;

        const timer = setTimeout(async () => {
            setSuggestionsLoading(true);
            try {
                const response = await fetch(
                    `${API_URL}/search/suggest?q=${encodeURIComponent(value)}`,
                    { signal: controller.signal }
                );

                if (!response.ok) throw new Error("Suggestion request failed");
                const data = await response.json();
                const unique = [];
                const seen = new Set();

                for (const item of Array.isArray(data.suggestions) ? data.suggestions : []) {
                    const title = String(item.title || "").trim();
                    if (!title || seen.has(title.toLowerCase())) continue;
                    seen.add(title.toLowerCase());
                    unique.push(item);
                }

                setSuggestions(unique.slice(0, 8));
            } catch (error) {
                if (error.name !== "AbortError") {
                    console.warn("Search suggestions failed:", error);
                    setSuggestions([]);
                }
            } finally {
                if (!controller.signal.aborted) setSuggestionsLoading(false);
            }
        }, 250);

        return () => {
            clearTimeout(timer);
            controller.abort();
            if (suggestionRequestRef.current === controller) {
                suggestionRequestRef.current = null;
            }
        };
    }, [query]);

    function submitSearch(value = query) {
        const trimmedQuery = String(value || "").trim();
        if (!trimmedQuery) return;

        saveSearchHistory(trimmedQuery);
        setQuery(trimmedQuery);
        setShowDropdown(false);
        setSuggestions([]);
        setHighlightedIndex(-1);
        setSearchParams({ q: trimmedQuery });
    }

    function handleSearch(event) {
        event.preventDefault();

        const trimmedQuery = query.trim();

        // A click with no text should still do something useful:
        // keep the user on the search page, focus the field, and show
        // recent searches instead of appearing to do nothing.
        if (!trimmedQuery) {
            setShowDropdown(true);
            setHighlightedIndex(-1);
            inputRef.current?.focus();
            return;
        }

        submitSearch(trimmedQuery);
    }

    function openSuggestion(suggestion) {
        const title = suggestion.title?.trim();
        if (!title) return;

        saveSearchHistory(title);
        setShowDropdown(false);
        setSuggestions([]);
        setHighlightedIndex(-1);

        if (suggestion.slug) {
            navigate(`/movie/${suggestion.slug}`);
        } else {
            submitSearch(title);
        }
    }

    function handleInputKeyDown(event) {
        const dropdownItems = suggestions.length > 0 ? suggestions : searchHistory;
        const hasDropdownItems = showDropdown && dropdownItems.length > 0;

        if (event.key === "ArrowDown" && hasDropdownItems) {
            event.preventDefault();
            setHighlightedIndex((index) => (index + 1) % dropdownItems.length);
            return;
        }

        if (event.key === "ArrowUp" && hasDropdownItems) {
            event.preventDefault();
            setHighlightedIndex((index) =>
                index <= 0 ? dropdownItems.length - 1 : index - 1
            );
            return;
        }

        if (event.key === "Escape") {
            setShowDropdown(false);
            setHighlightedIndex(-1);
            return;
        }

        if (event.key === "Enter" && highlightedIndex >= 0 && hasDropdownItems) {
            event.preventDefault();
            const selected = dropdownItems[highlightedIndex];
            if (suggestions.length > 0) {
                openSuggestion(selected);
            } else {
                submitSearch(selected);
            }
        }
    }

    function handleFocus() {
        setShowDropdown(true);
    }

    function handleBlur() {
        // Allow click events on dropdown buttons to fire before closing.
        window.setTimeout(() => setShowDropdown(false), 120);
    }

    function removeHistoryItem(event, value) {
        event.stopPropagation();
        setSearchHistory(removeSearchHistory(value));
    }

    function clearHistory() {
        if (!searchHistory.length) return;
        setSearchHistory(clearSearchHistory());
    }

    const currentSearch = searchParams.get("q")?.trim() || "";

    return (
        <div className="search-page">
            <Navbar />

            <main className="search-container">
                <div className="search-heading-block">
                    <span className="page-eyebrow">DISCOVER</span>
                    <h1>Search</h1>
                    <p>Find movies, TV shows and anime by title.</p>
                </div>

                <form className="search-form" onSubmit={handleSearch}>
                    <div className="search-input-wrap">
                        <span className="search-input-icon" aria-hidden="true">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                focusable="false"
                            >
                                <circle cx="11" cy="11" r="7" />
                                <path d="m16.5 16.5 4.5 4.5" />
                            </svg>
                        </span>
                        <input
                            ref={inputRef}
                            type="search"
                            placeholder="Search movies, TV shows, anime, genres..."
                            value={query}
                            onChange={(event) => {
                                const value = event.target.value;
                                setQuery(value);
                                setHighlightedIndex(-1);
                                if (!value.trim()) {
                                    setSuggestions([]);
                                    setSuggestionsLoading(false);
                                }
                            }}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            onKeyDown={handleInputKeyDown}
                            autoComplete="off"
                            aria-label="Search titles"
                            aria-expanded={showDropdown}
                        />
                        {query && (
                            <button
                                type="button"
                                className="search-clear-input"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    setQuery("");
                                    setSuggestions([]);
                                    inputRef.current?.focus();
                                }}
                                aria-label="Clear search input"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="search-submit-button"
                        aria-label={query.trim() ? "Search" : "Focus search field"}
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
                        <span>Search</span>
                    </button>

                    {showDropdown && (suggestions.length > 0 || searchHistory.length > 0 || suggestionsLoading) && (
                        <div className="search-dropdown">
                            {suggestionsLoading && (
                                <div className="search-dropdown-status">Finding matches...</div>
                            )}

                            {!suggestionsLoading && suggestions.length > 0 && (
                                <>
                                    <div className="search-dropdown-heading">Suggestions</div>
                                    {suggestions.map((suggestion, index) => (
                                        <button
                                            type="button"
                                            key={`${suggestion.slug || suggestion.subject_id || suggestion.title}-${index}`}
                                            className={`search-dropdown-item ${highlightedIndex === index ? "highlighted" : ""}`}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => openSuggestion(suggestion)}
                                        >
                                            <span className="dropdown-search-icon" aria-hidden="true">
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    focusable="false"
                                                >
                                                    <circle cx="11" cy="11" r="7" />
                                                    <path d="m16.5 16.5 4.5 4.5" />
                                                </svg>
                                            </span>
                                            <span>{suggestion.title}</span>
                                        </button>
                                    ))}
                                </>
                            )}

                            {!suggestionsLoading && !query.trim() && suggestions.length === 0 && searchHistory.length > 0 && (
                                <>
                                    <div className="search-dropdown-heading search-history-heading">
                                        <span>Recent searches</span>
                                        <button
                                            type="button"
                                            className="clear-search-history-button"
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={clearHistory}
                                        >
                                            Clear all
                                        </button>
                                    </div>
                                    {searchHistory.map((item, index) => (
                                        <div
                                            className={`search-history-item ${highlightedIndex === index ? "highlighted" : ""}`}
                                            key={item}
                                        >
                                            <button
                                                type="button"
                                                className="search-history-query"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => submitSearch(item)}
                                            >
                                                <span className="history-clock" aria-hidden="true">
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        style={{ width: 15, height: 15 }}
                                                    >
                                                        <circle cx="12" cy="12" r="9" />
                                                        <polyline points="12 7 12 12 15 15" />
                                                    </svg>
                                                </span>
                                                <span>{item}</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="remove-search-history-button"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={(event) => removeHistoryItem(event, item)}
                                                aria-label={`Remove ${item} from search history`}
                                                title="Remove"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </form>

                <div className="search-tags">
                    <span className="search-tags-label">Popular:</span>
                    {["Avatar", "Breaking Bad", "Inception", "Interstellar", "Anime", "Action", "Sci-Fi", "Comedy"].map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            className="search-tag-chip"
                            onClick={() => {
                                setQuery(tag);
                                submitSearch(tag);
                            }}
                        >
                            {tag}
                        </button>
                    ))}
                </div>

                {loading && <div className="search-message">Searching...</div>}

                {!loading && currentSearch && (
                    <div className="search-results">
                        <div className="section-heading">
                            <h2>Results for “{currentSearch}”</h2>
                            <span>{results.length} results</span>
                        </div>

                        {results.length === 0 ? (
                            <div className="search-message">No results found.</div>
                        ) : (
                            <div className="movie-grid">
                                {results.map((movie) => (
                                    <Link
                                        key={movie.subject_id || movie.slug}
                                        to={`/movie/${movie.slug}`}
                                        className="movie-card"
                                    >
                                        <div className="poster-container">
                                            {movie.poster_url ? (
                                                <img src={movie.poster_url} alt={movie.name || "Poster"} loading="lazy" />
                                            ) : (
                                                <div className="poster-fallback">No image</div>
                                            )}
                                        </div>
                                        <div className="movie-info">
                                            <h3>{movie.name || "Untitled"}</h3>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {!currentSearch && !searchHistory.length && (
                    <div className="search-empty-state">
                        <div className="search-empty-icon">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                focusable="false"
                            >
                                <circle cx="11" cy="11" r="7" />
                                <path d="m16.5 16.5 4.5 4.5" />
                            </svg>
                        </div>
                        <h2>What do you want to watch?</h2>
                        <p>Search by movie title, show, genre, or keyword to find your next watch.</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default Search;
