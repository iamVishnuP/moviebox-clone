/*
 * ==========================================
 * MOVIEBOX WATCH HISTORY
 * ==========================================
 *
 * Stores:
 * - Movie / TV show information
 * - Season and episode
 * - Current playback position
 * - Duration
 * - Progress percentage
 * - Completed status
 * - Last watched timestamp
 *
 * Storage key:
 * moviebox-watch-history
 */

const HISTORY_STORAGE_KEY = "moviebox-watch-history";

/*
 * ==========================================
 * GET ALL HISTORY
 * ==========================================
 */

export function getWatchHistory() {
    try {
        const saved = localStorage.getItem(
            HISTORY_STORAGE_KEY
        );

        if (!saved) {
            return [];
        }

        const history = JSON.parse(saved);

        if (!Array.isArray(history)) {
            return [];
        }

        return history;
    } catch (error) {
        console.error(
            "Failed to load watch history:",
            error
        );

        return [];
    }
}


/*
 * ==========================================
 * SAVE WATCH HISTORY
 * ==========================================
 */

export function saveWatchHistory(data) {
    try {
        if (!data || !data.slug) {
            return;
        }

        const {
            slug,
            title = "Unknown Title",
            poster = "",
            season = null,
            episode = null,
            currentTime = 0,
            duration = 0
        } = data;

        const history = getWatchHistory();

        const numericTime = Number(currentTime) || 0;
        const numericDuration = Number(duration) || 0;

        /*
         * Calculate progress.
         */

        let progress = 0;

        if (numericDuration > 0) {
            progress =
                (numericTime / numericDuration) * 100;
        }

        progress = Math.max(
            0,
            Math.min(100, progress)
        );

        /*
         * Consider content completed at 95%.
         */

        const completed = progress >= 95;

        /*
         * Create a unique ID.
         *
         * Movie:
         * slug-s0-e0
         *
         * TV:
         * slug-s1-e1
         *
         * Anime:
         * slug-s1-e1
         */

        const normalizedSeason =
            season !== null &&
                season !== undefined &&
                season !== ""
                ? Number(season)
                : null;

        const normalizedEpisode =
            episode !== null &&
                episode !== undefined &&
                episode !== ""
                ? Number(episode)
                : null;

        const historyId =
            normalizedSeason !== null &&
                normalizedEpisode !== null
                ? `${slug}-s${normalizedSeason}-e${normalizedEpisode}`
                : slug;

        const historyItem = {
            id: historyId,

            slug,

            title,

            poster,

            season: normalizedSeason,

            episode: normalizedEpisode,

            /*
             * Primary playback position.
             */
            currentTime: numericTime,

            /*
             * Compatibility property.
             *
             * Older versions of History.jsx used
             * "time" instead of "currentTime".
             */
            time: numericTime,

            duration: numericDuration,

            progress: Math.round(progress),

            completed,

            lastWatched: Date.now()
        };

        /*
         * Remove the previous entry for the
         * same movie/episode.
         */

        const filteredHistory =
            history.filter((item) => {
                /*
                 * Support both old and new IDs.
                 */
                if (item.id === historyId) {
                    return false;
                }

                /*
                 * Also remove an old movie entry
                 * that may have been stored simply
                 * using the slug.
                 */
                if (
                    normalizedSeason === 0 &&
                    normalizedEpisode === 0 &&
                    item.id === slug
                ) {
                    return false;
                }

                return true;
            });

        /*
         * Put newest item first.
         */

        filteredHistory.unshift(
            historyItem
        );

        /*
         * Limit history size.
         *
         * This prevents localStorage from growing
         * indefinitely.
         */

        const limitedHistory =
            filteredHistory.slice(0, 200);

        localStorage.setItem(
            HISTORY_STORAGE_KEY,
            JSON.stringify(limitedHistory)
        );

        return historyItem;
    } catch (error) {
        console.error(
            "Failed to save watch history:",
            error
        );

        return null;
    }
}


/*
 * ==========================================
 * GET SINGLE HISTORY ITEM
 * ==========================================
 */

export function getHistoryItem(
    slug,
    season = null,
    episode = null
) {
    try {
        const history = getWatchHistory();

        const normalizedSeason =
            season !== null &&
                season !== undefined
                ? Number(season)
                : null;

        const normalizedEpisode =
            episode !== null &&
                episode !== undefined
                ? Number(episode)
                : null;

        /*
         * New ID format.
         */

        const historyId =
            normalizedSeason !== null &&
                normalizedEpisode !== null
                ? `${slug}-s${normalizedSeason}-e${normalizedEpisode}`
                : slug;

        /*
         * First try exact ID.
         */

        const exactMatch =
            history.find(
                (item) =>
                    item.id === historyId
            );

        if (exactMatch) {
            return normalizeHistoryItem(
                exactMatch
            );
        }

        /*
         * Backward compatibility:
         *
         * Older movie history may have used
         * only the slug as the ID.
         */

        if (
            normalizedSeason === 0 &&
            normalizedEpisode === 0
        ) {
            const oldMovieEntry =
                history.find(
                    (item) =>
                        item.slug === slug &&
                        (
                            item.id === slug ||
                            item.season === 0 ||
                            item.season === null
                        )
                );

            if (oldMovieEntry) {
                return normalizeHistoryItem(
                    oldMovieEntry
                );
            }
        }

        /*
         * Fallback matching by fields.
         */

        const fieldMatch =
            history.find((item) => {
                if (item.slug !== slug) {
                    return false;
                }

                if (
                    normalizedSeason !== null &&
                    Number(item.season) !==
                    normalizedSeason
                ) {
                    return false;
                }

                if (
                    normalizedEpisode !== null &&
                    Number(item.episode) !==
                    normalizedEpisode
                ) {
                    return false;
                }

                return true;
            });

        return fieldMatch
            ? normalizeHistoryItem(fieldMatch)
            : null;
    } catch (error) {
        console.error(
            "Failed to get history item:",
            error
        );

        return null;
    }
}


/*
 * ==========================================
 * NORMALIZE HISTORY ITEM
 * ==========================================
 *
 * Handles history created by older versions
 * of the application.
 */

function normalizeHistoryItem(item) {
    if (!item) {
        return null;
    }

    const currentTime =
        Number(
            item.currentTime ??
            item.time ??
            item.position ??
            0
        ) || 0;

    const duration =
        Number(
            item.duration ??
            item.totalDuration ??
            0
        ) || 0;

    let progress =
        Number(item.progress);

    if (
        !Number.isFinite(progress) ||
        progress < 0
    ) {
        progress =
            duration > 0
                ? (currentTime / duration) * 100
                : 0;
    }

    progress = Math.max(
        0,
        Math.min(100, progress)
    );

    return {
        ...item,

        currentTime,

        /*
         * Keep compatibility with older code.
         */
        time: currentTime,

        duration,

        progress: Math.round(progress),

        completed:
            Boolean(item.completed) ||
            progress >= 95
    };
}


/*
 * ==========================================
 * REMOVE ONE HISTORY ITEM
 * ==========================================
 */

export function removeWatchHistory(id) {
    try {
        const history = getWatchHistory();

        const updatedHistory =
            history.filter(
                (item) =>
                    item.id !== id
            );

        localStorage.setItem(
            HISTORY_STORAGE_KEY,
            JSON.stringify(updatedHistory)
        );

        return updatedHistory;
    } catch (error) {
        console.error(
            "Failed to remove history item:",
            error
        );

        return getWatchHistory();
    }
}


/*
 * ==========================================
 * CLEAR ALL HISTORY
 * ==========================================
 */

export function clearWatchHistory() {
    try {
        localStorage.removeItem(
            HISTORY_STORAGE_KEY
        );

        return [];
    } catch (error) {
        console.error(
            "Failed to clear watch history:",
            error
        );

        return getWatchHistory();
    }
}


/*
 * ==========================================
 * GET IN-PROGRESS HISTORY
 * ==========================================
 */

export function getInProgressHistory() {
    const history = getWatchHistory();

    return history
        .map(normalizeHistoryItem)
        .filter(
            (item) =>
                item.currentTime > 0 &&
                !item.completed
        );
}


/*
 * ==========================================
 * GET COMPLETED HISTORY
 * ==========================================
 */

export function getCompletedHistory() {
    const history = getWatchHistory();

    return history
        .map(normalizeHistoryItem)
        .filter(
            (item) =>
                item.completed
        );
}


/*
 * ==========================================
 * GET RECENTLY WATCHED
 * ==========================================
 */

export function getRecentHistory(
    limit = 10
) {
    const history = getWatchHistory();

    return history
        .map(normalizeHistoryItem)
        .sort(
            (a, b) =>
                Number(b.lastWatched || 0) -
                Number(a.lastWatched || 0)
        )
        .slice(0, limit);
}


/*
 * ==========================================
 * FORMAT WATCH TIME
 * ==========================================
 */

export function formatWatchTime(seconds) {
    const value = Number(seconds);

    if (
        !Number.isFinite(value) ||
        value < 0
    ) {
        return "0:00";
    }

    const hours = Math.floor(
        value / 3600
    );

    const minutes = Math.floor(
        (value % 3600) / 60
    );

    const remainingSeconds =
        Math.floor(value % 60);

    const formattedSeconds =
        remainingSeconds
            .toString()
            .padStart(2, "0");

    if (hours > 0) {
        return `${hours}:${minutes
            .toString()
            .padStart(2, "0")}:${formattedSeconds}`;
    }

    return `${minutes}:${formattedSeconds}`;
}


/*
 * ==========================================
 * FORMAT LAST WATCHED DATE
 * ==========================================
 */

export function formatLastWatched(
    timestamp
) {
    if (!timestamp) {
        return "";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const now = new Date();

    const difference =
        now.getTime() -
        date.getTime();

    const seconds =
        Math.floor(
            difference / 1000
        );

    const minutes =
        Math.floor(seconds / 60);

    const hours =
        Math.floor(minutes / 60);

    const days =
        Math.floor(hours / 24);

    if (seconds < 60) {
        return "Just now";
    }

    if (minutes < 60) {
        return `${minutes} min ago`;
    }

    if (hours < 24) {
        return `${hours} hr ago`;
    }

    if (days === 1) {
        return "Yesterday";
    }

    if (days < 7) {
        return `${days} days ago`;
    }

    return date.toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}