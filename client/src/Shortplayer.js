import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import "./Shortplayer.css";

const Shortplayer = (params) => {
    const [shortlink, setShortlink] = useState(null);
    const [active, setActive] = useState(true);
    const [isInteracted, setIsInteracted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchFailed, setFetchFailed] = useState(false);
    const videoRef = useRef(null);
    const hlsRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;
        if (active === false) {
            video?.pause();
        }
        if (isInteracted) {
            if (active === true) {
                video?.play().catch((error) => {
                    console.error("Error playing video:", error);
                    setFetchFailed(true);
                });
            }
        }
    }, [active, shortlink]);

    useEffect(() => {
        setShortlink(params.streamUrl);
        setActive(params.active);
        setIsLoading(true);
        if (!params.streamUrl) {
            setFetchFailed(true);
        } else {
            setFetchFailed(false);
        }
    }, [params.streamUrl, params.active]);

    const handleInteraction = () => {
        setIsInteracted(true);
    };

    const handleVideoLoad = () => {
        setIsLoading(false);
    };

    const handleVideoError = () => {
        console.error("Video failed to load");
        setFetchFailed(true);
    };

    const isHls = params.mode === "hls";

    useEffect(() => {
        if (!isHls || !shortlink) return;
        const video = videoRef.current;
        if (!video) return;

        let hls = null;
        if (Hls.isSupported()) {
            hls = new Hls();
            hlsRef.current = hls;
            hls.loadSource(shortlink);
            hls.attachMedia(video);
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = shortlink;
        }

        return () => {
            if (hls) hls.destroy();
            hlsRef.current = null;
        };
    }, [isHls, shortlink]);

    return (
        <div
            className={`short-player-container ${isLoading ? 'loading' : ''}`}
            onMouseDown={handleInteraction}
        >
            {fetchFailed ? (
                <div className="youtube-container">
                    <iframe
                        className="youtube-player"
                        src={`https://www.youtube.com/embed/${params.videoId}`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>
            ) : (
                <video
                    ref={videoRef}
                    className="short"
                    src={isHls ? undefined : (shortlink ? shortlink : null)}
                    autoPlay
                    controls
                    muted={false}
                    loop={true}
                    preload="auto"
                    onLoadedData={handleVideoLoad}
                    onError={handleVideoError}
                    playsInline
                />
            )}
        </div>
    );
};

export default Shortplayer;
