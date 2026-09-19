# 🎬 MovieBox Frontend

The modern React 19 web client for the MovieBox streaming platform. Powered by Vite, React Router v7, and custom responsive vanilla CSS.

---

## 🚀 Features

- **Hero & Curated Discovery**: Dynamic homepage with featured banners, ratings, and release years.
- **Dedicated Catalogs**: Separate browsing catalogs for Movies, TV Shows, and Anime with sorting and pagination.
- **Search with Autocomplete**: Instant debounce search suggestions with cached search history tags.
- **Interactive Details Page**: Rich title metadata, posters, background backdrops, episode and season selector.
- **Pro Video Player**:
  - Multi-quality source switcher (1080p, 720p, 480p, 360p, auto)
  - Speed selector (0.5x - 2.0x)
  - Aspect ratio & display fit modes (16:9, 4:3, 21:9, contain, cover, fill)
  - Multi-language WebVTT captions with on-the-fly SRT conversion
  - Smart resume prompt and timestamp playback tracking
  - Auto-play next episode countdown for series
  - Custom scrub bar, volume sliders, and keyboard shortcuts
- **Watch History Dashboard**: Track in-progress and completed titles, resume watching in one click, and manage history.
- **Local Network Ready**: Automatically points to the browser host (`http://<host>:8000`) for zero-config mobile & LAN testing.

---

## 🛠️ Scripts

```bash
# Install dependencies
npm install

# Start Vite dev server with Hot Module Replacement (HMR)
npm run dev

# Expose to local network (LAN / Mobile testing)
npm run dev -- --host

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run ESLint linter
npm run lint
```

---

## 🌐 Environment Variables

Optionally create a `.env` file in this directory to specify an API gateway address:

```env
VITE_API_URL=http://127.0.0.1:8000
```

*Note: If omitted, the frontend automatically defaults to `http://${window.location.hostname}:8000`.*
