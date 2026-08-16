import React, { useEffect, useState, useRef } from "react";
import Hls from "hls.js";
import "./Videoplayer.css";

const VideoPlayer = (params) => {
    // "hls" | "progressive" | "adaptive". Defaults to "adaptive" (the
    // pre-existing dual video+audio sync behavior) for callers that don't
    // pass mode yet.
    const mode = params.mode || "adaptive";
    const hasAudioElement = mode === "adaptive";

    const [muted, setMuted] = useState(false);
    const [streamUrl, setStreamUrl] = useState("");
    const [audioUrl, setAudioUrl] = useState("");
    const [loop, setLoop] = useState("");
    const videoRef = useRef(null);
    const audioRef = useRef(null);
    const hlsRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(80);
    const [playback_speed, setPlayback_speed] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volumehovered, setVolumehovered] = useState(false);
    const [playerhovered, setPlayerhovered] = useState(false);
    const [showPlaybackspeed, setShowPlaybackspeed] = useState(false);
    const [showQualitychange, setShowQualitychange] = useState(false);
    const [showsettings, setShowsettings] = useState(false);
    const [hlsLevels, setHlsLevels] = useState([]);
    const [hlsActiveLevel, setHlsActiveLevel] = useState(-1);
    const speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

    const speedLabels = {
        1.0: "Normal",
    };
    const timeoutRef = useRef(null);

    const formatDuration = (seconds) => {
        if (!seconds) return "";

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes
                .toString()
                .padStart(2, "0")}:${remainingSeconds
                .toString()
                .padStart(2, "0")}`;
        } else {
            return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
        }
    };

    // Play/pause/seek/speed wiring. Adaptive mode drives a hidden `<video>` +
    // separate `<audio>` kept in sync via timeupdate drift correction (the
    // only mode that still needs this — hls/progressive are single elements
    // where the browser/hls.js handles audio+video together natively).
    useEffect(() => {
        const video = videoRef.current;
        const audio = hasAudioElement ? audioRef.current : null;
        if (!video) return;

        const handlePlay = () => {
            video.play().catch((error) => {
                console.error("Error playing video:", error);
            });
            if (audio) {
                audio.play().catch((error) => {
                    console.error("Error playing video:", error);
                });
                audio.muted = false;
            }
            setIsPlaying(true);
        };

        const handlePause = () => {
            video.pause();
            if (audio) {
                audio.pause();
                audio.muted = true;
            }
            setIsPlaying(false);
        };

        const syncMedia = () => {
            setCurrentTime(video.currentTime);
            if (audio && Math.abs(video.currentTime - audio.currentTime) > 0.3) {
                audio.currentTime = video.currentTime;
            }
        };
        const handleLoadedMetadata = () => {
            setDuration(video.duration);
        };

        video.addEventListener("play", handlePlay);
        video.addEventListener("pause", handlePause);
        video.addEventListener("timeupdate", syncMedia);
        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        if (audio) {
            audio.addEventListener("play", handlePlay);
            audio.addEventListener("pause", handlePause);
            audio.addEventListener("timeupdate", syncMedia);
        }

        return () => {
            video.removeEventListener("play", handlePlay);
            video.removeEventListener("pause", handlePause);
            video.removeEventListener("timeupdate", syncMedia);
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            if (audio) {
                audio.removeEventListener("play", handlePlay);
                audio.removeEventListener("pause", handlePause);
                audio.removeEventListener("timeupdate", syncMedia);
            }
        };
    }, [hasAudioElement]);

    // HLS setup/teardown — only relevant in "hls" mode. Safari plays HLS
    // natively via <video src>, everyone else needs hls.js for MSE-backed
    // adaptive playback.
    useEffect(() => {
        if (mode !== "hls" || !streamUrl) return;
        const video = videoRef.current;
        if (!video) return;

        let hls = null;
        if (Hls.isSupported()) {
            hls = new Hls();
            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
                setHlsLevels(
                    (data.levels || []).map((level, index) => ({
                        index,
                        height: level.height,
                    }))
                );
            });
            hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
                setHlsActiveLevel(data.level);
            });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = streamUrl;
        }

        return () => {
            if (hls) {
                hls.destroy();
            }
            hlsRef.current = null;
            setHlsLevels([]);
            setHlsActiveLevel(-1);
        };
    }, [mode, streamUrl]);

    const handlePlayPause = () => {
        const video = videoRef.current;
        const audio = hasAudioElement ? audioRef.current : null;
        if (isPlaying) {
            video.pause();
            if (audio) audio.pause();
        } else {
            video.play().catch((error) => {
                console.error("Error playing video:", error);
            });
            if (audio) {
                audio.play().catch((error) => {
                    console.error("Error playing audio:", error);
                });
            }
        }
    };

    const handlefullscreen = () => {
        const video = videoRef.current;
        video.requestFullscreen();
        if (!isPlaying) {
            handlePlayPause();
        }
    };

    const handleVolumeChange = (e) => {
        const target = hasAudioElement ? audioRef.current : videoRef.current;
        target.volume = e.target.value / 100;
    };

    const handleSpeedChange = (value) => {
        const video = videoRef.current;
        const audio = hasAudioElement ? audioRef.current : null;
        video.playbackRate = parseFloat(value);
        if (audio) audio.playbackRate = parseFloat(value);
        setPlayback_speed(parseFloat(value));
    };

    const handleRangeChange = (event) => {
        const newTime = parseFloat(event.target.value);
        videoRef.current.currentTime = newTime;
        if (hasAudioElement) audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handlePlay = () => {
        if (hasAudioElement) {
            audioRef.current.muted = false;
        }
    };

    const handleMousemove = () => {
        setPlayerhovered(true);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setPlayerhovered(false);
        }, 2000);
    };

    const handleShowsettings = () => {
        setShowsettings(!showsettings);
        setShowPlaybackspeed(false);
        setShowQualitychange(false);
    };

    const handleshowplayspeed = () => {
        setShowsettings(false);
        setShowPlaybackspeed(!showPlaybackspeed);
        setShowQualitychange(false);
    };
    const handleShowquality = () => {
        setShowsettings(false);
        setShowPlaybackspeed(false);
        setShowQualitychange(!showQualitychange);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        setMuted(params.muted);
        setStreamUrl(params.streamUrl);
        setAudioUrl(params.audioUrl);
        setLoop(params.type === "short" ? true : false);
    }, [
        params.muted,
        params.streamUrl,
        params.audioUrl,
        params.autovideo,
        params.type,
    ]);

    // When the stream URL changes (quality switch, fresh load), the browser
    // doesn't always pick up the new src reliably across browsers — especially
    // for progressive/adaptive modes where we don't recreate the element. Force
    // a reload of both media elements so the new source actually plays.
    useEffect(() => {
        if (mode === "hls") return;
        const video = videoRef.current;
        if (!video || !streamUrl) return;
        const previousTime = video.currentTime || 0;
        const wasPlaying = !video.paused;
        video.load();
        const onLoaded = () => {
            try {
                video.currentTime = previousTime;
            } catch (e) {
                console.error("Error seeking after quality change:", e);
            }
            if (wasPlaying) {
                video.play().catch((error) => {
                    console.error("Error playing video after quality change:", error);
                });
            }
            if (hasAudioElement && audioRef.current) {
                audioRef.current.currentTime = previousTime;
                if (wasPlaying) {
                    audioRef.current.play().catch((error) => {
                        console.error("Error playing audio after quality change:", error);
                    });
                }
            }
            video.removeEventListener("loadedmetadata", onLoaded);
        };
        video.addEventListener("loadedmetadata", onLoaded);
        return () => {
            video.removeEventListener("loadedmetadata", onLoaded);
        };
    }, [mode, streamUrl, hasAudioElement]);

    // Quality menu is driven by hls.js levels in "hls" mode, and by the
    // resolution list Watch.js/Shortbox.js computed server-side otherwise.
    const isHls = mode === "hls";
    const qualityOptions = isHls
        ? hlsLevels.slice().sort((a, b) => (b.height || 0) - (a.height || 0))
        : (params.qualityoptions || []).slice();
    const activeQualityIsAuto = isHls
        ? hlsActiveLevel === -1
        : params.video_resolution === 0;

    const selectQuality = (option) => {
        if (isHls) {
            if (hlsRef.current) hlsRef.current.currentLevel = option;
        } else {
            params.handleQualityChange(option);
        }
        if (hasAudioElement) {
            audioRef.current.muted = true;
        }
        setIsPlaying(false);
    };

    const selectAutoQuality = () => {
        if (isHls) {
            if (hlsRef.current) hlsRef.current.currentLevel = -1;
        } else {
            params.handleQualityChange(0);
        }
        if (hasAudioElement) {
            audioRef.current.muted = true;
        }
        setIsPlaying(false);
    };

    return (
        <div
            className="watch-page"
            onMouseEnter={() => {
                handlePlay();
            }}
        >
            <div
                onClick={() => {
                    handlePlayPause();
                }}
                onMouseMove={() => {
                    handleMousemove();
                }}
            >
                <video
                    ref={videoRef}
                    id="myVideo"
                    className={streamUrl !== "" ? "video" : "hidden-video"}
                    muted={hasAudioElement ? true : muted}
                    src={isHls ? undefined : streamUrl}
                    loop={loop}
                />
                <video
                    className={streamUrl !== "" ? "hidden-video" : "video"}
                    src="/Assets/loading.mp4"
                    autoPlay
                    muted
                />
                {hasAudioElement && (
                    <audio
                        ref={audioRef}
                        src={audioUrl !== "" ? audioUrl : ""}
                        muted={!muted ? false : true}
                    />
                )}
            </div>

            {playerhovered ||
            !isPlaying ||
            showsettings ||
            showPlaybackspeed ||
            showQualitychange ? (
                <div className="controls-videop">
                    <div className="video-progress">
                        <input
                            type="range"
                            min="0"
                            max={duration}
                            step="0.1"
                            value={currentTime}
                            onChange={handleRangeChange}
                        />
                    </div>
                    <div className="controls">
                        <div className="controls-part part1">
                            <button
                                onClick={() => {
                                    handlePlayPause();
                                }}
                                className="control-btn"
                            >
                                {isPlaying ? (
                                    <img
                                        src="https://cdn-icons-png.flaticon.com/128/2920/2920686.png"
                                        alt="Pause"
                                        title="Pause"
                                    />
                                ) : (
                                    <img
                                        src="https://cdn-icons-png.flaticon.com/128/27/27223.png"
                                        alt="Play"
                                        title="Play"
                                    />
                                )}
                            </button>
                            <p className="video-duration">
                                {formatDuration(Math.round(currentTime))
                                    ? formatDuration(Math.round(currentTime))
                                    : "00:00"}{" "}
                                /{" "}
                                {formatDuration(Math.round(duration))
                                    ? formatDuration(Math.round(duration))
                                    : "00:00"}
                            </p>

                            <div className="volume-range">
                                <div
                                    onMouseEnter={() => {
                                        setVolumehovered(true);
                                    }}
                                    onMouseLeave={() => {
                                        setVolumehovered(false);
                                    }}
                                    className="volume-div"
                                >
                                    {volume < 5 ? (
                                        <img
                                            src="https://cdn-icons-png.flaticon.com/128/7640/7640162.png"
                                            alt="Volume"
                                            title="Muted"
                                            className="volume-icon"
                                        />
                                    ) : (
                                        <img
                                            src="https://cdn-icons-png.flaticon.com/128/4024/4024628.png"
                                            alt="Volume"
                                            title="Volume"
                                            className="volume-icon"
                                        />
                                    )}
                                </div>

                                {volumehovered ? (
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={volume}
                                        onChange={(e) => {
                                            setVolume(e.target.value);
                                            handleVolumeChange(e);
                                        }}
                                        onMouseEnter={() => {
                                            setVolumehovered(true);
                                        }}
                                        onMouseLeave={() => {
                                            setVolumehovered(false);
                                        }}
                                    />
                                ) : null}
                            </div>
                        </div>
                        <div className="controls-part part2">
                            <div className="video-settings">
                                <button
                                    className="control-btn"
                                    onClick={() => {
                                        showsettings
                                            ? handleShowsettings(false)
                                            : handleShowsettings(true);
                                    }}
                                >
                                    <img
                                        src="https://cdn-icons-png.flaticon.com/128/2040/2040504.png"
                                        title="Settings"
                                        alt="settings"
                                    />
                                </button>
                                {showsettings ||
                                showPlaybackspeed ||
                                showQualitychange ? (
                                    <div className="option-box">
                                        {showsettings ? (
                                            <>
                                                <div className="option-head">
                                                    Settings
                                                </div>
                                                <div
                                                    className="options"
                                                    onClick={() => {
                                                        handleshowplayspeed();
                                                    }}
                                                >
                                                    <img
                                                        src="https://cdn-icons-png.flaticon.com/128/53/53128.png"
                                                        alt="playback_speed"
                                                        title="Playback speed"
                                                        className="options-img"
                                                    />
                                                    Playback speed
                                                </div>
                                                <div
                                                    className="options"
                                                    onClick={() => {
                                                        handleShowquality();
                                                    }}
                                                >
                                                    <img
                                                        src="https://cdn-icons-png.flaticon.com/128/70/70115.png"
                                                        alt="quality"
                                                        title="Quality"
                                                        className="options-img"
                                                    />
                                                    Quality
                                                </div>
                                            </>
                                        ) : showPlaybackspeed ? (
                                            <>
                                                <div
                                                    className="option-head"
                                                    onClick={() => {
                                                        handleShowsettings();
                                                    }}
                                                >
                                                    {"< "} Playback speed
                                                </div>
                                                {speeds.map((speed) => (
                                                    <div
                                                        key={speed}
                                                        className="options"
                                                        onClick={() =>
                                                            handleSpeedChange(
                                                                speed
                                                            )
                                                        }
                                                    >
                                                        <img
                                                            className={`option-img-tick ${
                                                                playback_speed ===
                                                                speed
                                                                    ? "tick"
                                                                    : ""
                                                            }`}
                                                            src="https://cdn-icons-png.flaticon.com/128/3388/3388530.png"
                                                            alt="tick"
                                                        />
                                                        {speedLabels[speed] ||
                                                            speed}
                                                    </div>
                                                ))}
                                            </>
                                        ) : showQualitychange ? (
                                            <>
                                                <div
                                                    className="option-head"
                                                    onClick={() => {
                                                        handleShowsettings();
                                                    }}
                                                >
                                                    {"< "} Quality
                                                </div>
                                                {qualityOptions.map((option) => {
                                                    const value = isHls ? option.index : option;
                                                    const label = isHls
                                                        ? (option.height ? option.height + "p" : "Unknown")
                                                        : (qualityOptions.length > 1 ? option + "p" : option);
                                                    const isActive = isHls
                                                        ? hlsActiveLevel === option.index
                                                        : params.video_resolution === option;
                                                    return (
                                                        <div
                                                            key={value}
                                                            onClick={() => selectQuality(value)}
                                                            className="options"
                                                        >
                                                            <img
                                                                className={`option-img-tick ${isActive ? "tick" : ""}`}
                                                                src="https://cdn-icons-png.flaticon.com/128/3388/3388530.png"
                                                                alt="tick"
                                                            />
                                                            {label}
                                                        </div>
                                                    );
                                                })}
                                                <div
                                                    onClick={selectAutoQuality}
                                                    className="options"
                                                >
                                                    <img
                                                        className={`option-img-tick ${
                                                            activeQualityIsAuto ? "tick" : ""
                                                        }`}
                                                        src="https://cdn-icons-png.flaticon.com/128/3388/3388530.png"
                                                        alt="tick"
                                                    />
                                                    Auto
                                                </div>
                                            </>
                                        ) : (
                                            <></>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                            <div className="fullscreen">
                                <button
                                    className="control-btn"
                                    onClick={() => {
                                        handlefullscreen();
                                    }}
                                >
                                    <img
                                        src="https://cdn-icons-png.flaticon.com/128/3876/3876090.png"
                                        alt="fullscreen"
                                        title="Fullscreen"
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default VideoPlayer;
