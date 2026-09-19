const SEARCH_HISTORY_KEY = "moviebox-search-history";
const MAX_SEARCH_HISTORY = 12;
const SEARCH_HISTORY_UPDATED_EVENT = "moviebox-search-history-updated";

function notifySearchHistoryUpdated() {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(SEARCH_HISTORY_UPDATED_EVENT));
    }
}

export function getSearchHistory() {
    try {
        const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
        if (!saved) return [];

        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter((item) => typeof item === "string" && item.trim())
            .map((item) => item.trim())
            .slice(0, MAX_SEARCH_HISTORY);
    } catch (error) {
        console.warn("Could not read search history:", error);
        return [];
    }
}

export function saveSearchHistory(query) {
    const value = String(query || "").trim();
    if (!value) return getSearchHistory();

    const existing = getSearchHistory();
    const normalized = value.toLowerCase();
    const updated = [
        value,
        ...existing.filter((item) => item.toLowerCase() !== normalized),
    ].slice(0, MAX_SEARCH_HISTORY);

    try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
        notifySearchHistoryUpdated();
    } catch (error) {
        console.warn("Could not save search history:", error);
    }

    return updated;
}

export function removeSearchHistory(query) {
    const value = String(query || "").trim().toLowerCase();
    const updated = getSearchHistory().filter(
        (item) => item.toLowerCase() !== value
    );

    try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
        notifySearchHistoryUpdated();
    } catch (error) {
        console.warn("Could not remove search history item:", error);
    }

    return updated;
}

export function clearSearchHistory() {
    try {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
        notifySearchHistoryUpdated();
    } catch (error) {
        console.warn("Could not clear search history:", error);
    }

    return [];
}

export { SEARCH_HISTORY_KEY, SEARCH_HISTORY_UPDATED_EVENT };
