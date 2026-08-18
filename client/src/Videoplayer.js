import React, { useEffect, useState, useRef } from "react";
import Hls from "hls.js";
import "./Videoplayer.css";

const VideoPlayer = (params) => {
    const mode = params.mode || "progressive";
    const hasAudioElement = mode === "adaptive";

    const [muted, setMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(80);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volumeHovered, setVolumeHovered] = useState(false);
    const [playerHovered, setPlayerHovered] = useState(false);
    const [showPlaybackSpeed, setShowPlaybackSpeed] = useState(false);
    const [showQuality, setShowQuality] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [hlsLevels, setHlsLevels] = useState([]);
    const [hlsActiveLevel, setHlsActiveLevel] = useState(-1);
    const [qualities, setQualities] = useState([]);
    const [selectedQuality, setSelectedQuality] = useState("auto");
    const videoRef = useRef(null);
    const audioRef = useRef(null);
    const hlsRef = useRef(null);
    const timeoutRef = useRef(null);

    const speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

    const formatDuration = (seconds) => {
        if (!seconds && seconds !== 0) return "00:00";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        }
        return `${minutes}:${secs.toString().padStart(2, "0")}`;
    };

    const isHls = mode === "hls";
    const streamUrl = params.streamUrl;
    const audioUrl = params.audioUrl;

    useEffect(() => {
        setMuted(params.muted);
    }, [params.muted]);

    useEffect(() => {
        const video = videoRef.current;
        const audio = hasAudioElement ? audioRef.current : null;
        if (!video) return;

        const handlePlay = () => {
            setIsPlaying(true);
            if (audio) audio.muted = false;
        };
        const handlePause = () => {
            setIsPlaying(false);
            if (audio) audio.muted = true;
        };
        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            if (audio && Math.abs(video.currentTime - audio.currentTime) > 0.3) {
                audio.currentTime = video.currentTime;
            }
        };
        const handleLoadedMetadata = () => setDuration(video.duration);

        video.addEventListener("play", handlePlay);
        video.addEventListener("pause", handlePause);
        video.addEventListener("timeupdate", handleTimeUpdate);
        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        if (audio) {
            audio.addEventListener("play", handlePlay);
            audio.addEventListener("pause", handlePause);
            audio.addEventListener("timeupdate", handleTimeUpdate);
        }

        return () => {
            video.removeEventListener("play", handlePlay);
            video.removeEventListener("pause", handlePause);
            video.removeEventListener("timeupdate", handleTimeUpdate);
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            if (audio) {
                audio.removeEventListener("play", handlePlay);
                audio.removeEventListener("pause", handlePause);
                audio.removeEventListener("timeupdate", handleTimeUpdate);
            }
        };
    }, [hasAudioElement]);

    useEffect(() => {
        if (!isHls || !streamUrl) return;
        const video = videoRef.current;
        if (!video) return;

        let hls = null;
        if (Hls.isSupported()) {
            hls = new Hls({ startLevel: -1, capLevelToPlayerSize: true });
            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
                const levels = (data.levels || []).map((level, index) => ({
                    index,
                    height: level.height,
                    bitrate: level.bitrate,
                }));
                setHlsLevels(levels);
                setQualities(levels);
            });
            hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
                setHlsActiveLevel(data.level);
            });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = streamUrl;
        }

        return () => {
            if (hls) hls.destroy();
            hlsRef.current = null;
            setHlsLevels([]);
            setHlsActiveLevel(-1);
        };
    }, [isHls, streamUrl]);

    useEffect(() => {
        if (isHls) return;
        if (!params.qualityoptions || params.qualityoptions.length === 0) return;
        const opts = params.qualityoptions.filter((q) => q !== "Auto" && q !== "auto");
        if (opts.length > 0) {
            setQualities(opts.map((q) => ({ height: parseInt(q), label: q + "p" })));
            setSelectedQuality("auto");
        }
    }, [params.qualityoptions, isHls]);

    useEffect(() => {
        if (isHls) return;
        const video = videoRef.current;
        if (!video || !streamUrl) return;
        const wasPlaying = !video.paused;
        const prevTime = video.currentTime;
        video.load();
        const onLoaded = () => {
            try {
                video.currentTime = prevTime;
            } catch (e) {
                console.error("Seek error:", e);
            }
            if (wasPlaying) video.play().catch(console.error);
            if (hasAudioElement && audioRef.current) {
                audioRef.current.currentTime = prevTime;
                if (wasPlaying) audioRef.current.play().catch(console.error);
            }
            video.removeEventListener("loadedmetadata", onLoaded);
        };
        video.addEventListener("loadedmetadata", onLoaded);
        return () => video.removeEventListener("loadedmetadata", onLoaded);
    }, [streamUrl, isHls, hasAudioElement]);

    useEffect(() => {
        if (!hasAudioElement) return;
        const audio = audioRef.current;
        if (!audio || !audioUrl) return;
        audio.src = audioUrl;
        audio.load();
    }, [audioUrl, hasAudioElement]);

    const handlePlayPause = () => {
        const video = videoRef.current;
        const audio = hasAudioElement ? audioRef.current : null;
        if (!video) return;
        if (isPlaying) {
            video.pause();
            if (audio) audio.pause();
        } else {
            video.play().catch(console.error);
            if (audio) audio.play().catch(console.error);
        }
    };

    const handleFullscreen = () => {
        const video = videoRef.current;
        video?.requestFullscreen();
        if (!isPlaying) handlePlayPause();
    };

    const handleVolumeChange = (e) => {
        const target = hasAudioElement ? audioRef.current : videoRef.current;
        if (target) target.volume = e.target.value / 100;
    };

    const handleSpeedChange = (value) => {
        const video = videoRef.current;
        const audio = hasAudioElement ? audioRef.current : null;
        const rate = parseFloat(value);
        if (video) video.playbackRate = rate;
        if (audio) audio.playbackRate = rate;
        setPlaybackSpeed(rate);
        setShowPlaybackSpeed(false);
    };

    const handleSeek = (e) => {
        const video = videoRef.current;
        const audio = hasAudioElement ? audioRef.current : null;
        const newTime = parseFloat(e.target.value);
        if (video) video.currentTime = newTime;
        if (audio) audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handleMouseMove = () => {
        setPlayerHovered(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setPlayerHovered(false), 2000);
    };

    const selectHlsQuality = (level) => {
        if (hlsRef.current) hlsRef.current.currentLevel = level;
        setShowQuality(false);
    };

    const selectProgressiveQuality = (height) => {
        params.handleQualityChange(height);
        setSelectedQuality(height);
        setShowQuality(false);
    };

    const selectAutoQuality = () => {
        if (isHls && hlsRef.current) {
            hlsRef.current.currentLevel = -1;
        } else {
            params.handleQualityChange(0);
        }
        setSelectedQuality("auto");
        setShowQuality(false);
    };

    const qualityOptions = isHls ? hlsLevels : qualities;
    const activeIsAuto = isHls ? hlsActiveLevel === -1 : selectedQuality === "auto";

    return (
        <div className="videoplayer-wrap" onMouseMove={handleMouseMove}>
            <div className="video-layer" onClick={handlePlayPause}>
                <video
                    ref={videoRef}
                    className={streamUrl ? "video" : "hidden-video"}
                    src={isHls ? undefined : streamUrl}
                    muted={hasAudioElement ? true : muted}
                    loop={params.type === "short"}
                    playsInline
                />
                <video
                    className={streamUrl ? "hidden-video" : "video"}
                    src="/Assets/loading.mp4"
                    autoPlay
                    muted
                    loop
                />
                {hasAudioElement && (
                    <audio
                        ref={audioRef}
                        src={audioUrl !== "" ? audioUrl : ""}
                        muted={!muted ? false : true}
                    />
                )}
            </div>

            {(playerHovered || !isPlaying || showSettings || showPlaybackSpeed || showQuality) && (
                <div className="controls">
                    <div className="progress-bar">
                        <input
                            type="range"
                            min="0"
                            max={duration || 1}
                            step="0.1"
                            value={currentTime}
                            onChange={handleSeek}
                        />
                    </div>

                    <div className="controls-row">
                        <div className="left-controls">
                            <button className="ctrl-btn" onClick={handlePlayPause}>
                                {isPlaying ? (
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
                                )}
                            </button>
                            <span className="time">{formatDuration(currentTime)} / {formatDuration(duration)}</span>

                            <div className="volume-control">
                                <button className="ctrl-btn" onClick={() => setMuted(!muted)}>
                                    {muted || volume === 0 ? (
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                                    ) : volume < 50 ? (
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" /></svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                                    )}
                                </button>
                                {volumeHovered && (
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={volume}
                                        onChange={(e) => { setVolume(e.target.value); handleVolumeChange(e); }}
                                        onMouseEnter={() => setVolumeHovered(true)}
                                        onMouseLeave={() => setVolumeHovered(false)}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="right-controls">
                            <div className="settings-menu">
                                <button className="ctrl-btn" onClick={() => { setShowSettings(!showSettings); setShowPlaybackSpeed(false); setShowQuality(false); }}>
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><circle cx="12" cy="12" r="3" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /></svg>
                                </button>
                                {showSettings && (
                                    <div className="menu-panel">
                                        <div className="menu-item" onClick={() => { setShowSettings(false); setShowPlaybackSpeed(true); }}>
                                            <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M4 18h17v-6H4v6zm7-13.25l10 6.5-10 6.5v-13zM20 7.75V12l-6 4v-8l6-4z" /></svg>
                                            Playback speed
                                        </div>
                                        <div className="menu-item" onClick={() => { setShowSettings(false); setShowQuality(true); }}>
                                            <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
                                            Quality
                                        </div>
                                    </div>
                                )}
                                {showPlaybackSpeed && (
                                    <div className="menu-panel speed-panel">
                                        <div className="menu-header" onClick={() => { setShowPlaybackSpeed(false); setShowSettings(true); }}>
                                            <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                                            Playback speed
                                        </div>
                                        {speeds.map((speed) => (
                                            <div key={speed} className={`menu-item ${playbackSpeed === speed ? "active" : ""}`} onClick={() => handleSpeedChange(speed)}>
                                                {speed === 1 ? "Normal" : speed + "x"}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {showQuality && (
                                    <div className="menu-panel quality-panel">
                                        <div className="menu-header" onClick={() => { setShowQuality(false); setShowSettings(true); }}>
                                            <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                                            Quality
                                        </div>
                                        <div key="auto" className={`menu-item ${activeIsAuto ? "active" : ""}`} onClick={selectAutoQuality}>
                                            Auto
                                        </div>
                                        {qualityOptions.map((opt) => {
                                            const height = opt.height;
                                            const label = opt.label || (height + "p");
                                            const isActive = isHls ? hlsActiveLevel === opt.index : selectedQuality === height;
                                            return (
                                                <div key={opt.index ?? height} className={`menu-item ${isActive ? "active" : ""}`} onClick={() => isHls ? selectHlsQuality(opt.index) : selectProgressiveQuality(height)}>
                                                    {label}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <button className="ctrl-btn" onClick={handleFullscreen}>
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;