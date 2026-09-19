import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { API_URL } from "../config";


function Catalog({ title, endpoint }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchCatalog = async () => {
            try {
                setLoading(true);
                setError("");

                const response = await fetch(`${API_URL}${endpoint}`);

                if (!response.ok) {
                    throw new Error("Failed to load catalog");
                }

                const data = await response.json();

                setItems(data.items || []);
            } catch (err) {
                console.error(err);
                setError("Unable to load content.");
            } finally {
                setLoading(false);
            }
        };

        fetchCatalog();
    }, [endpoint]);

    return (
        <div className="catalog-page">

            <Navbar />

            <main className="catalog-container">

                <div className="catalog-header">

                    <div>
                        <h1>{title}</h1>

                        {!loading && !error && (
                            <p>{items.length} titles</p>
                        )}
                    </div>

                </div>


                {loading && (
                    <div className="catalog-message">
                        Loading {title.toLowerCase()}...
                    </div>
                )}


                {error && (
                    <div className="catalog-message error">
                        {error}
                    </div>
                )}


                {!loading && !error && items.length === 0 && (
                    <div className="catalog-message">
                        No titles found.
                    </div>
                )}


                {!loading && !error && items.length > 0 && (

                    <div className="movie-grid">

                        {items.map((item) => (

                            <Link
                                key={item.subject_id}
                                to={`/movie/${item.slug}`}
                                className="movie-card"
                            >

                                <div className="poster-container">

                                    <img
                                        src={item.poster_url}
                                        alt={item.name}
                                        loading="lazy"
                                    />

                                </div>


                                <div className="movie-info">

                                    <div className="movie-rating">
                                        ⭐ {item.rating || "N/A"}
                                    </div>

                                    <h3>
                                        {item.name}
                                    </h3>

                                    <p>
                                        {item.year || "Unknown"}
                                    </p>

                                </div>

                            </Link>

                        ))}

                    </div>

                )}

            </main>

        </div>
    );
}

export default Catalog;