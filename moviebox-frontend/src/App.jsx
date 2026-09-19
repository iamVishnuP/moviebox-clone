import "./App.css";

import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

import Home from "./pages/Home";
import Details from "./pages/Details";
import Search from "./pages/Search";
import Catalog from "./pages/Catalog";
import Watch from "./pages/Watch";
import History from "./pages/History";

function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* HOME */}
        <Route
          path="/"
          element={<Home />}
        />

        {/* MOVIES */}
        <Route
          path="/movies"
          element={
            <Catalog
              title="Movies"
              endpoint="/movies"
            />
          }
        />

        {/* TV SHOWS */}
        <Route
          path="/tv-shows"
          element={
            <Catalog
              title="TV Shows"
              endpoint="/tv-series"
            />
          }
        />

        {/* ANIME */}
        <Route
          path="/anime"
          element={
            <Catalog
              title="Anime"
              endpoint="/animation"
            />
          }
        />

        {/* SEARCH */}
        <Route
          path="/search"
          element={<Search />}
        />

        {/* DETAILS */}
        <Route
          path="/movie/:slug"
          element={<Details />}
        />

        <Route
          path="/watch/:slug/:season/:episode"
          element={<Watch />}
        />

        <Route path="/history" element={<History />} />

      </Routes>

    </BrowserRouter>
  );
}

export default App;