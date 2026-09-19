import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Navbar from "../components/Navbar";
import { API_URL } from "../config";


function Home() {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMovies = async () => {
            try {
                const response = await fetch(`${API_URL}/movies`);
                const data = await response.json();

                setMovies(data.items || []);
            } catch (error) {
                console.error("Failed to fetch movies:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMovies();
    }, []);

    return (
        <div className="home">

            {/* NAVBAR */}
            <Navbar />


            {/* HERO */}
            <section className="hero">

                <div className="hero-content">

                    <span className="hero-label">
                        WELCOME TO MOVIEBOX
                    </span>

                    <h1>
                        Discover your next
                        <br />
                        favorite movie.
                    </h1>

                    <p>
                        Browse movies and TV shows from your personal streaming library.
                    </p>

                    <button
                        className="browse-button"
                        onClick={() =>
                            document
                                .getElementById("movies")
                                ?.scrollIntoView({ behavior: "smooth" })
                        }
                    >
                        Browse Movies
                    </button>

                </div>

            </section>


            {/* MOVIES */}
            <section className="movies-section" id="movies">

                <div className="section-heading">
                    <h2>Movies</h2>

                    {!loading && (
                        <span>
                            {movies.length} titles
                        </span>
                    )}
                </div>


                {loading ? (
                    <div className="loading-screen">
                        <p>Loading movies...</p>
                    </div>
                ) : (
                    <div className="movie-grid">

                        {movies.map((movie) => (

                            <Link
                                to={`/movie/${movie.slug}`}
                                className="movie-card"
                                key={movie.subject_id}
                            >

                                <div className="poster-container">

                                    <img
                                        src={movie.poster_url}
                                        alt={movie.name}
                                        loading="lazy"
                                    />

                                </div>


                                <div className="movie-info">

                                    <div className="movie-rating">
                                        ⭐ {movie.rating || "N/A"}
                                    </div>

                                    <h3>
                                        {movie.name}
                                    </h3>

                                    <p>
                                        {movie.year || "Unknown"}
                                    </p>

                                </div>

                            </Link>

                        ))}

                    </div>
                )}

            </section>

        </div>
    );
}

export default Home;