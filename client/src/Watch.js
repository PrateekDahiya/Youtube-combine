import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./Watch.css";
import { videoApi, subscriptionApi, likeApi, historyApi, streamApi, authApi, pickAdaptiveAudio } from "./api";
import Videoplayer from "./Videoplayer";
import { avatarFallback, handleImgError } from "./imgFallback";
import Card from "./Card";
import CardGrid from "./CardGrid";
import Cardloading from "./Cardloading";
import Comments from "./Comments";
import Modal from "./Modal";
import ShareDialog from "./ShareDialog";
import { useToast } from "./ToastContext";
import { useQueue } from "./QueueContext";

const Watch = (params) => {
    
    const [isliked, setisliked] = useState(false);
    const [isdisliked, setIsdisliked] = useState(false);
    const [watchdata, setwatchdata] = useState({});
    const [relateddata, setRelateddata] = useState(null);
    const [show_desc, setshow_desc] = useState(false);
    const [fetchFailed, setFetchFailed] = useState(false);
    const [loading, setLoading] = useState(true);
    const user = params.user;
    const { showToast } = useToast();
    const { queue, peekNextIndex, advance } = useQueue();
    const [showShare, setShowShare] = useState(false);
    const [showNoDownload, setShowNoDownload] = useState(false);
    const [issubed, setissubed] = useState(false);
    const [channel_id, setChannel_id] = useState(null);
    const [video_id, setVideo_id] = useState(null);
    const [user_chl_id, setUser_chl_id] = useState(null);
    const [video_resolution, setVideo_resolution] = useState(0);
    const [qualityoptions, setQualityoptions] = useState(["Auto"]);
    const [video_url, setVideo_url] = useState("");
    const [audio_url, setAudio_url] = useState("");
    const [isUploaded, setIsUploaded] = useState(false);
    const [mode, setMode] = useState(null);
    const [streamData, setStreamData] = useState(null);
    const [localManifest, setLocalManifest] = useState(null);
    const [addingLocal, setAddingLocal] = useState(false);
    const [autoplay, setAutoplay] = useState(() => {
        if (user && user !== "Guest" && user.autoplay !== undefined && user.autoplay !== null) {
            return Number(user.autoplay) === 1;
        }
        return localStorage.getItem("autoplay") !== "0";
    });

    const isUploadedLink = (link) =>
        !!link &&
        (link.startsWith("/uploads/") || link.includes("res.cloudinary.com"));

    function formatNumber(num) {
        if (num === undefined || num === null) return "0";
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + "M";
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + "K";
        } else {
            return num.toString();
        }
    }

    function formatISODate(isoDate) {
        const date = new Date(isoDate);
        const options = { year: "numeric", month: "short", day: "numeric" };
        return date.toLocaleDateString("en-US", options);
    }

    const getDateDifference = (date1, date2) => {
        if (!date1 || !date2) return "";

        const differenceMs = Math.abs(date1 - date2);

        const millisecondsInSecond = 1000;
        const millisecondsInMinute = millisecondsInSecond * 60;
        const millisecondsInHour = millisecondsInMinute * 60;
        const millisecondsInDay = millisecondsInHour * 24;
        const millisecondsInWeek = millisecondsInDay * 7;
        const millisecondsInMonth = millisecondsInDay * 30;
        const millisecondsInYear = millisecondsInDay * 365;

        const years = Math.floor(differenceMs / millisecondsInYear);
        const months = Math.floor(differenceMs / millisecondsInMonth);
        const weeks = Math.floor(differenceMs / millisecondsInWeek);
        const days = Math.floor(differenceMs / millisecondsInDay);
        const hours = Math.floor(differenceMs / millisecondsInHour);
        const minutes = Math.floor(differenceMs / millisecondsInMinute);
        const seconds = Math.floor(differenceMs / millisecondsInSecond);

        let result = "";
        if (years > 0) {
            result += years + (years === 1 ? " year" : " years");
        } else if (months > 0) {
            result += months + (months === 1 ? " month" : " months");
        } else if (weeks > 0) {
            result += weeks + (weeks === 1 ? " week" : " weeks");
        } else if (days > 0) {
            result += days + (days === 1 ? " day" : " days");
        } else if (hours > 0) {
            result += hours + (hours === 1 ? " hour" : " hours");
        } else if (minutes > 0) {
            result += minutes + (minutes === 1 ? " minute" : " minutes");
        } else if (seconds > 0) {
            result += seconds + (seconds === 1 ? " second" : " seconds");
        }

        return result;
    };

    const addSubscriber = async () => {
        if (user === "Guest") return;
        await subscriptionApi.addSubscription(user_chl_id, channel_id);
        setissubed(true);
    };

    const unsub = async () => {
        if (user === "Guest") return;
        await subscriptionApi.removeSubscription(user_chl_id, channel_id);
        setissubed(false);
    };

    const addlike = async () => {
        if (user === "Guest") return;
        await likeApi.addLike(user_chl_id, video_id);
        setisliked(true);
    };

    const removelike = async () => {
        if (user === "Guest") return;
        await likeApi.removeLike(user_chl_id, video_id);
        setisliked(false);
    };

    const historyAddedRef = useRef(null);

    useEffect(() => {
        if (user === "Guest" || !video_id) return;
        if (historyAddedRef.current === video_id) return;
        historyAddedRef.current = video_id;
        historyApi.addToHistory(user_chl_id, video_id);
    }, [video_id, user, user_chl_id]);

    useEffect(() => {
        const checkSubAndLike = async () => {
            if (!user_chl_id || !channel_id) return;
            try {
                const [subRes, likeRes] = await Promise.all([
                    subscriptionApi.isSubscribed(user_chl_id, channel_id),
                    likeApi.isLiked(user_chl_id, video_id),
                ]);
                setissubed(subRes.sub);
                setisliked(likeRes.liked);
            } catch (error) {
                console.log("Error checking sub/like:", error.message);
            }
        };
        checkSubAndLike();
    }, [user_chl_id, channel_id, video_id]);

    useEffect(() => {
        const fetchRelated = async () => {
            if (!video_id) return;
            try {
                const response = await videoApi.getRelatedVideos(video_id, user.channel_id);
                setRelateddata(response);
            } catch (error) {
                console.log("Error fetching related videos:", error.message);
            }
        };
        fetchRelated();
    }, [video_id]);

    useEffect(() => {
        let cancelled = false;
        const fetchLocalList = async () => {
            try {
                const response = await streamApi.getLocalList();
                if (!cancelled) {
                    setLocalManifest(response.data || response || {});
                }
            } catch (error) {
                console.log("Error fetching local media list:", error.message);
                if (!cancelled) {
                    setLocalManifest({});
                }
            }
        };
        fetchLocalList();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!watchdata || !watchdata.video_id) return;
        if (watchdata.link && isUploadedLink(watchdata.link)) {
            return;
        }
        if (localManifest && localManifest[watchdata.video_id]) {
            return;
        }
        let cancelled = false;
        const fetchstreamURL = async () => {
            try {
                const response = await streamApi.getStream(watchdata.video_id);
                if (!cancelled) {
                    setStreamData(response.data || response);
                    setFetchFailed((response.data?.extraction_ok ?? response.extraction_ok) === false);
                }
            } catch (error) {
                console.log("Error fetching stream URL:", error.message);
                if (!cancelled) {
                    setFetchFailed(true);
                }
            }
        };
        fetchstreamURL();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchdata]);

    useEffect(() => {
        const fetchwatchdata = async () => {
            try {
                const searchParams = new URLSearchParams(window.location.search);
                const response = await videoApi.getWatch(Object.fromEntries(searchParams).video_id);
                const row = response.data[0];
                setwatchdata(row || {});
                if (row && row.link && isUploadedLink(row.link)) {
                    setIsUploaded(true);
                    setMode("progressive");
                    setVideo_url(row.link);
                    setAudio_url("");
                    setFetchFailed(false);
                }
            } catch (error) {
                console.log("Error fetching watch data:", error.message);
            } finally {
                setLoading(false);
            }
        };
        fetchwatchdata();
    }, []);

    useEffect(() => {
        if (user) setUser_chl_id(user.channel_id);
        if (watchdata) {
            setChannel_id(watchdata.channel_id);
            setVideo_id(watchdata.video_id);
        }
    }, [user, watchdata]);

    useEffect(() => {
        if (user && user !== "Guest" && user.autoplay !== undefined && user.autoplay !== null) {
            setAutoplay(Number(user.autoplay) === 1);
        }
    }, [user]);

    const toggleAutoplay = async () => {
        const next = !autoplay;
        setAutoplay(next);
        if (user && user !== "Guest") {
            try {
                await authApi.updateUserDetail("autoplay", next ? 1 : 0, user.user_id);
                if (params.setUser) {
                    params.setUser({ ...user, autoplay: next ? 1 : 0 });
                }
            } catch (error) {
                console.log("Error saving autoplay:", error.message);
            }
        } else {
            localStorage.setItem("autoplay", next ? "1" : "0");
        }
    };

    const queuePlayUrl = (video) =>
        video.isShort ? `/shorts?video_id=${video.video_id}` : `/watch?video_id=${video.video_id}`;

    const handleEnded = () => {
        const queueIndex = peekNextIndex();
        if (queueIndex !== -1 && queue[queueIndex]) {
            const nextVideo = queue[queueIndex];
            advance();
            if (nextVideo.video_id === video_id) {
                window.location.reload();
            } else {
                window.location.href = queuePlayUrl(nextVideo);
            }
            return;
        }
        if (!autoplay) return;
        const list = (relateddata && relateddata.videos) || [];
        const next = list.find((v) => v.video_id !== video_id);
        if (next) {
            window.location.href = `/watch?video_id=${next.video_id}`;
        }
    };

    const handleStreamError = () => {
        setFetchFailed(true);
    };

    const getShareUrl = () => window.location.href;

    const copyShareUrl = async () => {
        try {
            await navigator.clipboard.writeText(getShareUrl());
            showToast("Link copied to clipboard");
            setShowShare(false);
        } catch (error) {
            console.log("Error copying link:", error.message);
            showToast("Copy failed — select the link manually", "error");
        }
    };

    const handleAddLocal = async () => {
        if (!video_id || addingLocal) return;
        if (localManifest && localManifest[video_id]) {
            showToast("Already in the local media list");
            return;
        }
        setAddingLocal(true);
        try {
            const response = await streamApi.addLocalVideo(video_id);
            const data = response.data || response;
            const qualities = (data && data.qualities) || [];
            if (qualities.length > 0) {
                const fresh = { ...(localManifest || {}) };
                fresh[video_id] = { qualities };
                setLocalManifest(fresh);
                setMode("local");
                setQualityoptions(qualities.map((q) => q.label));
                setVideo_url(qualities[0].url);
                setAudio_url("");
                setFetchFailed(false);
                showToast("Added to local media — now playing self-hosted");
            } else {
                showToast("Could not add this video", "error");
            }
        } catch (error) {
            console.log("Error adding local video:", error.message);
            showToast("Could not add this video", "error");
        } finally {
            setAddingLocal(false);
        }
    };

    const handleDownload = () => {
        if (mode === "local" && video_url) {
            const a = document.createElement("a");
            a.href = video_url;
            a.download = "";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast("Download started");
            return;
        }
        if (isUploaded && watchdata.link) {
            const a = document.createElement("a");
            a.href = watchdata.link;
            a.download = "";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast("Download started");
            return;
        }
        const progressive = (streamData && streamData.progressive) || [];
        if (progressive.length > 0 && progressive[0].url) {
            window.open(progressive[0].url, "_blank", "noopener");
            showToast("Opening video file in a new tab");
            return;
        }
        setShowNoDownload(true);
    };

    const ytIframeRef = useRef(null);
    const ytPlayerRef = useRef(null);
    const handleEndedRef = useRef(null);

    useEffect(() => {
        handleEndedRef.current = handleEnded;
    });

    useEffect(() => {
        const showIframe = !isUploaded && fetchFailed && watchdata && watchdata.video_id;
        if (!showIframe) return;
        let cancelled = false;
        let player = null;
        let timer = null;
        const destroyPlayer = () => {
            if (timer) clearInterval(timer);
            if (player && player.destroy) {
                try {
                    player.destroy();
                } catch (e) {
                    console.log("Error destroying YT player:", e.message);
                }
            }
            ytPlayerRef.current = null;
        };
        const initPlayer = () => {
            if (cancelled) return;
            const iframe = ytIframeRef.current;
            if (!iframe || !window.YT || !window.YT.Player) return;
            player = new window.YT.Player(iframe, {
                events: {
                    onStateChange: (event) => {
                        if (event.data === window.YT.PlayerState.ENDED) {
                            if (handleEndedRef.current) handleEndedRef.current();
                        }
                    },
                },
            });
            ytPlayerRef.current = player;
        };
        if (window.YT && window.YT.Player) {
            initPlayer();
        } else {
            if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
                const tag = document.createElement("script");
                tag.src = "https://www.youtube.com/iframe_api";
                document.body.appendChild(tag);
                window.onYouTubeIframeAPIReady = () => {
                    initPlayer();
                };
            } else {
                timer = setInterval(() => {
                    if (window.YT && window.YT.Player) {
                        clearInterval(timer);
                        timer = null;
                        initPlayer();
                    }
                }, 500);
            }
        }
        return () => {
            cancelled = true;
            destroyPlayer();
        };
    }, [fetchFailed, isUploaded, video_id]);

// Initial setup: self-hosted file first, then the best available
// playback tier from streamData. Runs on fresh loads, NOT on
// user-triggered quality changes.
    useEffect(() => {
        if (isUploaded || !localManifest) return;
        const localEntry = video_id && localManifest[video_id];
        if (localEntry && localEntry.qualities && localEntry.qualities.length > 0) {
            setMode("local");
            setQualityoptions(localEntry.qualities.map((q) => q.label));
            setVideo_url(localEntry.qualities[0].url);
            setAudio_url("");
            setFetchFailed(false);
            return;
        }
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
            setVideo_url(streamData.hls_url);
            setAudio_url("");
            return;
        }

        // Prefer progressive (muxed video+audio) when available.
        if (streamData.progressive && streamData.progressive.length > 0) {
            setMode("progressive");
            const match = streamData.progressive.find((f) => f.resolution === video_resolution);
            const chosen = match || streamData.progressive[0];
            setVideo_url(chosen.url);
            setAudio_url("");
            return;
        }

        // Fallback to adaptive only if no progressive
        if (streamData.adaptive && streamData.adaptive.video && streamData.adaptive.video.length > 0) {
            setMode("adaptive");
            const match = streamData.adaptive.video.find((f) => f.resolution === video_resolution);
            const chosenVideo = match || streamData.adaptive.video[0];
            const chosenAudio = pickAdaptiveAudio(streamData.adaptive.audio);
            setVideo_url(chosenVideo.url);
            setAudio_url(chosenAudio ? chosenAudio.url : "");
            return;
        }

        setMode(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [streamData?.video_id, isUploaded, localManifest, video_id]);

    const handleQualityChange = (resolution, newMode, videoUrl, audioUrl) => {
        if (resolution === 0) {
            if (mode === "local") {
                const localEntry = video_id && localManifest && localManifest[video_id];
                const best = localEntry && localEntry.qualities && localEntry.qualities[0];
                if (best) {
                    setVideo_url(best.url);
                    setAudio_url("");
                    setVideo_resolution(0);
                }
                return;
            }
            // Auto - reset to default progressive
            const prog = streamData?.progressive || [];
            if (prog.length > 0) {
                setMode("progressive");
                setVideo_url(prog[0].url);
                setAudio_url("");
                setVideo_resolution(0);
            }
            return;
        }

        if (newMode === "local") {
            const localEntry = video_id && localManifest && localManifest[video_id];
            const match = localEntry && (localEntry.qualities || []).find((q) => q.label === resolution);
            if (match) {
                setVideo_url(match.url);
                setAudio_url("");
                setVideo_resolution(0);
            }
            return;
        }

        // User selected a specific resolution - use adaptive (video+audio separate)
        // if it has the resolution, otherwise progressive.
        const prog = streamData?.progressive || [];
        const adaptV = streamData?.adaptive?.video || [];
        const adaptA = streamData?.adaptive?.audio || [];

        const progressiveMatch = prog.find((f) => f.resolution === resolution);
        if (progressiveMatch) {
            setMode("progressive");
            setVideo_url(progressiveMatch.url);
            setAudio_url("");
            setVideo_resolution(resolution);
            return;
        }

        const adaptiveMatch = adaptV.find((f) => f.resolution === resolution);
        if (adaptiveMatch) {
            const audioMatch = pickAdaptiveAudio(adaptA);
            setMode("adaptive");
            setVideo_url(adaptiveMatch.url);
            setAudio_url(audioMatch ? audioMatch.url : "");
            setVideo_resolution(resolution);
            return;
        }

        // Fallback to whatever the caller provided
        if (newMode && videoUrl) {
            setMode(newMode);
            setVideo_url(videoUrl);
            setAudio_url(audioUrl || "");
            setVideo_resolution(resolution);
        }
    };

    return loading ? (
        <Cardloading page="watch" />
    ) : (
        <>
            <div className="watchpage">
                <div className="vplayer">
                    <div className="video-player">
                        {(!isUploaded && fetchFailed) ? (
                            <div style={{
                                position: 'relative',
                                width: '100%',
                            }}>
                                <iframe
                                    ref={ytIframeRef}
                                    style={{
                                        position: 'relative',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '75vh',
                                        maxHeight: 'vh',

                                    }}
                                    src={`https://www.youtube.com/embed/${watchdata.video_id}?enablejsapi=1`}
                                    title="YouTube video player"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            </div>
                        ) : (
                            <Videoplayer
                                mode={mode}
                                streamUrl={video_url}
                                audioUrl={audio_url}
                                type="video"
                                muted={false}
                                onQualityChange={handleQualityChange}
                                qualityoptions={qualityoptions}
                                video_resolution={video_resolution}
                                thumbnail={watchdata.thumbnail_link}
                                streamData={streamData}
                                onEnded={handleEnded}
                                onStreamError={handleStreamError}
                            />
                        )}
                        <div className="autoplay-row">
                            <span className="autoplay-label">Autoplay</span>
                            <button
                                className={"autoplay-toggle" + (autoplay ? " on" : "")}
                                onClick={toggleAutoplay}
                                aria-pressed={autoplay}
                                title={autoplay ? "Autoplay is on" : "Autoplay is off"}
                            >
                                <span className="autoplay-knob" />
                            </button>
                        </div>
                    </div>

                    <div className="video_info">
                        <p className="title">{watchdata.title}</p>
                        <div className="box">
                            <div className="boxpart1">
                                <Link
                                    to={`/channel?channel_id=${watchdata.channel_id}`}
                                >
                                    <img
                                        className="channelicon"
                                        src={watchdata.channel_icon || avatarFallback()}
                                        title="channel"
                                        alt="channel"
                                        onError={handleImgError(avatarFallback)}
                                    />
                                </Link>

                                <div className="namensubs">
                                    <p>
                                        <Link
                                            to={`/channel?channel_id=${watchdata.channel_id}`}
                                            style={{
                                                textDecoration: "none",
                                            }}
                                        >
                                            <b>{watchdata.channel_name}</b>
                                        </Link>
                                        <br></br>
                                        {formatNumber(
                                            watchdata.subscribers
                                        )}{" "}
                                        subscribers
                                    </p>
                                    <p></p>
                                </div>
                                <button
                                    className={
                                        issubed
                                            ? "subscribe ed"
                                            : "subscribe"
                                    }
                                    onClick={() => {
                                        issubed ? unsub() : addSubscriber();
                                    }}
                                >
                                    {issubed ? "Subscribed" : "Subscribe"}
                                </button>
                            </div>
                            <div className="boxpart2">
                                <button
                                    className="like_btn"
                                    onClick={() => {
                                        if (isliked) {
                                            removelike();
                                        } else {
                                            addlike();
                                            if (isdisliked) {
                                                setIsdisliked(false);
                                            }
                                        }
                                    }}
                                >
                                    {isliked ? (
                                        <img
                                            src="https://cdn-icons-png.flaticon.com/128/739/739231.png"
                                            alt="liked"
                                            title="Liked"
                                        />
                                    ) : (
                                        <img
                                            src="https://cdn-icons-png.flaticon.com/128/126/126473.png"
                                            alt="like"
                                            title="Like"
                                        />
                                    )}
                                    {formatNumber(watchdata.likes)}
                                </button>
                                <button
                                    className="dislike_btn"
                                    onClick={() => {
                                        if (isdisliked) {
                                            setIsdisliked(false);
                                        } else {
                                            setIsdisliked(true);
                                            if (isliked) {
                                                removelike();
                                            }
                                        }
                                    }}
                                >
                                    {isdisliked ? (
                                        <img
                                            src="https://cdn-icons-png.flaticon.com/128/880/880613.png"
                                            alt="disliked"
                                            title="Disliked"
                                        />
                                    ) : (
                                        <img
                                            src="https://cdn-icons-png.flaticon.com/128/126/126504.png"
                                            alt="dislike"
                                            title="Dislike"
                                        />
                                    )}
                                </button>
                                <button className="share_btn" onClick={() => setShowShare(true)}>
                                    <img
                                        src="https://cdn-icons-png.flaticon.com/128/2958/2958783.png"
                                        alt="share"
                                        title="Share"
                                    />
                                    Share
                                </button>
                                <button className="download_btn" onClick={handleDownload}>
                                    <img
                                        src="https://cdn-icons-png.flaticon.com/128/9131/9131795.png"
                                        alt="download"
                                        title="Download"
                                    />
                                    Download
                                </button>
                                {localManifest && video_id && !localManifest[video_id] && !isUploaded ? (
                                    <button
                                        className="download_btn"
                                        onClick={handleAddLocal}
                                        disabled={addingLocal}
                                        title="Save to self-hosted media list"
                                    >
                                        {addingLocal ? "Saving…" : "Save locally"}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    <div
                        className="video_details"
                        onClick={() => {
                            if (!show_desc) {
                                setshow_desc(true);
                            }
                        }}
                    >
                        <p className="video_views_upload_time">
                            {formatNumber(watchdata.views)} views •{" "}
                            {show_desc
                                ? formatISODate(watchdata.upload_time)
                                : getDateDifference(
                                    new Date(),
                                    new Date(watchdata.upload_time)
                                ) + " ago"}
                        </p>

                        {show_desc ? null : (
                            <>
                                <p className="video-desc">
                                    {watchdata.video_description ?
                                        watchdata.video_description.substring(0, 100) + "..."
                                        : "No description available"}
                                </p>
                                <p className="more-btn">...more</p>
                            </>
                        )}
                        {show_desc ? (
                            <>
                                <p className="video_desc">
                                    {watchdata.video_description || "No description available"}
                                </p>
                                <p
                                    className="more-btn"
                                    onClick={() => {
                                        setshow_desc(false);
                                    }}
                                >
                                    Show less
                                </p>
                            </>
                        ) : null}
                    </div>
                    {video_id ? <Comments videoId={video_id} user={user} /> : null}
                </div>
                {relateddata && relateddata.videos && relateddata.videos.length > 0 && (
                    <div className="relatedvideos">
                        <h2>Related videos</h2>
                        <CardGrid variant="watch" className="related-videos">
                            {relateddata.videos.map((item) => (
                                <Card
                                    key={item.video_id}
                                    data={item}
                                    forrelated={true}
                                />
                            ))}
                        </CardGrid>
                    </div>
                )}
            </div>
            <ShareDialog
                isOpen={showShare}
                onClose={() => setShowShare(false)}
                url={getShareUrl()}
                title={watchdata.title}
                onCopied={(ok) => {
                    if (ok) {
                        showToast("Link copied to clipboard");
                        setShowShare(false);
                    } else {
                        showToast("Copy failed — select the link manually", "error");
                    }
                }}
            />
            <Modal
                isOpen={showNoDownload}
                onClose={() => setShowNoDownload(false)}
                title="Download unavailable"
                size="small"
            >
                <p>This video can't be downloaded. You can watch it here or open it on YouTube instead.</p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "12px" }}>
                    <button className="subscribe" onClick={copyShareUrl}>
                        Copy link
                    </button>
                    <a
                        className="subscribe ed"
                        href={`https://www.youtube.com/watch?v=${video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "none" }}
                    >
                        Open on YouTube
                    </a>
                </div>
            </Modal>
        </>
    );
};

export default Watch;