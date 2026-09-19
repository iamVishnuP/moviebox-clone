import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./History.css";
import {
    clearWatchHistory,
    getWatchHistory,
    removeWatchHistory,
} from "../utils/watchHistory";

function History() {
    const [history, setHistory] = useState(getWatchHistory);
    const [filter, setFilter] = useState("all");

    function refreshHistory() {
        setHistory(getWatchHistory());
    }

    useEffect(() => {
        const handleStorage = (event) => {
            if (event.key === "moviebox-watch-history") {
                refreshHistory();
            }
        };

        window.addEventListener("storage", handleStorage);

        return () =>
            window.removeEventListener(
                "storage",
                handleStorage
            );
    }, []);

    const filteredHistory = useMemo(() => {
        if (filter === "progress") {
            return history.filter(
                (item) => !item.completed
            );
        }

        if (filter === "completed") {
            return history.filter(
                (item) => item.completed
            );
        }

        return history;
    }, [history, filter]);

    function handleRemove(id) {
        removeWatchHistory(id);
        refreshHistory();
    }

    function handleClearAll() {
        const confirmed = window.confirm(
            "Clear your entire watch history?"
        );

        if (!confirmed) return;

        clearWatchHistory();
        setHistory([]);
    }

    function getProgress(item) {
        if (item.completed) return 100;

        // Support both the current `time` field and the older
        // `currentTime` field so existing history entries remain usable.
        const currentTime = Number(
            item.time ?? item.currentTime
        );
        const itemDuration = Number(item.duration);

        if (
            !Number.isFinite(currentTime) ||
            !Number.isFinite(itemDuration) ||
            itemDuration <= 0
        ) {
            return 0;
        }

        return Math.min(
            100,
            Math.max(
                0,
                (currentTime / itemDuration) * 100
            )
        );
    }

    function formatDate(timestamp) {
        if (!timestamp) return "";

        try {
            return new Date(timestamp).toLocaleString(
                undefined,
                {
                    dateStyle: "medium",
                    timeStyle: "short",
                }
            );
        } catch {
            return "";
        }
    }

    return (
        <>
            <Navbar />

            <main className="history-page">
                <div className="history-container">
                    <div className="history-header">
                        <div>
                            <h1>Watch History</h1>
                            <p>
                                Continue watching or revisit
                                everything you've watched.
                            </p>
                        </div>

                        {history.length > 0 && (
                            <button
                                type="button"
                                className="history-clear-button"
                                onClick={handleClearAll}
                            >
                                Clear History
                            </button>
                        )}
                    </div>

                    <div className="history-tabs">
                        <button
                            type="button"
                            className={
                                filter === "all"
                                    ? "history-tab active"
                                    : "history-tab"
                            }
                            onClick={() =>
                                setFilter("all")
                            }
                        >
                            All ({history.length})
                        </button>

                        <button
                            type="button"
                            className={
                                filter === "progress"
                                    ? "history-tab active"
                                    : "history-tab"
                            }
                            onClick={() =>
                                setFilter("progress")
                            }
                        >
                            In Progress (
                            {
                                history.filter(
                                    (item) =>
                                        !item.completed
                                ).length
                            })
                        </button>

                        <button
                            type="button"
                            className={
                                filter === "completed"
                                    ? "history-tab active"
                                    : "history-tab"
                            }
                            onClick={() =>
                                setFilter("completed")
                            }
                        >
                            Completed (
                            {
                                history.filter(
                                    (item) =>
                                        item.completed
                                ).length
                            })
                        </button>
                    </div>

                    {filteredHistory.length === 0 ? (
                        <div className="history-empty">
                            <div className="history-empty-icon">
                                ◷
                            </div>
                            <h2>
                                {history.length === 0
                                    ? "No watch history yet"
                                    : "Nothing here"}
                            </h2>
                            <p>
                                {history.length === 0
                                    ? "Movies and episodes you watch will appear here."
                                    : "Try another history filter."}
                            </p>
                            <Link
                                to="/movies"
                                className="history-browse-button"
                            >
                                Browse Movies
                            </Link>
                        </div>
                    ) : (
                        <div className="history-list">
                            {filteredHistory.map((item) => {
                                const progress =
                                    getProgress(item);

                                const watchPath =
                                    item.season != null &&
                                        item.episode != null
                                        ? `/watch/${item.slug}/${item.season}/${item.episode}`
                                        : `/movie/${item.slug}`;

                                return (
                                    <article
                                        className="history-item"
                                        key={item.id}
                                    >
                                        <Link
                                            to={watchPath}
                                            className="history-poster-link"
                                        >
                                            {item.poster ? (
                                                <img
                                                    src={
                                                        item.poster
                                                    }
                                                    alt={
                                                        item.title ||
                                                        "Movie poster"
                                                    }
                                                />
                                            ) : (
                                                <div className="history-poster-placeholder">
                                                    🎬
                                                </div>
                                            )}

                                            <div className="history-poster-play">
                                                ▶
                                            </div>
                                        </Link>

                                        <div className="history-item-info">
                                            <div className="history-item-top">
                                                <div>
                                                    <Link
                                                        to={
                                                            watchPath
                                                        }
                                                        className="history-title"
                                                    >
                                                        {item.title ||
                                                            "Untitled"}
                                                    </Link>

                                                    {item.season !=
                                                        null &&
                                                        item.episode !=
                                                        null && (
                                                            <div className="history-episode">
                                                                Season {item.season}
                                                                {" · "}
                                                                Episode {item.episode}
                                                            </div>
                                                        )}
                                                </div>

                                                <button
                                                    type="button"
                                                    className="history-remove-button"
                                                    title="Remove from history"
                                                    onClick={() =>
                                                        handleRemove(
                                                            item.id
                                                        )
                                                    }
                                                >
                                                    ×
                                                </button>
                                            </div>

                                            <div className="history-progress-row">
                                                <div className="history-progress-track">
                                                    <div
                                                        className="history-progress-fill"
                                                        style={{
                                                            width: `${progress}%`,
                                                        }}
                                                    />
                                                </div>

                                                <span>
                                                    {item.completed
                                                        ? "Watched"
                                                        : `${Math.round(
                                                            progress
                                                        )}% watched`}
                                                </span>
                                            </div>

                                            <div className="history-meta">
                                                <span>
                                                    {item.completed
                                                        ? "Completed"
                                                        : `Last position: ${formatTime(item.time ?? item.currentTime)}`}
                                                </span>
                                                <span>
                                                    {formatDate(
                                                        item.lastWatched
                                                    )}
                                                </span>
                                            </div>

                                            <Link
                                                to={watchPath}
                                                className="history-watch-button"
                                            >
                                                {item.completed
                                                    ? "Watch Again"
                                                    : "Continue Watching"}
                                            </Link>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}

function formatTime(seconds) {
    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {
        return "0:00";
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(
        (seconds % 3600) / 60
    );
    const remainingSeconds = Math.floor(
        seconds % 60
    );

    const paddedSeconds = String(
        remainingSeconds
    ).padStart(2, "0");

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(
            2,
            "0"
        )}:${paddedSeconds}`;
    }

    return `${minutes}:${paddedSeconds}`;
}

export default History;
