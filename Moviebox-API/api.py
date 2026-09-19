import re
import json
import httpx
import asyncio
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse, StreamingResponse
import os

app = FastAPI(
    title="MovieBox API Pro",
    description="Full Pure REST API for moviebox.ph — Zero Scraping",
    version="2.1.5"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_URL = "https://moviebox.ph"
API_BASE = "https://h5-api.aoneroom.com/wefeed-h5api-bff"

_bearer_token: str | None = None

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "Referer": "https://moviebox.ph/",
    "Origin": "https://moviebox.ph",
    "X-Client-Info": '{"timezone":"Asia/Dhaka"}',
    "X-Request-Lang": "en",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
}

# Player-side headers for the stream domain (netfilm.world)
PLAYER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "X-Client-Info": '{"timezone":"Asia/Dhaka"}',
    "X-Source": "",
    "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
}

async def _get_bearer_token() -> str:
    """Auto-acquire a guest JWT from the x-user response header."""
    global _bearer_token
    if _bearer_token:
        return _bearer_token
    async with httpx.AsyncClient(follow_redirects=True, timeout=25) as client:
        resp = await client.get(f"{API_BASE}/home?host=moviebox.ph", headers=DEFAULT_HEADERS)
        x_user = resp.headers.get("x-user")
        if x_user:
            _bearer_token = json.loads(x_user).get("token")
        if not _bearer_token:
            # fallback: read from set-cookie
            cookie = resp.headers.get("set-cookie", "")
            import re as _re
            m = _re.search(r"token=([^;]+)", cookie)
            if m:
                _bearer_token = m.group(1)
    return _bearer_token or ""

async def _make_request(url: str, method: str = "GET", payload: dict = None, custom_headers: dict = None) -> dict:
    global _bearer_token
    token = await _get_bearer_token()
    headers = {
        **DEFAULT_HEADERS,
        "Authorization": f"Bearer {token}" if token else "",
        **(custom_headers or {})
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=25) as client:
        try:
            if method == "POST":
                resp = await client.post(url, headers=headers, json=payload)
            else:
                resp = await client.get(url, headers=headers)

            # Refresh token if server sends a new one
            x_user = resp.headers.get("x-user")
            if x_user:
                new_token = json.loads(x_user).get("token")
                if new_token:
                    _bearer_token = new_token

            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Upstream API error: {resp.status_code}")

            return resp.json()
        except Exception as e:
            if isinstance(e, HTTPException): raise e
            raise HTTPException(status_code=502, detail=f"Request failed: {str(e)}")

@app.get("/", response_class=HTMLResponse)
async def dashboard():
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MovieBox Pure API | Pro Dashboard</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #ff3d71;
                --secondary: #3366ff;
                --accent: #00f2ff;
                --bg: #07080c;
                --card-bg: rgba(255, 255, 255, 0.03);
                --glass: rgba(255, 255, 255, 0.06);
                --text: #ffffff;
            }

            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body {
                font-family: 'Outfit', sans-serif;
                background: var(--bg);
                color: var(--text);
                overflow-x: hidden;
                min-height: 100vh;
                background-image: 
                    radial-gradient(circle at 10% 10%, rgba(255, 61, 113, 0.12) 0%, transparent 40%),
                    radial-gradient(circle at 90% 90%, rgba(51, 102, 255, 0.12) 0%, transparent 40%);
            }

            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 60px 24px;
                position: relative;
            }

            header {
                text-align: center;
                margin-bottom: 80px;
                animation: fadeInDown 1s ease-out;
            }

            @keyframes fadeInDown {
                from { opacity: 0; transform: translateY(-30px); }
                to { opacity: 1; transform: translateY(0); }
            }

            h1 {
                font-size: clamp(2.5rem, 8vw, 4rem);
                font-weight: 800;
                background: linear-gradient(135deg, #fff 0%, #aaa 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 15px;
                letter-spacing: -2px;
            }

            .badge {
                background: linear-gradient(90deg, var(--primary), var(--secondary));
                padding: 8px 18px;
                border-radius: 40px;
                font-size: 0.85rem;
                font-weight: 700;
                display: inline-block;
                margin-bottom: 25px;
                text-transform: uppercase;
                letter-spacing: 1px;
                box-shadow: 0 10px 30px rgba(255, 61, 113, 0.3);
            }

            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
                gap: 30px;
                margin-top: 20px;
            }

            .card {
                background: var(--card-bg);
                border: 1px solid var(--glass);
                border-radius: 28px;
                padding: 35px;
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                backdrop-filter: blur(12px);
                position: relative;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }

            @media (hover: hover) {
                .card:hover {
                    transform: translateY(-12px) scale(1.02);
                    border-color: rgba(255,255,255,0.2);
                    box-shadow: 0 30px 60px rgba(0,0,0,0.5);
                }
            }

            .card-title {
                font-size: 1.5rem;
                font-weight: 700;
                margin-bottom: 18px;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .card-title i {
                width: 32px; height: 32px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                font-size: 1rem; color: var(--accent);
                font-style: normal;
            }

            .card-desc {
                color: #9ea3ac;
                font-size: 1rem;
                line-height: 1.6;
                margin-bottom: 25px;
                flex-grow: 1;
            }

            .endpoint {
                font-family: 'JetBrains Mono', monospace;
                background: rgba(0,0,0,0.4);
                padding: 14px;
                border-radius: 14px;
                font-size: 0.85rem;
                color: var(--accent);
                border: 1px solid rgba(0,242,255,0.15);
                margin-bottom: 25px;
                word-break: break-all;
                position: relative;
            }

            .endpoint::after {
                content: 'GET';
                position: absolute;
                right: 14px; top: 14px;
                font-size: 0.65rem; font-weight: 800;
                color: rgba(255,255,255,0.3);
            }

            .btn {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                background: #ffffff;
                color: #000000;
                text-decoration: none;
                border-radius: 16px;
                font-weight: 700;
                font-size: 0.95rem;
                transition: all 0.3s;
            }

            .btn:hover {
                background: var(--primary);
                color: #fff;
                transform: translateY(-2px);
                box-shadow: 0 10px 25px rgba(255, 61, 113, 0.4);
            }

            footer {
                text-align: center;
                padding: 80px 0 40px;
                animation: fadeIn 2s ease;
            }

            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

            .dev-tag {
                font-weight: 800;
                color: #666;
                letter-spacing: 3px;
                text-transform: uppercase;
                font-size: 0.75rem;
                border: 1px solid #222;
                padding: 12px 30px;
                border-radius: 50px;
                display: inline-block;
                background: rgba(255,255,255,0.01);
                transition: all 0.3s;
            }

            .dev-tag:hover {
                color: var(--text);
                border-color: var(--primary);
                letter-spacing: 5px;
            }

            @media (max-width: 480px) {
                .container { padding: 40px 16px; }
                .card { padding: 25px; }
                h1 { margin-bottom: 10px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <div class="badge">Enterprise API Solution</div>
                <h1>MovieBox Pro</h1>
                <p style="color: #667; font-size: 1.25rem; font-weight: 300;">State-of-the-Art Pure API Architecture</p>
            </header>

            <div class="grid">
                <div class="card">
                    <div class="card-title"><i>🏠</i> Discover Home</div>
                    <p class="card-desc">The ultimate window into MovieBox. Headlines, recommended content, and trending blocks updated in real-time.</p>
                    <div class="endpoint">/home</div>
                    <a href="/home" target="_blank" class="btn">Launch API</a>
                </div>

                <div class="card">
                    <div class="card-title"><i>🔍</i> Smart Search</div>
                    <p class="card-desc">High-precision search engine results. Returns titles, posters, and slugs for lightning-fast matching.</p>
                    <div class="endpoint">/search?q=Attack on Titan</div>
                    <a href="/search?q=Attack on Titan" target="_blank" class="btn">Test Search</a>
                </div>

                <div class="card">
                    <div class="card-title"><i>🆔</i> Metadata A-Z</div>
                    <p class="card-desc">Deep-dive into any subject. Episodes, seasons, languages, and full high-resolution metadata trees.</p>
                    <div class="endpoint">/detail/{slug}</div>
                    <a href="/detail/attack-on-titan-hindi-kGWQOIx0d4" target="_blank" class="btn">Fetch Specs</a>
                </div>

                <div class="card">
                    <div class="card-title"><i>🎬</i> Stream Engine</div>
                    <p class="card-desc">Dynamic domain discovery and direct MP4 extraction. Supports multiple resolutions and qualities.</p>
                    <div class="endpoint">/api/stream/{subject_id}</div>
                    <a href="/api/stream/56988683026712168?detail_path=attack-on-titan-hindi-kGWQOIx0d4" target="_blank" class="btn">Get Player Link</a>
                </div>

                <div class="card">
                    <div class="card-title"><i>📦</i> Catalog Filters</div>
                    <p class="card-desc">Paginated collections for all genres. Movies, TV shows, and Animations filtered by professional criteria. Pagination Supported.</p>
                    <div class="endpoint">/tv-series?page=2</div>
                    <a href="/tv-series?page=2" target="_blank" class="btn">Test Page 2</a>
                </div>

                <div class="card">
                    <div class="card-title"><i>💬</i> Subtitle Suite</div>
                    <p class="card-desc">Access to the complete SRT/VTT global database for all streaming subjects.</p>
                    <div class="endpoint">/api/stream/{id}/captions</div>
                    <a href="/api/stream/6207982430134357800/captions?detail_path=breaking-bad-ej6Bp0MCAo7" target="_blank" class="btn">Retrive Subs</a>
                </div>
            </div>

            <footer>
                <div class="dev-tag">Developer: Walter</div>
            </footer>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.get("/home")
async def get_home():
    url = f"{API_BASE}/home?host=moviebox.ph"
    data = await _make_request(url)
    sections = []
    for op in data.get("data", {}).get("operatingList", []) or []:
        op_type = op.get("type")
        title = op.get("title", "Featured")
        if op_type == "BANNER":
            items = [{
                "name": item.get("title") or (item.get("subject") or {}).get("title"),
                "poster_url": item.get("image", {}).get("url") or (item.get("subject") or {}).get("cover", {}).get("url"),
                "slug": item.get("detailPath") or (item.get("subject") or {}).get("detailPath"),
                "subject_id": (item.get("subject") or {}).get("subjectId"),
                "badge": (item.get("subject") or {}).get("corner")
            } for item in op.get("banner", {}).get("items", []) if item.get("title") and "Communities" not in item.get("title")]
            sections.append({"section": "Banner", "count": len(items), "items": items})
        elif op_type in ["SUBJECTS_MOVIE", "SUBJECTS_TV", "SUBJECTS_ANIMATION"]:
            items = [{
                "name": sub.get("title"),
                "poster_url": sub.get("cover", {}).get("url"),
                "slug": sub.get("detailPath"),
                "subject_id": sub.get("subjectId"),
                "badge": sub.get("corner"),
                "rating": sub.get("imdbRatingValue")
            } for sub in op.get("subjects", [])]
            sections.append({"section": title, "count": len(items), "items": items})
    return {"status": "success", "sections": sections}

async def _get_category_data(tab_id: int, page: int = 1, per_page: int = 24, sort: str = "RECOMMEND") -> dict:
    url = f"{API_BASE}/subject/filter"
    payload = {"tabId": tab_id, "filter": {"sort": sort, "genre": "ALL", "country": "ALL", "year": "ALL", "language": "ALL"}, "page": page, "perPage": per_page}
    data = await _make_request(url, method="POST", payload=payload)
    inner = data.get("data", {})
    raw_items = inner.get("items", inner.get("subjects", []))
    items = [{
        "name": sub.get("title"),
        "poster_url": sub.get("cover", {}).get("url"),
        "slug": sub.get("detailPath"),
        "subject_id": sub.get("subjectId"),
        "badge": sub.get("corner"),
        "rating": sub.get("imdbRatingValue"),
        "year": sub.get("releaseDate", "")[:4] if sub.get("releaseDate") else None
    } for sub in raw_items]
    pager = inner.get("pager", {})
    total = pager.get("totalCount") or inner.get("total") or len(items)
    return {"page": page, "per_page": per_page, "total": total, "items": items}

@app.get("/movies")
async def get_movies(page: int = 1, sort: str = "RECOMMEND"):
    return await _get_category_data(tab_id=2, page=page, sort=sort)

@app.get("/tv-series")
async def get_tv_series(page: int = 1, sort: str = "RECOMMEND"):
    return await _get_category_data(tab_id=5, page=page, sort=sort)

@app.get("/animation")
async def get_animation(page: int = 1, sort: str = "RECOMMEND"):
    return await _get_category_data(tab_id=8, page=page, sort=sort)

@app.get("/search/suggest")
async def get_search_suggestions(q: str = Query(..., min_length=1)):
    url = f"{API_BASE}/subject/search-suggest"
    data = await _make_request(url, method="POST", payload={"keyword": q, "perPage": 10})
    inner = data.get("data", {})
    raw = inner.get("items", inner.get("list", []))
    suggestions = []
    for item in raw:
        sub = item.get("subject") or {}
        suggestions.append({
            "title": sub.get("title") or item.get("word") or item.get("title"),
            "slug": sub.get("detailPath") or item.get("detailPath"),
            "subject_id": sub.get("subjectId") or item.get("subjectId")
        })
    return {"suggestions": suggestions}

@app.get("/search")
async def search(q: str = Query(..., min_length=1), page: int = 1):
    url = f"{API_BASE}/subject/search"
    data = await _make_request(url, method="POST", payload={"keyword": q, "page": page, "perPage": 20})
    inner = data.get("data", {})
    raw = inner.get("items", inner.get("list", []))
    items = [{
        "name": sub.get("title"),
        "poster_url": sub.get("cover", {}).get("url"),
        "slug": sub.get("detailPath"),
        "subject_id": sub.get("subjectId")
    } for sub in raw]
    pager = inner.get("pager", {})
    total = pager.get("totalCount") or inner.get("total") or len(items)
    return {"query": q, "page": page, "total": total, "items": items}

@app.get("/detail/{slug}")
async def get_movie_detail(slug: str):
    url = f"{API_BASE}/detail?detailPath={slug}"
    return await _make_request(url)

def srt_to_webvtt(srt_text: str) -> str:
    """
    Convert SRT subtitle text to browser-compatible WebVTT.
    """

    # Remove UTF-8 BOM if present
    srt_text = srt_text.lstrip("\ufeff")

    # Normalize line endings
    srt_text = srt_text.replace("\r\n", "\n").replace("\r", "\n")

    # WebVTT uses '.' instead of ',' for milliseconds
    srt_text = re.sub(
        r"(\d{2}:\d{2}:\d{2}),(\d{3})",
        r"\1.\2",
        srt_text
    )

    return "WEBVTT\n\n" + srt_text.strip() + "\n"

async def _fetch_player_data(
    subject_id: str,
    detail_path: str,
    se: int,
    ep: int,
):
    """Fetch upstream player data, retrying the alternate movie index.

    MovieBox currently indexes movies at 0/0 while episodic content uses
    real season/episode numbers. The fallback is deliberately performed
    only when the requested player response contains no streams.
    """
    dom_data = await _make_request(
        f"{API_BASE}/media-player/get-domain"
    )
    domain = dom_data.get("data", "https://netfilm.world").rstrip("/")

    async def fetch_for(request_se: int, request_ep: int):
        player_referer = (
            f"{domain}/spa/videoPlayPage/movies/{detail_path}"
            f"?id={subject_id}&type=/movie/detail"
            f"&detailSe={request_se}&detailEp={request_ep}&lang=en"
        )
        play_url = (
            f"{domain}/wefeed-h5api-bff/subject/play"
            f"?subjectId={subject_id}&se={request_se}&ep={request_ep}"
            f"&detailPath={detail_path}"
        )

        async with httpx.AsyncClient(
            follow_redirects=True, timeout=25
        ) as client:
            response = await client.get(
                play_url,
                headers={
                    **PLAYER_HEADERS,
                    "Referer": player_referer,
                },
            )
            response.raise_for_status()
            data = response.json().get("data", {})

        return data, request_se, request_ep, player_referer

    data, effective_se, effective_ep, player_referer = await fetch_for(se, ep)

    # Movies are indexed upstream at season 0 / episode 0.
    # Normalize legacy movie links such as 0/1 before trying the
    # old defensive fallbacks. TV/anime episode coordinates remain unchanged.
    if not data.get("streams"):
        if se == 0 and ep != 0:
            data, effective_se, effective_ep, player_referer = await fetch_for(0, 0)
        elif se == 0 and ep == 0:
            # Keep the existing defensive fallback for older upstream data.
            data, effective_se, effective_ep, player_referer = await fetch_for(1, 1)
        elif se == 1 and ep in (0, 1):
            data, effective_se, effective_ep, player_referer = await fetch_for(0, 0)

    return data, effective_se, effective_ep, player_referer, domain


@app.get("/api/stream/{subject_id}")
async def get_stream_sources(subject_id: str, detail_path: str, se: int = 1, ep: int = 1):
    try:
        data, effective_se, effective_ep, _referer, _domain = await _fetch_player_data(
            subject_id, detail_path, se, ep
        )
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(
            status_code=502,
            detail=f"Could not load player data: {exc}",
        )

    has_resource = data.get("hasResource", False)
    streams = [
        {
            "resolution": f"{source.get('resolutions')}p",
            "format": source.get("format"),
            "url": source.get("url"),
            "size": source.get("size"),
            "duration": source.get("duration"),
            "codec": source.get("codecName"),
        }
        for source in data.get("streams", [])
    ]

    return {
        "subject_id": subject_id,
        "se": effective_se,
        "ep": effective_ep,
        "has_resource": has_resource,
        "sources": streams,
        "hls": data.get("hls", []),
        "dash": data.get("dash", []),
        "free_episodes": data.get("freeNum"),
        "limited": data.get("limited", False),
        "note": None if has_resource else "No stream found for this episode.",
    }


@app.get("/api/stream-diagnose/{subject_id}")
async def diagnose_stream_sources(
    subject_id: str,
    detail_path: str,
    se: int = 1,
    ep: int = 1,
):
    """
    Diagnose whether the upstream media URLs returned by the player API
    are actually reachable from this backend environment.

    This endpoint only performs a small Range request (first 1 KB) and
    reports the upstream response. It does NOT proxy or bypass the
    upstream media server.
    """
    dom_data = await _make_request(f"{API_BASE}/media-player/get-domain")
    domain = dom_data.get("data", "https://netfilm.world").rstrip("/")

    player_referer = (
        f"{domain}/spa/videoPlayPage/movies/{detail_path}"
        f"?id={subject_id}&type=/movie/detail&detailSe={se}&detailEp={ep}&lang=en"
    )
    play_url = (
        f"{domain}/wefeed-h5api-bff/subject/play"
        f"?subjectId={subject_id}&se={se}&ep={ep}&detailPath={detail_path}"
    )

    async with httpx.AsyncClient(follow_redirects=True, timeout=25) as client:
        try:
            resp = await client.get(
                play_url,
                headers={**PLAYER_HEADERS, "Referer": player_referer},
            )
            resp.raise_for_status()
            play_data = resp.json().get("data", {})
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Could not obtain stream metadata: {exc}",
            )

        results = []
        for index, source in enumerate(play_data.get("streams", [])):
            url = source.get("url")
            if not url:
                continue

            result = {
                "index": index,
                "resolution": f"{source.get('resolutions')}p",
                "format": source.get("format"),
                "codec": source.get("codecName"),
                "duration": source.get("duration"),
                "status": None,
                "content_type": None,
                "content_range": None,
                "content_length": None,
                "redirected_url": None,
                "playable_response": False,
                "error": None,
            }

            try:
                media_headers = {
                    "User-Agent": DEFAULT_HEADERS["User-Agent"],
                    "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8",
                    "Range": "bytes=0-1023",
                    "Referer": player_referer,
                    "Origin": "https://moviebox.ph",
                }
                media_resp = await client.get(url, headers=media_headers)

                result.update({
                    "status": media_resp.status_code,
                    "content_type": media_resp.headers.get("content-type"),
                    "content_range": media_resp.headers.get("content-range"),
                    "content_length": media_resp.headers.get("content-length"),
                    "redirected_url": str(media_resp.url),
                    "playable_response": (
                        media_resp.status_code in (200, 206)
                        and media_resp.headers.get("content-type", "")
                        .lower()
                        .split(";")[0]
                        in {"video/mp4", "application/mp4"}
                    ),
                })
            except Exception as exc:
                result["error"] = str(exc)

            results.append(result)

    return {
        "subject_id": subject_id,
        "se": se,
        "ep": ep,
        "sources_tested": len(results),
        "results": results,
    }

@app.get("/api/video/{subject_id}")
async def proxy_video(
    subject_id: str,
    request: Request,
    detail_path: str,
    se: int = 1,
    ep: int = 1,
    quality: str = "1080p",
):
    """
    Stream a selected video source through this backend.

    The backend first obtains the fresh signed media URL from the existing
    player API, then forwards the browser's Range request to that upstream
    URL. This keeps the browser from contacting the upstream media host
    directly while preserving HTTP Range/206 seeking support.
    """
    if quality.lower() == "auto":
        quality = "1080p"

    try:
        play_data, effective_se, effective_ep, player_referer, domain = await _fetch_player_data(
            subject_id, detail_path, se, ep
        )
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(
            status_code=502,
            detail=f"Could not obtain video source: {exc}",
        )

    streams = play_data.get("streams", [])
    selected = None

    # Prefer the requested quality. Fall back to the first available stream.
    for source in streams:
        resolution = f"{source.get('resolutions')}p"
        if resolution.lower() == quality.lower():
            selected = source
            break

    if selected is None and streams:
        selected = streams[0]

    if not selected or not selected.get("url"):
        raise HTTPException(
            status_code=404,
            detail=f"No playable video source found for quality {quality}.",
        )

    upstream_url = selected["url"]
    range_header = request.headers.get("range")

    upstream_headers = {
        "User-Agent": DEFAULT_HEADERS["User-Agent"],
        "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8",
        "Referer": player_referer,
        "Origin": "https://moviebox.ph",
    }

    if range_header:
        upstream_headers["Range"] = range_header

    client = httpx.AsyncClient(follow_redirects=True, timeout=None)

    try:
        upstream_request = client.build_request(
            "GET",
            upstream_url,
            headers=upstream_headers,
        )
        upstream_response = await client.send(upstream_request, stream=True)

        if upstream_response.status_code not in (200, 206):
            status = upstream_response.status_code
            content_type = upstream_response.headers.get("content-type", "")
            await upstream_response.aclose()
            await client.aclose()
            raise HTTPException(
                status_code=502,
                detail=(
                    f"Upstream video server returned HTTP {status}"
                    f" ({content_type or 'unknown content type'})."
                ),
            )

        response_headers = {
            "Accept-Ranges": upstream_response.headers.get("accept-ranges", "bytes"),
            "Content-Type": upstream_response.headers.get("content-type", "video/mp4"),
        }

        for header_name in (
            "content-length",
            "content-range",
            "cache-control",
            "content-disposition",
            "etag",
            "last-modified",
        ):
            value = upstream_response.headers.get(header_name)
            if value:
                response_headers[header_name.title()] = value

        async def stream_video():
            try:
                async for chunk in upstream_response.aiter_bytes(1024 * 1024):
                    yield chunk
            finally:
                await upstream_response.aclose()
                await client.aclose()

        return StreamingResponse(
            stream_video(),
            status_code=upstream_response.status_code,
            media_type=upstream_response.headers.get("content-type", "video/mp4").split(";", 1)[0],
            headers=response_headers,
        )

    except HTTPException:
        raise
    except Exception as exc:
        await client.aclose()
        raise HTTPException(
            status_code=502,
            detail=f"Video streaming failed: {exc}",
        )


@app.get("/api/stream/{subject_id}/captions")
async def get_captions(subject_id: str, detail_path: str, se: int = 1, ep: int = 1):
    try:
        play_data, effective_se, effective_ep, _referer, _domain = await _fetch_player_data(
            subject_id, detail_path, se, ep
        )
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(
            status_code=502,
            detail=f"Could not load caption data: {exc}",
        )

    streams = play_data.get("streams", [])
    dash = play_data.get("dash", [])

    stream_id = None
    stream_format = None
    if streams:
        stream_id = streams[0].get("id")
        stream_format = streams[0].get("format", "MP4")
    elif dash:
        stream_id = dash[0].get("id")
        stream_format = dash[0].get("format", "DASH")

    if not stream_id:
        return {
            "subject_id": subject_id,
            "se": effective_se,
            "ep": effective_ep,
            "count": 0,
            "captions": [],
        }

    cap_url = (
        f"{API_BASE}/subject/caption"
        f"?format={stream_format}&id={stream_id}"
        f"&subjectId={subject_id}&detailPath={detail_path}"
    )
    data = await _make_request(cap_url)
    inner = data.get("data", {})
    captions = inner.get("captions", []) if isinstance(inner, dict) else inner

    return {
        "subject_id": subject_id,
        "se": effective_se,
        "ep": effective_ep,
        "count": len(captions),
        "captions": captions,
    }


def srt_to_webvtt(srt_text: str) -> str:
    """Convert SRT subtitle text to browser-compatible WebVTT."""

    # Remove UTF-8 BOM if present.
    srt_text = srt_text.lstrip("\ufeff")

    # Normalize line endings.
    srt_text = srt_text.replace("\r\n", "\n").replace("\r", "\n")

    # WebVTT uses a dot for milliseconds instead of a comma.
    srt_text = re.sub(
        r"(\d{2}:\d{2}:\d{2}),(\d{3})",
        r"\1.\2",
        srt_text
    )

    return "WEBVTT\n\n" + srt_text.strip() + "\n"


@app.get("/api/subtitle")
async def get_subtitle(url: str):
    """Fetch an SRT subtitle resource and return it as WebVTT."""

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=25
        ) as client:

            response = await client.get(url)

            if response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Subtitle server returned {response.status_code}"
                )

            srt_text = response.text

        webvtt = srt_to_webvtt(srt_text)

        return PlainTextResponse(
            content=webvtt,
            media_type="text/vtt",
            headers={
                "Access-Control-Allow-Origin": "*"
            }
        )

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch subtitle: {str(e)}"
        )

@app.get("/test-video")
async def test_video(request: Request):

    file_path = "test.mp4"

    if not os.path.exists(file_path):
        return {
            "error": "test.mp4 not found"
        }

    file_size = os.path.getsize(file_path)

    range_header = request.headers.get("range")

    if not range_header:
        def iterfile():
            with open(file_path, "rb") as video:
                while chunk := video.read(1024 * 1024):
                    yield chunk

        return StreamingResponse(
            iterfile(),
            media_type="video/mp4",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
            },
        )

    # Example:
    # Range: bytes=1000000-

    range_value = range_header.replace(
        "bytes=",
        ""
    )

    range_start, range_end = range_value.split("-")

    range_start = int(range_start)

    if range_end:
        range_end = int(range_end)
    else:
        range_end = file_size - 1

    range_end = min(
        range_end,
        file_size - 1
    )

    content_length = (
        range_end - range_start + 1
    )

    def iter_range():
        with open(file_path, "rb") as video:

            video.seek(range_start)

            remaining = content_length

            while remaining > 0:

                chunk_size = min(
                    1024 * 1024,
                    remaining
                )

                chunk = video.read(
                    chunk_size
                )

                if not chunk:
                    break

                remaining -= len(chunk)

                yield chunk

    return StreamingResponse(
        iter_range(),
        status_code=206,
        media_type="video/mp4",
        headers={
            "Accept-Ranges": "bytes",
            "Content-Range":
                f"bytes {range_start}-{range_end}/{file_size}",
            "Content-Length":
                str(content_length),
        },
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("newapi:app", host="0.0.0.0", port=8000, reload=True)
