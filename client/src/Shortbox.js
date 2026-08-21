import React, { useState, useEffect } from "react";
import "./Shortbox.css";
import { Link } from "react-router-dom";
import { streamApi } from "./api";
import Videoplayer from "./Videoplayer";

const defaultAvatar = "https://cdn-icons-png.flaticon.com/128/1077/1077063.png";

const Shortbox = (params) => {
    const [streamData, setStreamData] = useState(null);
    const [fetchFailed, setFetchFailed] = useState(false);
    const [mode, setMode] = useState(null);
    const [videoUrl, setVideoUrl] = useState("");
    const [audioUrl, setAudioUrl] = useState("");
    const [qualityoptions, setQualityoptions] = useState(["Auto"]);
    const [videoResolution, setVideoResolution] = useState(0);
    

    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + "M";
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + "K";
        } else {
            return num.toString();
        }
    }

    useEffect(() => {
        if (params.short) {
            const fetchstreamURL = async () => {
                try {
                    const response = await streamApi.getStream(params.short.video_id);
                    const data = response.data || response;
                    setStreamData(data);
                    setFetchFailed(data.extraction_ok === false);
                } catch (error) {
                    console.log("Error in fetching: ", error.message);
                    setFetchFailed(true);
                }
            };
            fetchstreamURL();
        }
    }, [params.short?.video_id]);

    useEffect(() => {
        if (!streamData || !streamData.video_id) return;

        const progressiveResolutions = streamData.progressive
            ? streamData.progressive.map((f) => f.resolution).filter(Boolean)
            : [];
        const adaptiveResolutions = streamData.adaptive?.video
            ? streamData.adaptive.video.map((f) => f.resolution).filter(Boolean)
            : [];

        // Include both progressive and adaptive for quality menu
        const allResolutions = [...new Set([...progressiveResolutions, ...adaptiveResolutions])].sort((a, b) => b - a);
        setQualityoptions(allResolutions.length > 0 ? allResolutions : ["Auto"]);

        if (streamData.hls_url) {
            setMode("hls");
            setVideoUrl(streamData.hls_url);
            setAudioUrl("");
            return;
        }

        // Prefer progressive (muxed video+audio) when available.
        if (streamData.progressive && streamData.progressive.length > 0) {
            setMode("progressive");
            setVideoUrl(streamData.progressive[0].url);
            setAudioUrl("");
            return;
        }

        // Fallback to adaptive only if no progressive
        if (streamData.adaptive && streamData.adaptive.video && streamData.adaptive.video.length > 0) {
            setMode("adaptive");
            setVideoUrl(streamData.adaptive.video[0].url);
            setAudioUrl(streamData.adaptive.audio?.[0]?.url || "");
            return;
        }

        setMode(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [streamData?.video_id]);

    const handleQualityChange = (resolution, newMode, videoUrl, audioUrl) => {
        if (resolution === 0) {
            const prog = streamData?.progressive || [];
            if (prog.length > 0) {
                setMode("progressive");
                setVideoUrl(prog[0].url);
                setAudioUrl("");
                setVideoResolution(0);
            }
            return;
        }

        const prog = streamData?.progressive || [];
        const adaptV = streamData?.adaptive?.video || [];
        const adaptA = streamData?.adaptive?.audio || [];

        const progressiveMatch = prog.find((f) => f.resolution === resolution);
        if (progressiveMatch) {
            setMode("progressive");
            setVideoUrl(progressiveMatch.url);
            setAudioUrl("");
            setVideoResolution(resolution);
            return;
        }

        const adaptiveMatch = adaptV.find((f) => f.resolution === resolution);
        if (adaptiveMatch) {
            setMode("adaptive");
            setVideoUrl(adaptiveMatch.url);
            setAudioUrl(adaptA[0]?.url || "");
            setVideoResolution(resolution);
            return;
        }

        if (newMode && videoUrl) {
            setMode(newMode);
            setVideoUrl(videoUrl);
            setAudioUrl(audioUrl || "");
            setVideoResolution(resolution);
        }
    };

    const short = params.short;

    return (
        <div className="shortsbox">
            <div className="short-video-wrapper">
                {fetchFailed ? (
                    <div className="youtube-container">
                        <iframe
                            className="youtube-player"
                            src={`https://www.youtube.com/embed/${short?.video_id}`}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                    </div>
                ) : (
                    <Videoplayer
                        mode={mode}
                        streamUrl={videoUrl}
                        audioUrl={audioUrl}
                        type="short"
                        muted={false}
                        onQualityChange={handleQualityChange}
                        qualityoptions={qualityoptions}
                        video_resolution={videoResolution}
                        thumbnail={short?.thumbnail_link}
                        streamData={streamData}
                    />
                )}
            </div>
            <div className="short-btns">
                <div className="shorts-btn">
                    <img
                        alt="short-btn"
                        title="Like"
                        src="https://cdn-icons-png.flaticon.com/128/739/739231.png"
                    />
                </div>
                <p>{short ? formatNumber(short.likes) : "Like"}</p>

                <div className="shorts-btn">
                    <img
                        alt="short-btn"
                        title="Dislike"
                        src="https://cdn-icons-png.flaticon.com/128/880/880613.png"
                    />
                </div>
                <p>Dislike</p>

                <div className="shorts-btn">
                    <img
                        alt="short-btn"
                        title="Comment"
                        src="https://cdn-icons-png.flaticon.com/128/12356/12356184.png"
                    />
                </div>
                <p>Comment</p>

                <div className="shorts-btn">
                    <img
                        alt="short-btn"
                        title="Share"
                        src="https://cdn-icons-png.flaticon.com/128/2958/2958791.png"
                    />
                </div>
                <p>Share</p>

                <div className="shorts-btn">
                    <img
                        alt="short-btn"
                        title="More"
                        src="https://cdn-icons-png.flaticon.com/128/10826/10826552.png"
                    />
                </div>
                <p>More</p>

                <Link
                    to={
                        short
                            ? `/channel?channel_id=${short.channel_id}`
                            : ""
                    }
                    className="profile-btn"
                >
                    {short ? (
                        <img
                            alt="short-btn"
                            title={short.channel_name}
                            src={short.channel_icon || defaultAvatar}
                            loading="lazy"
                            decoding="async"
                        />
                    ) : (
                        ""
                    )}
                </Link>
            </div>
        </div>
    );
};

export default Shortbox;