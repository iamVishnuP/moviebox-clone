import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
    getHistoryItem,
    saveWatchHistory,
} from "../utils/watchHistory";

import { API_URL } from "../config";

function Watch() {
    const { slug, season, episode } = useParams();
    const navigate = useNavigate();

    /*
     * MovieBox uses 0/0 for movies in the upstream player API.
     * Older movie links in this app can still be /watch/:slug/0/1,
     * so normalize the playback coordinates here. TV/anime episodes
     * keep their real season/episode numbers.
     */
    const routeSeason = Number(season);
    const routeEpisode = Number(episode);
    const isMovie = routeSeason === 0;
    const streamSeason = isMovie ? 0 : routeSeason;
    const streamEpisode = isMovie ? 0 : routeEpisode;

    const videoRef = useRef(null);
    const playerRef = useRef(null);
    const trackRef = useRef(null);
    const controlsTimeoutRef = useRef(null);
    const autoplayTimeoutRef = useRef(null);
    const pauseSyncTimeoutRef = useRef(null);
    const isPlayingRef = useRef(false);

    // Used to preserve playback state when switching quality.
    const pendingPlaybackRef = useRef(null);
    const previousSourceUrlRef = useRef(null);
    const resumeRequestRef = useRef(null);

    const [movie, setMovie] = useState(null);
    const [stream, setStream] = useState(null);
    const [captions, setCaptions] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [showViewMenu, setShowViewMenu] = useState(false);
    const [videoFit, setVideoFit] = useState("contain");
    const [playerAspect, setPlayerAspect] = useState("16/9");
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Source manager / player status.
    const [playerStatus, setPlayerStatus] = useState("idle");
    const [playerError, setPlayerError] = useState("");
    const [, setSourceAttempts] = useState(0);

    const [quality, setQuality] = useState("1080p");
    const [playbackSpeed, setPlaybackSpeed] = useState(1);

    const [captionLanguage, setCaptionLanguage] = useState("off");
    const [subtitleUrl, setSubtitleUrl] = useState("");
    const [subtitleLoading, setSubtitleLoading] = useState(false);

    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const [showNextEpisode, setShowNextEpisode] =
        useState(false);

    const [resumePoint, setResumePoint] = useState(null);
    const [showResumePrompt, setShowResumePrompt] =
        useState(false);

    /*
     * ==========================================
     * VIDEO SOURCE MANAGER
     * ==========================================
     *
     * Normalize the backend source list in one
     * place so the player does not depend on the
     * exact API response shape.
     */
    const normalizedSources = Array.isArray(stream?.sources)
        ? stream.sources
            .filter((source) => source?.url)
            .map((source, index) => ({
                id:
                    source.id ||
                    `${source.resolution || "source"}-${index}`,
                url: source.url,
                resolution:
                    source.resolution ||
                    source.quality ||
                    "Auto",
                format:
                    source.format ||
                    source.type ||
                    "video/mp4",
                codec:
                    source.codec ||
                    source.video_codec ||
                    "",
                duration: source.duration || null,
            }))
        : [];

    const selectedSource =
        normalizedSources.find(
            (source) => source.resolution === quality
        ) || normalizedSources[0] || null;

    // The stream API already returns the subject ID. Keep it in render scope
    // so the player source effect can build the proxy URL safely.
    const subjectId =
        stream?.subject_id ||
        movie?.subject?.subjectId ||
        movie?.subject?.subject_id ||
        null;

    const availableQualities = [
        ...new Set(
            normalizedSources
                .map((source) => source.resolution)
                .filter(Boolean)
        ),
    ];

    /*
     * ==========================================
     * WATCH PROGRESS
     * ==========================================
     *
     * Progress is stored in localStorage per
     * movie + season + episode.
     */
    const progressStorageKey =
        `moviebox-progress:${slug}:s${streamSeason}:e${streamEpisode}`;

    function getSavedProgress() {
        try {
            const saved = localStorage.getItem(
                progressStorageKey
            );

            if (saved) {
                const parsed = JSON.parse(saved);

                if (
                    Number.isFinite(parsed?.time) &&
                    parsed.time > 0
                ) {
                    return parsed;
                }
            }

            // Backward compatibility: older builds stored the resume
            // position in the watch-history object instead of the
            // dedicated progress key.
            const historyItem = getHistoryItem(
                slug,
                streamSeason,
                streamEpisode
            );

            const historyTime = Number(
                historyItem?.time ??
                historyItem?.currentTime
            );
            const historyDuration = Number(
                historyItem?.duration
            );

            if (
                Number.isFinite(historyTime) &&
                historyTime > 0
            ) {
                return {
                    time: historyTime,
                    duration: Number.isFinite(historyDuration)
                        ? historyDuration
                        : 0,
                    updatedAt: historyItem?.lastWatched || 0,
                };
            }

            return null;
        } catch (progressError) {
            console.warn(
                "Could not read watch progress:",
                progressError
            );
            return null;
        }
    }

    function saveProgress(time, totalDuration) {
        if (
            !Number.isFinite(time) ||
            time <= 5 ||
            !Number.isFinite(totalDuration) ||
            totalDuration <= 0
        ) {
            return;
        }

        /*
         * Don't keep a "resume" point when the user
         * is essentially at the end of the episode.
         */
        if (time / totalDuration >= 0.95) {
            try {
                localStorage.removeItem(
                    progressStorageKey
                );
            } catch (progressError) {
                console.warn(
                    "Could not clear completed progress:",
                    progressError
                );
            }
            return;
        }

        try {
            localStorage.setItem(
                progressStorageKey,
                JSON.stringify({
                    time,
                    duration: totalDuration,
                    updatedAt: Date.now(),
                })
            );
        } catch (progressError) {
            console.warn(
                "Could not save watch progress:",
                progressError
            );
        }
    }

    function clearProgress() {
        try {
            localStorage.removeItem(
                progressStorageKey
            );
        } catch (progressError) {
            console.warn(
                "Could not clear watch progress:",
                progressError
            );
        }

        setResumePoint(null);
        setShowResumePrompt(false);
    }

    function formatResumeTime(seconds) {
        return formatTime(seconds);
    }

    /*
     * ==========================================
     * LOAD MOVIE + STREAM + CAPTIONS
     * ==========================================
     */

    useEffect(() => {
        let cancelled = false;

        async function loadWatchData() {
            try {
                setLoading(true);
                setError("");
                setPlayerStatus("loading");
                setPlayerError("");
                setSourceAttempts(0);

                setMovie(null);
                setStream(null);
                setCaptions([]);

                setCurrentTime(0);
                setDuration(0);

                const savedProgress =
                    getSavedProgress();

                setResumePoint(savedProgress);
                setShowResumePrompt(
                    Boolean(
                        savedProgress?.time > 10
                    )
                );

                setIsPlaying(false);
                setIsBuffering(false);
                setShowControls(true);
                setShowSettings(false);
                setShowNextEpisode(false);

                if (autoplayTimeoutRef.current) {
                    clearTimeout(
                        autoplayTimeoutRef.current
                    );
                    autoplayTimeoutRef.current = null;
                }

                setCaptionLanguage("off");
                setSubtitleUrl("");

                const detailResponse = await fetch(
                    `${API_URL}/detail/${slug}`
                );

                if (!detailResponse.ok) {
                    throw new Error("Failed to load movie details");
                }

                const detailData = await detailResponse.json();

                if (cancelled) return;

                setMovie(detailData.data);

                const subjectId =
                    detailData.data.subject.subjectId;

                /*
                 * LOAD VIDEO STREAM
                 */

                const streamResponse = await fetch(
                    `${API_URL}/api/stream/${subjectId}?detail_path=${encodeURIComponent(
                        slug
                    )}&se=${streamSeason}&ep=${streamEpisode}`
                );

                if (!streamResponse.ok) {
                    throw new Error("Failed to load video stream");
                }

                const streamData = await streamResponse.json();

                console.log("========== STREAM DATA ==========");
                console.log(streamData);

                if (cancelled) return;

                if (
                    !streamData.sources ||
                    streamData.sources.length === 0
                ) {
                    throw new Error("No video source available");
                }

                setStream(streamData);
                setPlayerStatus("ready");
                setPlayerError("");

                const firstPlayableSource =
                    streamData.sources.find(
                        (source) => source?.url
                    );

                if (firstPlayableSource?.resolution) {
                    setQuality(firstPlayableSource.resolution);
                }

                /*
                 * GET DURATION FROM API
                 */

                const firstSource = streamData.sources[0];
                const apiDuration = Number(firstSource?.duration);

                if (
                    Number.isFinite(apiDuration) &&
                    apiDuration > 0
                ) {
                    setDuration(apiDuration);
                }

                /*
                 * LOAD CAPTIONS
                 */

                try {
                    const captionResponse = await fetch(
                        `${API_URL}/api/stream/${subjectId}/captions?detail_path=${encodeURIComponent(
                            slug
                        )}&se=${streamSeason}&ep=${streamEpisode}`
                    );

                    if (captionResponse.ok) {
                        const captionData =
                            await captionResponse.json();

                        if (!cancelled) {
                            setCaptions(
                                captionData.captions || []
                            );
                        }
                    }
                } catch (captionError) {
                    console.warn(
                        "Caption loading failed:",
                        captionError
                    );

                    if (!cancelled) {
                        setCaptions([]);
                    }
                }
            } catch (err) {
                console.error("Watch page error:", err);

                if (!cancelled) {
                    setPlayerStatus("error");
                    setPlayerError(
                        err?.message ||
                        "Failed to load video"
                    );
                    setError(
                        err?.message ||
                        "Failed to load video"
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadWatchData();

        return () => {
            cancelled = true;
        };
    }, [slug, season, episode]);

    /*
     * ==========================================
     * CONVERT SELECTED SRT TO WEBVTT
     * ==========================================
     */

    useEffect(() => {
        let cancelled = false;
        let objectUrl = null;

        async function loadSubtitle() {
            if (
                captionLanguage === "off" ||
                !captions.length
            ) {
                setSubtitleUrl("");
                return;
            }

            const selectedCaption = captions.find(
                (caption) =>
                    caption.lan === captionLanguage
            );

            if (!selectedCaption?.url) {
                setSubtitleUrl("");
                return;
            }

            try {
                setSubtitleLoading(true);
                setSubtitleUrl("");

                const proxyUrl =
                    `${API_URL}/api/subtitle?url=` +
                    encodeURIComponent(
                        selectedCaption.url
                    );

                const response = await fetch(proxyUrl);

                if (!response.ok) {
                    throw new Error(
                        `Subtitle request failed: ${response.status}`
                    );
                }

                const webvtt = await response.text();

                if (cancelled) return;

                if (
                    !webvtt.trim().startsWith("WEBVTT")
                ) {
                    throw new Error(
                        "Invalid WebVTT subtitle response"
                    );
                }

                const blob = new Blob(
                    [webvtt],
                    { type: "text/vtt" }
                );

                objectUrl = URL.createObjectURL(blob);

                setSubtitleUrl(objectUrl);
            } catch (subtitleError) {
                console.error(
                    "Subtitle conversion failed:",
                    subtitleError
                );

                if (!cancelled) {
                    setSubtitleUrl("");
                }
            } finally {
                if (!cancelled) {
                    setSubtitleLoading(false);
                }
            }
        }

        loadSubtitle();

        return () => {
            cancelled = true;

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [captionLanguage, captions]);

    /*
     * ==========================================
     * CONTROL NATIVE TEXT TRACK MODE
     * ==========================================
     */

    useEffect(() => {
        const video = videoRef.current;

        if (!video) return;

        const updateTrackMode = () => {
            const track = trackRef.current;

            if (!track?.track) return;

            track.track.mode =
                captionLanguage === "off"
                    ? "disabled"
                    : "showing";
        };

        updateTrackMode();

        const timer = setTimeout(
            updateTrackMode,
            100
        );

        return () => clearTimeout(timer);
    }, [
        captionLanguage,
        subtitleUrl,
        selectedSource
    ]);

    /*
     * ==========================================
     * UPDATE DURATION
     * ==========================================
     */

    useEffect(() => {
        const video = videoRef.current;

        if (!video) return;

        function handleLoadedMetadata() {
            if (
                Number.isFinite(video.duration) &&
                video.duration > 0
            ) {
                setDuration(video.duration);
            }
        }

        video.addEventListener(
            "loadedmetadata",
            handleLoadedMetadata
        );

        return () => {
            video.removeEventListener(
                "loadedmetadata",
                handleLoadedMetadata
            );
        };
    }, []);

    /*
     * ==========================================
     * APPLY SELECTED VIDEO SOURCE
     * ==========================================
     *
     * Use the real source URL returned by the
     * backend /api/stream endpoint.
     *
     * /test-video is intentionally NOT used here.
     * It remains available in the backend only as a
     * local playback test endpoint.
     */

    useEffect(() => {
        const video = videoRef.current;

        if (!video || !selectedSource || !subjectId) return;

        setPlayerStatus("switching");
        setPlayerError("");

        /*
         * IMPORTANT: the URL in /api/stream is the upstream media URL.
         * Do NOT give that URL directly to <video>. Some MovieBox media hosts
         * require the backend's Referer/Origin headers and proper HTTP Range
         * handling, so Chrome can leave the direct source stuck buffering or
         * report NotSupportedError even though the source is valid.
         *
         * /api/video proxies the selected source through our FastAPI backend,
         * refreshes the signed upstream URL, forwards the browser Range header,
         * and returns the correct 200/206 response to the video element.
         */
        const playableUrl =
            `${API_URL}/api/video/${subjectId}` +
            `?detail_path=${encodeURIComponent(slug)}` +
            `&se=${encodeURIComponent(streamSeason)}` +
            `&ep=${encodeURIComponent(streamEpisode)}` +
            `&quality=${encodeURIComponent(selectedSource.resolution)}`;

        /*
         * Don't reload the same playable source.
         */
        if (
            previousSourceUrlRef.current ===
            playableUrl
        ) {
            setPlayerStatus("ready");
            return;
        }

        /*
         * Preserve playback state.
         */
        // On the first source load there is no previous playback state
        // to restore. A saved progress point is handled separately by the
        // Resume button. For later source changes (for example quality
        // switching), preserve the current playback position.
        if (previousSourceUrlRef.current !== null) {
            pendingPlaybackRef.current = {
                currentTime: video.currentTime || 0,
                wasPlaying: !video.paused,
            };
        } else {
            pendingPlaybackRef.current = null;
        }

        previousSourceUrlRef.current =
            playableUrl;

        video.src = playableUrl;
        video.load();
    }, [selectedSource, subjectId, slug, season, episode]);

    /*
     * ==========================================
     * RESTORE PLAYBACK AFTER SOURCE CHANGE
     * ==========================================
     */

    useEffect(() => {
        const video = videoRef.current;

        if (!video) return;

        async function restorePlayback() {
            const pending = pendingPlaybackRef.current;

            setDuration(
                Number.isFinite(video.duration) && video.duration > 0
                    ? video.duration
                    : duration
            );

            // A Resume click may have happened before metadata was ready.
            // Give that request priority over all other first-load logic.
            if (resumeRequestRef.current !== null) {
                const requested = resumeRequestRef.current;

                if (Number.isFinite(video.duration) && video.duration > 0) {
                    const resumeTime = Math.min(
                        requested,
                        Math.max(0, video.duration - 1)
                    );

                    try {
                        video.currentTime = resumeTime;
                        setCurrentTime(video.currentTime);
                        resumeRequestRef.current = null;
                        setPlayerStatus("ready");
                        setIsBuffering(false);
                        await video.play();
                        return;
                    } catch (resumeError) {
                        console.warn(
                            "Could not apply requested resume position:",
                            resumeError
                        );
                    }
                }
            }

            // First source load: do not automatically jump to the saved
            // point. The Resume prompt controls that action.
            if (!pending) {
                setPlayerStatus(
                    resumePoint?.time > 10
                        ? "paused"
                        : "ready"
                );
                setIsBuffering(false);

                return;
            }

            // Quality/source switch: restore the position that was already
            // playing before the source changed.
            setPlayerStatus("ready");
            setIsBuffering(false);

            if (Number.isFinite(pending.currentTime)) {
                try {
                    video.currentTime = Math.min(
                        pending.currentTime,
                        video.duration || pending.currentTime
                    );
                    setCurrentTime(video.currentTime);
                } catch (restoreError) {
                    console.warn(
                        "Could not restore playback position:",
                        restoreError
                    );
                }
            }

            if (pending.wasPlaying) {
                try {
                    await video.play();
                } catch (playError) {
                    console.warn(
                        "Could not resume playback:",
                        playError
                    );
                }
            }

            pendingPlaybackRef.current = null;
        }

        video.addEventListener(
            "loadedmetadata",
            restorePlayback
        );

        // If metadata loaded before this effect attached its listener,
        // handle an already-ready video as well.
        if (
            video.readyState >= 1 &&
            Number.isFinite(video.duration) &&
            video.duration > 0
        ) {
            restorePlayback();
        }

        return () => {
            video.removeEventListener(
                "loadedmetadata",
                restorePlayback
            );
        };
    }, [selectedSource]);

    /*
     * ==========================================
     * APPLY PLAYBACK SPEED
     * ==========================================
     */

    useEffect(() => {
        const video = videoRef.current;

        if (!video) return;

        video.playbackRate = playbackSpeed;
    }, [playbackSpeed]);

    /*
     * ==========================================
     * APPLY VOLUME
     * ==========================================
     */

    useEffect(() => {
        const video = videoRef.current;

        if (!video) return;

        video.volume = volume;
        video.muted = isMuted;
    }, [volume, isMuted]);

    /*
     * ==========================================
     * AUTO HIDE CONTROLS
     * ==========================================
     */

    function showPlayerControls() {
        setShowControls(true);

        if (controlsTimeoutRef.current) {
            clearTimeout(
                controlsTimeoutRef.current
            );
        }

        if (isPlaying && !showSettings && !showViewMenu) {
            controlsTimeoutRef.current =
                setTimeout(() => {
                    setShowControls(false);
                }, 2500);
        }
    }

    useEffect(() => {
        return () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(
                    controlsTimeoutRef.current
                );
            }

            if (autoplayTimeoutRef.current) {
                clearTimeout(
                    autoplayTimeoutRef.current
                );
            }

            if (pauseSyncTimeoutRef.current) {
                clearTimeout(
                    pauseSyncTimeoutRef.current
                );
            }
        };
    }, []);

    useEffect(() => {
        const controlsTimer = setTimeout(() => {
            if (isPlaying) {
                showPlayerControls();
            } else {
                setShowControls(true);
            }
        }, 0);

        return () => clearTimeout(controlsTimer);
    }, [isPlaying, showSettings, showViewMenu]);

    /*
     * ==========================================
     * PLAY / PAUSE
     * ==========================================
     */

    async function togglePlay() {
        const video = videoRef.current;

        if (!video) return;

        try {
            if (video.paused) {
                await video.play();
                setIsPlaying(true);
                setPlayerStatus("playing");
            } else {
                video.pause();
                setIsPlaying(false);
                setPlayerStatus("paused");
            }
        } catch (playbackError) {
            console.error(
                "Video playback failed:",
                playbackError
            );
            console.error(
                "Video error:",
                video.error
            );
        }
    }

    /*
     * ==========================================
     * VIDEO CLICK
     * ==========================================
     */

    function handleVideoClick() {
        showPlayerControls();
        togglePlay();
    }

    /*
     * ==========================================
     * SEEK
     * ==========================================
     */

    function seekBy(seconds) {
        const video = videoRef.current;

        if (!video) return;

        const videoDuration =
            Number.isFinite(video.duration) &&
                video.duration > 0
                ? video.duration
                : duration;

        if (
            !Number.isFinite(videoDuration) ||
            videoDuration <= 0
        ) {
            return;
        }

        const newTime = Math.max(
            0,
            Math.min(
                video.currentTime + seconds,
                videoDuration
            )
        );

        video.currentTime = newTime;
        setCurrentTime(newTime);
        showPlayerControls();
    }

    function handleSeek(event) {
        const video = videoRef.current;

        if (!video) return;

        const newTime = Number(
            event.target.value
        );

        if (Number.isFinite(newTime)) {
            video.currentTime = newTime;
            setCurrentTime(newTime);
            showPlayerControls();
        }
    }

    /*
     * ==========================================
     * VIDEO TIME UPDATE
     * ==========================================
     */

    function handleTimeUpdate() {
        const video = videoRef.current;

        if (!video) return;

        const time = video.currentTime;
        const totalDuration =
            video.duration || duration;

        setCurrentTime(time);

        /* Save the resume point. */
        saveProgress(
            time,
            totalDuration
        );

        /*
         * Keep a separate history record. Unlike the
         * resume point, history survives completion.
         */
        if (
            movie?.subject?.title &&
            Number.isFinite(totalDuration) &&
            totalDuration > 0 &&
            time > 5
        ) {
            const completed =
                time / totalDuration >= 0.95;

            saveWatchHistory({
                id: `${slug}:s${streamSeason}:e${streamEpisode}`,
                slug,
                title: movie.subject.title,
                poster:
                    movie?.subject?.cover?.url ||
                    movie?.subject?.cover?.thumbnail ||
                    "",
                season: streamSeason,
                episode: streamEpisode,
                currentTime: time,
                time,
                duration: totalDuration,
                completed,
                lastWatched: Date.now(),
            });
        }
    }

    /*
     * ==========================================
     * KEYBOARD CONTROLS
     * ==========================================
     */

    useEffect(() => {
        function handleKeyDown(event) {
            const tag =
                document.activeElement?.tagName;

            if (
                tag === "INPUT" ||
                tag === "BUTTON" ||
                tag === "SELECT" ||
                tag === "TEXTAREA"
            ) {
                return;
            }

            switch (event.key.toLowerCase()) {
                case " ":
                case "k":
                    event.preventDefault();
                    togglePlay();
                    showPlayerControls();
                    break;

                case "arrowleft":
                    event.preventDefault();
                    seekBy(-10);
                    break;

                case "arrowright":
                    event.preventDefault();
                    seekBy(10);
                    break;

                case "m":
                    event.preventDefault();
                    setIsMuted(
                        (previous) => !previous
                    );
                    showPlayerControls();
                    break;

                case "f":
                    event.preventDefault();
                    toggleFullscreen();
                    break;

                case "v":
                    event.preventDefault();
                    setShowViewMenu((previous) => !previous);
                    setShowSettings(false);
                    showPlayerControls();
                    break;

                case "escape":
                    setShowSettings(false);
                    setShowViewMenu(false);
                    cancelNextEpisode();
                    setShowResumePrompt(false);
                    break;

                default:
                    break;
            }
        }

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    });

    /*
     * ==========================================
     * FULLSCREEN
     * ==========================================
     */

    function toggleFullscreen() {
        const player = playerRef.current;

        if (!player) return;

        if (!document.fullscreenElement) {
            player.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }

        showPlayerControls();
    }

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
            showPlayerControls();
        };

        document.addEventListener(
            "fullscreenchange",
            handleFullscreenChange
        );

        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleFullscreenChange
            );
        };
    }, []);

    function changeVideoFit(mode, aspect = "16/9") {
        setVideoFit(mode);
        setPlayerAspect(aspect);
        setShowViewMenu(false);
        setShowSettings(false);
        setShowControls(true);
    }

    /*
     * ==========================================
     * CAPTIONS
     * ==========================================
     */

    function selectCaption(language) {
        setCaptionLanguage(language);
        setShowSettings(false);
        setShowControls(true);
    }

    function toggleCaptions() {
        if (!captions.length) {
            return;
        }

        if (captionLanguage === "off") {
            const englishCaption =
                captions.find(
                    (caption) =>
                        caption.lan === "en"
                );

            const nextLanguage =
                englishCaption?.lan ||
                captions[0]?.lan ||
                "off";

            selectCaption(nextLanguage);
        } else {
            selectCaption("off");
        }
    }

    /*
     * ==========================================
     * DOUBLE CLICK
     * ==========================================
     */

    function handleDoubleClick(event) {
        event.stopPropagation();
        toggleFullscreen();
    }

    /*
     * ==========================================
     * EPISODE NAVIGATION
     * ==========================================
     */

    function goToEpisode(nextEpisode) {
        navigate(
            `/watch/${slug}/${season}/${nextEpisode}`
        );
    }

    /*
     * ==========================================
     * CURRENT SEASON / EPISODE
     * ==========================================
     */

    const currentEpisode =
        isMovie ? 0 : routeEpisode;

    const currentSeason =
        !isMovie
            ? movie?.resource?.seasons?.find(
                (item) =>
                    item.se === routeSeason
            )
            : null;

    const maxEpisode =
        currentSeason?.maxEp ||
        currentEpisode;

    const hasPreviousEpisode =
        !isMovie && currentEpisode > 1;

    const hasNextEpisode =
        !isMovie && currentEpisode < maxEpisode;

    /*
     * ==========================================
     * RESUME PLAYBACK
     * ==========================================
     */

    async function resumeFromSavedPosition() {
        const video = videoRef.current;

        if (!video || !resumePoint) return;

        const requestedTime = Math.max(
            0,
            Number(resumePoint.time) || 0
        );

        setShowResumePrompt(false);
        resumeRequestRef.current = requestedTime;

        const applyResumePosition = async () => {
            const currentVideo = videoRef.current;
            const requested = resumeRequestRef.current;

            if (!currentVideo || requested === null) return;

            if (
                !Number.isFinite(currentVideo.duration) ||
                currentVideo.duration <= 0
            ) {
                return;
            }

            const resumeTime = Math.min(
                requested,
                Math.max(0, currentVideo.duration - 1)
            );

            try {
                currentVideo.currentTime = resumeTime;
                setCurrentTime(currentVideo.currentTime);
                resumeRequestRef.current = null;

                console.log(
                    "RESUMING FROM:",
                    currentVideo.currentTime
                );

                await currentVideo.play();
            } catch (resumeError) {
                console.error(
                    "Could not resume video:",
                    resumeError
                );
            }
        };

        // The user can press Resume before the video metadata has loaded.
        // Wait for metadata in that case so currentTime is applied to the
        // actual loaded source instead of being overwritten by video.load().
        if (
            video.readyState >= 1 &&
            Number.isFinite(video.duration) &&
            video.duration > 0
        ) {
            await applyResumePosition();
        } else {
            video.addEventListener(
                "loadedmetadata",
                applyResumePosition,
                { once: true }
            );
        }
    }

    async function startFromBeginning() {
        const video = videoRef.current;

        clearProgress();

        if (!video) return;

        try {
            video.currentTime = 0;
            setCurrentTime(0);
            setShowResumePrompt(false);
            await video.play();
        } catch (startError) {
            console.error(
                "Could not start video:",
                startError
            );
        }
    }

    /*
     * ==========================================
     * NEXT EPISODE / AUTOPLAY
     * ==========================================
     */

    function handleVideoEnded() {
        setIsPlaying(false);
        setIsBuffering(false);

        /*
         * Preserve a completed history record even though
         * the resume point itself is removed.
         */
        if (movie?.subject?.title) {
            saveWatchHistory({
                id: `${slug}:s${streamSeason}:e${streamEpisode}`,
                slug,
                title: movie.subject.title,
                poster:
                    movie?.subject?.cover?.url ||
                    movie?.subject?.cover?.thumbnail ||
                    "",
                season: streamSeason,
                episode: streamEpisode,
                currentTime:
                    videoRef.current?.duration || duration,
                time: videoRef.current?.duration || duration,
                duration:
                    videoRef.current?.duration || duration,
                completed: true,
                lastWatched: Date.now(),
            });
        }

        /*
         * The episode has been completed, so its resume
         * point is no longer needed.
         */
        clearProgress();

        if (!hasNextEpisode) {
            setShowNextEpisode(false);
            return;
        }

        /*
         * Show the next-episode panel immediately
         * when the current episode finishes.
         */
        setShowNextEpisode(true);

        /*
         * Give the user a short window to cancel.
         * Navigation only happens automatically when
         * the next episode is available.
         */
        if (autoplayTimeoutRef.current) {
            clearTimeout(autoplayTimeoutRef.current);
        }

        autoplayTimeoutRef.current =
            setTimeout(() => {
                goToEpisode(
                    currentEpisode + 1
                );
            }, 8000);
    }

    function cancelNextEpisode() {
        if (autoplayTimeoutRef.current) {
            clearTimeout(
                autoplayTimeoutRef.current
            );
            autoplayTimeoutRef.current = null;
        }

        setShowNextEpisode(false);
    }

    function watchNextEpisode() {
        if (!hasNextEpisode) return;

        if (autoplayTimeoutRef.current) {
            clearTimeout(
                autoplayTimeoutRef.current
            );
            autoplayTimeoutRef.current = null;
        }

        setShowNextEpisode(false);

        goToEpisode(
            currentEpisode + 1
        );
    }

    /*
     * ==========================================
     * PLAYER EVENT HANDLERS
     * ==========================================
     */

    const handleWaiting = () => {
        setIsBuffering(true);
        setPlayerStatus("buffering");
    };

    const handleCanPlay = () => {
        setIsBuffering(false);
        setPlayerStatus("ready");
        setPlayerError("");
    };

    const handlePlaying = (event) => {
        const video =
            event?.currentTarget || videoRef.current;

        if (pauseSyncTimeoutRef.current) {
            clearTimeout(pauseSyncTimeoutRef.current);
            pauseSyncTimeoutRef.current = null;
        }

        if (!video) return;

        isPlayingRef.current = true;
        setIsPlaying(true);

        setIsBuffering(false);
        setPlayerStatus("playing");
        setPlayerError("");
    };

    const handlePause = (event) => {
        const video =
            event?.currentTarget || videoRef.current;

        if (!video) return;

        if (pauseSyncTimeoutRef.current) {
            clearTimeout(pauseSyncTimeoutRef.current);
        }

        pauseSyncTimeoutRef.current = setTimeout(() => {
            pauseSyncTimeoutRef.current = null;

            // A temporary pause event can happen while play() is
            // transitioning. Check the actual media element again.
            if (!video.paused && !video.ended) {
                isPlayingRef.current = true;
                setIsPlaying(true);
                setPlayerStatus("playing");
                return;
            }

            isPlayingRef.current = false;
            setIsPlaying(false);

            setPlayerStatus((status) =>
                status === "error" || status === "switching"
                    ? status
                    : "paused"
            );
        }, 50);
    };

    const handleVideoError = (event) => {
        const mediaError =
            event?.currentTarget?.error;

        let message =
            "This video source could not be played.";

        switch (mediaError?.code) {
            case 1:
                message = "Video loading was aborted.";
                break;
            case 2:
                message =
                    "Network error while loading the video.";
                break;
            case 3:
                message =
                    "The video could not be decoded.";
                break;
            case 4:
                message =
                    "This video format or source is not supported.";
                break;
            default:
                break;
        }

        console.error("Video playback error:", {
            code: mediaError?.code,
            message: mediaError?.message,
            source: selectedSource?.url,
        });

        setIsBuffering(false);
        setIsPlaying(false);
        setPlayerStatus("error");
        setPlayerError(message);
    };

    const handleRetrySource = () => {
        const video = videoRef.current;

        setPlayerError("");
        setPlayerStatus("loading");
        setIsBuffering(true);
        setSourceAttempts((count) => count + 1);

        if (!video) return;

        /*
         * Keep the exact backend-provided URL.
         * These URLs may be signed, so adding a query
         * parameter can invalidate them.
         */
        video.load();
    };

    /*
     * ==========================================
     * LOADING SCREEN
     * ==========================================
     */

    if (loading) {
        return (
            <>
                <Navbar />

                <div className="watch-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading video...</p>
                </div>
            </>
        );
    }

    /*
     * ==========================================
     * ERROR SCREEN
     * ==========================================
     */

    if (error) {
        return (
            <>
                <Navbar />

                <div className="watch-error">
                    <h2>
                        Unable to load video
                    </h2>

                    <p>{error}</p>

                    <Link
                        to={`/movie/${slug}`}
                        className="back-button"
                    >
                        ← Back to Details
                    </Link>
                </div>
            </>
        );
    }

    /*
     * ==========================================
     * MAIN UI
     * ==========================================
     */

    return (
        <>
            <Navbar />

            <main className="watch-page">

                {/* =================================
                    VIDEO PLAYER
                ================================= */}

                <div
                    className={`video-player-wrapper ${showControls
                        ? ""
                        : "controls-hidden"
                        } player-aspect-${playerAspect.replace("/", "-")}`}
                    style={{
                        aspectRatio: playerAspect,
                    }}
                    ref={playerRef}
                    onMouseMove={
                        showPlayerControls
                    }
                    onMouseLeave={() => {
                        if (
                            isPlaying &&
                            !showSettings
                        ) {
                            setShowControls(false);
                        }
                    }}
                    onDoubleClick={
                        handleDoubleClick
                    }
                >

                    <video
                        ref={videoRef}
                        className="video-player"
                        style={{
                            objectFit: videoFit,
                        }}
                        poster={
                            movie?.subject?.cover?.url
                        }
                        playsInline
                        preload="auto"
                        onClick={
                            handleVideoClick
                        }
                        onTimeUpdate={
                            handleTimeUpdate
                        }
                        onPlay={handlePlaying}
                        onPause={handlePause}
                        onWaiting={handleWaiting}
                        onPlaying={handlePlaying}
                        onCanPlay={handleCanPlay}
                        onEnded={handleVideoEnded}
                        onLoadedData={() =>
                            console.log(
                                "VIDEO DATA LOADED"
                            )
                        }
                        onError={handleVideoError}
                    >
                        {subtitleUrl &&
                            captionLanguage !==
                            "off" && (
                                <track
                                    ref={trackRef}
                                    key={
                                        subtitleUrl
                                    }
                                    kind="subtitles"
                                    src={
                                        subtitleUrl
                                    }
                                    srcLang={
                                        captionLanguage
                                    }
                                    label={
                                        captions.find(
                                            (
                                                caption
                                            ) =>
                                                caption.lan ===
                                                captionLanguage
                                        )?.lanName ||
                                        captionLanguage
                                    }
                                    default
                                />
                            )}
                    </video>

                    {/* =================================
                        PLAYER STATUS / ERROR
                    ================================= */}

                    {(playerStatus === "loading" ||
                        playerStatus === "switching") && (
                            <div className="player-status-overlay">
                                <div className="player-spinner"></div>
                                <span>
                                    {playerStatus === "switching"
                                        ? `Switching to ${quality}...`
                                        : "Loading video..."}
                                </span>
                            </div>
                        )}

                    {playerStatus === "error" &&
                        playerError && (
                            <div className="player-error-overlay">
                                <div className="player-error-title">
                                    Unable to play this source
                                </div>

                                <div className="player-error-message">
                                    {playerError}
                                </div>

                                <button
                                    type="button"
                                    className="player-retry-button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        handleRetrySource();
                                    }}
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                    {/* =================================
                        BUFFERING
                    ================================= */}

                    {isBuffering && (
                        <div className="player-buffering">
                            <div className="loading-spinner"></div>
                        </div>
                    )}

                    {/* =================================
                        RESUME OVERLAY
                    ================================= */}

                    {showResumePrompt &&
                        resumePoint?.time > 10 && (
                            <div className="resume-overlay">
                                <div className="resume-card">
                                    <div className="resume-label">
                                        Continue watching
                                    </div>

                                    <h3>
                                        Resume Episode
                                    </h3>

                                    <p>
                                        You stopped at{" "}
                                        <strong>
                                            {formatResumeTime(
                                                resumePoint.time
                                            )}
                                        </strong>
                                    </p>

                                    <div className="resume-actions">
                                        <button
                                            type="button"
                                            className="resume-watch-button"
                                            onClick={
                                                resumeFromSavedPosition
                                            }
                                        >
                                            Resume
                                        </button>

                                        <button
                                            type="button"
                                            className="resume-start-button"
                                            onClick={
                                                startFromBeginning
                                            }
                                        >
                                            Start Over
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    {/* =================================
                        NEXT EPISODE OVERLAY
                    ================================= */}

                    {showNextEpisode &&
                        hasNextEpisode && (
                            <div className="next-episode-overlay">
                                <div className="next-episode-card">
                                    <div className="next-episode-label">
                                        Episode finished
                                    </div>

                                    <h3>
                                        Next Episode
                                    </h3>

                                    <p>
                                        Season {season}
                                        {" · "}
                                        Episode{" "}
                                        {currentEpisode + 1}
                                    </p>

                                    <div className="next-episode-actions">
                                        <button
                                            type="button"
                                            className="next-episode-watch"
                                            onClick={
                                                watchNextEpisode
                                            }
                                        >
                                            Watch Now
                                        </button>

                                        <button
                                            type="button"
                                            className="next-episode-cancel"
                                            onClick={
                                                cancelNextEpisode
                                            }
                                        >
                                            Cancel
                                        </button>
                                    </div>

                                    <div className="next-episode-autoplay">
                                        Automatically playing next episode...
                                    </div>
                                </div>
                            </div>
                        )}

                    {/* =================================
                        CENTER PLAY / PAUSE
                    ================================= */}

                    <button
                        className={`center-play-button ${isPlaying ? "is-playing" : ""
                            }`}
                        onClick={(event) => {
                            event.stopPropagation();
                            togglePlay();
                            showPlayerControls();
                        }}
                        aria-label={
                            isPlaying
                                ? "Pause"
                                : "Play"
                        }
                    >
                        {isPlaying ? "❚❚" : "▶"}
                    </button>

                    {/* =================================
                        PLAYER CONTROLS
                    ================================= */}

                    <div className="player-controls">

                        {/* PROGRESS BAR */}

                        <input
                            type="range"
                            className="progress-bar"
                            min="0"
                            max={duration || 0}
                            step="0.1"
                            value={Math.min(
                                currentTime,
                                duration || 0
                            )}
                            onChange={
                                handleSeek
                            }
                        />

                        <div className="controls-row">

                            {/* LEFT CONTROLS */}

                            <div className="controls-left">

                                {/* PLAY / PAUSE */}

                                <button
                                    className={
                                        isPlaying
                                            ? "player-button active-control"
                                            : "player-button"
                                    }
                                    onClick={
                                        togglePlay
                                    }
                                    title={
                                        isPlaying
                                            ? "Pause"
                                            : "Play"
                                    }
                                >
                                    {isPlaying
                                        ? "❚❚"
                                        : "▶"}
                                </button>

                                {/* BACK 10 */}

                                <button
                                    className="player-button"
                                    onClick={() =>
                                        seekBy(-10)
                                    }
                                    title="Back 10 seconds"
                                >
                                    ↶
                                </button>

                                {/* FORWARD 10 */}

                                <button
                                    className="player-button"
                                    onClick={() =>
                                        seekBy(10)
                                    }
                                    title="Forward 10 seconds"
                                >
                                    ↷
                                </button>

                                {/* MUTE */}

                                <button
                                    className={
                                        isMuted
                                            ? "player-button active-control"
                                            : "player-button"
                                    }
                                    onClick={() =>
                                        setIsMuted(
                                            (previous) =>
                                                !previous
                                        )
                                    }
                                    title={
                                        isMuted
                                            ? "Unmute"
                                            : "Mute"
                                    }
                                >
                                    {isMuted
                                        ? "🔇"
                                        : "🔊"}
                                </button>

                                {/* VOLUME */}

                                <input
                                    type="range"
                                    className="volume-slider"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={
                                        isMuted
                                            ? 0
                                            : volume
                                    }
                                    onChange={(
                                        event
                                    ) => {
                                        const newVolume =
                                            Number(
                                                event
                                                    .target
                                                    .value
                                            );

                                        setVolume(
                                            newVolume
                                        );

                                        if (
                                            newVolume >
                                            0
                                        ) {
                                            setIsMuted(
                                                false
                                            );
                                        }
                                    }}
                                />

                                {/* TIME */}

                                <span className="time-display">
                                    {formatTime(
                                        currentTime
                                    )}
                                    {" / "}
                                    {formatTime(
                                        duration
                                    )}
                                </span>
                            </div>

                            {/* RIGHT CONTROLS */}

                            <div className="controls-right">

                                {/* CC */}

                                <button
                                    className={
                                        captionLanguage !==
                                            "off"
                                            ? "player-button active-control"
                                            : "player-button"
                                    }
                                    onClick={
                                        toggleCaptions
                                    }
                                    title={
                                        captions.length
                                            ? "Captions"
                                            : "No captions available"
                                    }
                                    disabled={
                                        captions.length ===
                                        0
                                    }
                                >
                                    CC
                                </button>

                                {/* VIEW / ASPECT */}

                                <button
                                    className={
                                        showViewMenu
                                            ? "player-button active-control"
                                            : "player-button"
                                    }
                                    onClick={() => {
                                        setShowViewMenu((previous) => !previous);
                                        setShowSettings(false);
                                        setShowControls(true);
                                    }}
                                    title="View options"
                                    aria-label="View options"
                                >
                                    ◫
                                </button>

                                {/* SETTINGS */}

                                <button
                                    className={
                                        showSettings
                                            ? "player-button active-control"
                                            : "player-button"
                                    }
                                    onClick={() => {
                                        setShowSettings(
                                            (previous) =>
                                                !previous
                                        );
                                        setShowControls(
                                            true
                                        );
                                    }}
                                    title="Settings"
                                >
                                    ⚙
                                </button>

                                {/* FULLSCREEN */}

                                <button
                                    className={
                                        isFullscreen
                                            ? "player-button active-control"
                                            : "player-button"
                                    }
                                    onClick={
                                        toggleFullscreen
                                    }
                                    title={
                                        isFullscreen
                                            ? "Exit fullscreen"
                                            : "Fullscreen"
                                    }
                                >
                                    ⛶
                                </button>

                            </div>
                        </div>
                    </div>

                    {/* =================================
                        VIEW / ASPECT MENU
                    ================================= */}

                    {showViewMenu && (
                        <div
                            className="player-view-menu"
                            onClick={(event) =>
                                event.stopPropagation()
                            }
                        >
                            <div className="player-view-title">View</div>

                            {[
                                {
                                    id: "contain",
                                    label: "Fit to screen",
                                    description: "Show the complete video",
                                    aspect: "16/9",
                                },
                                {
                                    id: "cover",
                                    label: "Fill screen",
                                    description: "Fill the player and crop edges",
                                    aspect: "16/9",
                                },
                                {
                                    id: "none",
                                    label: "Center",
                                    description: "Keep the video centered",
                                    aspect: "16/9",
                                },
                                {
                                    id: "contain",
                                    label: "21:9",
                                    description: "Ultrawide ratio",
                                    aspect: "21/9",
                                },
                                {
                                    id: "contain",
                                    label: "4:3",
                                    description: "Classic ratio",
                                    aspect: "4/3",
                                },
                                {
                                    id: "contain",
                                    label: "1:1",
                                    description: "Square ratio",
                                    aspect: "1/1",
                                },
                                {
                                    id: "contain",
                                    label: "9:16",
                                    description: "Vertical mobile ratio",
                                    aspect: "9/16",
                                },
                            ].map((option) => {
                                const active =
                                    videoFit === option.id &&
                                    playerAspect === option.aspect;

                                return (
                                    <button
                                        type="button"
                                        key={`${option.label}-${option.aspect}`}
                                        className={
                                            active
                                                ? "player-view-option active"
                                                : "player-view-option"
                                        }
                                        onClick={() =>
                                            changeVideoFit(
                                                option.id,
                                                option.aspect
                                            )
                                        }
                                    >
                                        <span className="player-view-option-main">
                                            {option.label}
                                        </span>
                                        <span className="player-view-option-description">
                                            {option.description}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* =================================
                        SETTINGS MENU
                    ================================= */}

                    {showSettings && (
                        <div
                            className="player-settings"
                            onClick={(event) =>
                                event.stopPropagation()
                            }
                        >

                            {/* QUALITY */}

                            <div className="settings-group">
                                <h4>Quality</h4>

                                <div className="settings-options">
                                    {availableQualities.map(
                                        (resolution) => {
                                            const source =
                                                normalizedSources.find(
                                                    (item) =>
                                                        item.resolution ===
                                                        resolution
                                                );

                                            return (
                                                <button
                                                    key={
                                                        source.resolution
                                                    }
                                                    className={
                                                        quality ===
                                                            source.resolution
                                                            ? "settings-option active"
                                                            : "settings-option"
                                                    }
                                                    onClick={() => {
                                                        if (
                                                            quality ===
                                                            source.resolution
                                                        ) {
                                                            setShowSettings(
                                                                false
                                                            );
                                                            return;
                                                        }

                                                        setQuality(
                                                            source.resolution
                                                        );

                                                        setShowSettings(
                                                            false
                                                        );

                                                        showPlayerControls();
                                                    }}
                                                    title={`Switch to ${source.resolution}`}
                                                >
                                                    {
                                                        source.resolution
                                                    }
                                                </button>
                                            );
                                        }
                                    )}
                                </div>

                                <div className="audio-note">
                                    Current quality: {quality}
                                    {normalizedSources.length > 0
                                        ? ` • ${normalizedSources.length} source${normalizedSources.length === 1 ? "" : "s"} available`
                                        : ""}
                                </div>
                            </div>

                            {/* PLAYBACK SPEED */}

                            <div className="settings-group">
                                <h4>
                                    Playback Speed
                                </h4>

                                <div className="settings-options">
                                    {[
                                        0.5,
                                        0.75,
                                        1,
                                        1.25,
                                        1.5,
                                        2
                                    ].map(
                                        (speed) => (
                                            <button
                                                key={
                                                    speed
                                                }
                                                className={
                                                    playbackSpeed ===
                                                        speed
                                                        ? "settings-option active"
                                                        : "settings-option"
                                                }
                                                onClick={() => {
                                                    setPlaybackSpeed(
                                                        speed
                                                    );
                                                    setShowSettings(
                                                        false
                                                    );
                                                }}
                                            >
                                                {speed}x
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* SUBTITLES */}

                            <div className="settings-group">
                                <h4>
                                    Subtitles
                                </h4>

                                <div className="settings-options">

                                    <button
                                        className={
                                            captionLanguage ===
                                                "off"
                                                ? "settings-option active"
                                                : "settings-option"
                                        }
                                        onClick={() =>
                                            selectCaption(
                                                "off"
                                            )
                                        }
                                    >
                                        Off
                                    </button>

                                    {captions.map(
                                        (caption) => (
                                            <button
                                                key={
                                                    caption.id
                                                }
                                                className={
                                                    captionLanguage ===
                                                        caption.lan
                                                        ? "settings-option active"
                                                        : "settings-option"
                                                }
                                                onClick={() =>
                                                    selectCaption(
                                                        caption.lan
                                                    )
                                                }
                                            >
                                                {
                                                    caption.lanName
                                                }
                                            </button>
                                        )
                                    )}

                                </div>

                                {subtitleLoading && (
                                    <div className="audio-note">
                                        Loading subtitles...
                                    </div>
                                )}
                            </div>

                            {/* AUDIO */}

                            <div className="settings-group">
                                <h4>Audio</h4>

                                <div className="audio-note">
                                    Audio tracks will use
                                    the available dubbed
                                    versions from the API.
                                </div>

                                <button
                                    className="settings-option active"
                                    disabled
                                >
                                    Original Audio
                                </button>
                            </div>

                        </div>
                    )}
                </div>

                {/* =================================
                    WATCH INFORMATION
                ================================= */}

                <div className="watch-info">

                    <div>
                        <h1>
                            {
                                movie?.subject
                                    ?.title
                            }
                        </h1>

                        {!isMovie && (
                            <p className="episode-title">
                                Season {routeSeason}
                                {" · "}
                                Episode {routeEpisode}
                            </p>
                        )}
                    </div>

                    <Link
                        to={`/movie/${slug}`}
                        className="back-button"
                    >
                        ← Back to Details
                    </Link>

                </div>

                {/* =================================
                    EPISODE NAVIGATION
                ================================= */}

                <div className="episode-navigation">

                    <button
                        className="episode-nav-button"
                        disabled={
                            !hasPreviousEpisode
                        }
                        onClick={() =>
                            goToEpisode(
                                currentEpisode - 1
                            )
                        }
                    >
                        ← Previous Episode
                    </button>

                    <span>
                        S{season} · E{episode}
                    </span>

                    <button
                        className="episode-nav-button"
                        disabled={
                            !hasNextEpisode
                        }
                        onClick={() =>
                            goToEpisode(
                                currentEpisode + 1
                            )
                        }
                    >
                        Next Episode →
                    </button>

                </div>

            </main>
        </>
    );
}

/*
 * ==========================================
 * FORMAT TIME
 * ==========================================
 */

function formatTime(seconds) {
    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {
        return "0:00";
    }

    const hours =
        Math.floor(seconds / 3600);

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    const remainingSeconds =
        Math.floor(seconds % 60);

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

export default Watch;
