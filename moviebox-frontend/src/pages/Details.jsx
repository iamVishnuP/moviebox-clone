import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { API_URL } from "../config";


function Details() {
    const { slug } = useParams();
    const navigate = useNavigate();

    const [movie, setMovie] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedSeason, setSelectedSeason] = useState(1);

    useEffect(() => {
        const fetchMovie = async () => {
            try {
                setLoading(true);
                setError("");

                const response = await fetch(
                    `${API_URL}/detail/${slug}`
                );

                if (!response.ok) {
                    throw new Error(
                        "Failed to load movie details"
                    );
                }

                const data = await response.json();

                if (data.code !== 0 || !data.data) {
                    throw new Error(
                        "Movie details not found"
                    );
                }

                setMovie(data.data);
                const firstSeason = data.data.resource?.seasons?.[0];
                if (firstSeason?.se != null) {
                    setSelectedSeason(Number(firstSeason.se));
                }
            } catch (err) {
                console.error(err);
                setError(
                    "Failed to load movie details."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchMovie();
    }, [slug]);

    if (loading) {
        return (
            <div className="loading-screen">
                <p>Loading...</p>
            </div>
        );
    }

    if (error || !movie) {
        return (
            <div className="loading-screen">
                <p>
                    {error ||
                        "Movie not found."}
                </p>

                <Link
                    to="/"
                    className="back-button"
                >
                    ← Back to Home
                </Link>
            </div>
        );
    }

    const subject = movie.subject;

    const cast =
        movie.stars
            ?.filter(
                (person) =>
                    person.character
            )
            ?.slice(0, 10) || [];

    const seasons =
        movie.resource?.seasons || [];

    /*
     * ==========================================
     * CONTENT TYPE
     * ==========================================
     *
     * If seasons exist:
     *     TV / Anime series
     *
     * If no seasons:
     *     Movie / Anime movie
     */
    const isSeries = seasons.length > 0;

    /*
     * ==========================================
     * WATCH NOW
     * ==========================================
     */

    function handleWatchNow() {
        if (isSeries) {
            /*
             * Start series from Season 1,
             * Episode 1.
             */
            const firstSeason =
                seasons[0];

            let firstEpisode = 1;

            if (firstSeason?.allEp) {
                const episodes =
                    firstSeason.allEp
                        .split(",")
                        .map(Number)
                        .filter(
                            Number.isFinite
                        );

                if (episodes.length > 0) {
                    firstEpisode =
                        episodes[0];
                }
            }

            navigate(
                `/watch/${slug}/${firstSeason.se}/${firstEpisode}`
            );

            return;
        }

        /*
         * Movies use the internal /0/0 watch route; Watch normalizes it to API season/episode 1/1.
         */
        navigate(
            `/watch/${slug}/0/0`
        );
    }

    const currentSeason =
        seasons.find(
            (season) =>
                season.se ===
                selectedSeason
        );

    const availableEpisodes =
        currentSeason?.allEp
            ? currentSeason.allEp
                .split(",")
                .map(Number)
                .filter(
                    Number.isFinite
                )
            : Array.from(
                {
                    length:
                        currentSeason?.maxEp ||
                        0,
                },
                (_, index) =>
                    index + 1
            );

    return (
        <div className="details-page">

            {/* =========================
                NAVBAR
            ========================= */}

            <Navbar />

            {/* =========================
                BACK BUTTON
            ========================= */}

            <div className="details-top">

                <Link
                    to="/"
                    className="back-button"
                >
                    ← Back
                </Link>

            </div>

            {/* =========================
                MAIN DETAILS
            ========================= */}

            <section className="details-container">

                <img
                    src={subject?.cover?.url}
                    alt={
                        subject?.title ||
                        "Movie poster"
                    }
                    className="details-poster"
                />

                <div className="details-content">

                    <h1>
                        {subject?.title}
                    </h1>

                    <div className="movie-meta">

                        {subject?.releaseDate && (
                            <span>
                                {
                                    subject.releaseDate.slice(
                                        0,
                                        4
                                    )
                                }
                            </span>
                        )}

                        {subject?.imdbRatingValue && (
                            <span>
                                ⭐{" "}
                                {
                                    subject.imdbRatingValue
                                }
                            </span>
                        )}

                        {subject?.countryName && (
                            <span>
                                {
                                    subject.countryName
                                }
                            </span>
                        )}

                    </div>

                    {subject?.genre && (
                        <p className="genre">
                            {subject.genre}
                        </p>
                    )}

                    {subject?.description && (
                        <p className="description">
                            {
                                subject.description
                            }
                        </p>
                    )}

                    {/* =========================
                        WATCH NOW
                    ========================= */}

                    <button
                        type="button"
                        className="watch-button"
                        onClick={
                            handleWatchNow
                        }
                    >
                        ▶ Watch Now
                    </button>

                </div>

            </section>

            {/* =========================
                SEASONS & EPISODES
            ========================= */}

            {seasons.length > 0 && (
                <section className="episodes-section">

                    <div className="episodes-header">
                        <h2>
                            Seasons & Episodes
                        </h2>
                    </div>

                    {/* SEASONS */}

                    <div className="season-list">

                        {seasons.map(
                            (season) => (
                                <button
                                    type="button"
                                    key={
                                        season.se
                                    }
                                    className={
                                        selectedSeason ===
                                            season.se
                                            ? "season-button active"
                                            : "season-button"
                                    }
                                    onClick={() =>
                                        setSelectedSeason(
                                            season.se
                                        )
                                    }
                                >
                                    Season{" "}
                                    {season.se}
                                </button>
                            )
                        )}

                    </div>

                    {/* EPISODES */}

                    <div className="episode-list">

                        {availableEpisodes.map(
                            (episode) => (

                                <button
                                    type="button"
                                    key={episode}
                                    className="episode-card"
                                    onClick={() =>
                                        navigate(
                                            `/watch/${slug}/${selectedSeason}/${episode}`
                                        )
                                    }
                                >

                                    <div className="episode-number">
                                        {episode}
                                    </div>

                                    <div className="episode-details">

                                        <h3>
                                            Episode{" "}
                                            {episode}
                                        </h3>

                                        <p>
                                            Season{" "}
                                            {
                                                selectedSeason
                                            }
                                        </p>

                                    </div>

                                    <span className="episode-play">
                                        ▶
                                    </span>

                                </button>

                            )
                        )}

                    </div>

                </section>
            )}

            {/* =========================
                CAST
            ========================= */}

            {cast.length > 0 && (
                <section className="cast-section">

                    <h2>
                        Cast & Crew
                    </h2>

                    <div className="cast-grid">

                        {cast.map(
                            (
                                person,
                                index
                            ) => (

                                <div
                                    className="cast-card"
                                    key={index}
                                >

                                    {person.avatarUrl && (
                                        <img
                                            src={
                                                person.avatarUrl
                                            }
                                            alt={
                                                person.name
                                            }
                                        />
                                    )}

                                    <div className="cast-info">

                                        <h3>
                                            {
                                                person.name
                                            }
                                        </h3>

                                        <p>
                                            {
                                                person.character
                                            }
                                        </p>

                                    </div>

                                </div>

                            )
                        )}

                    </div>

                </section>
            )}

        </div>
    );
}

export default Details;