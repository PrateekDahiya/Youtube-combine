import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./Watch.css";
import { videoApi, subscriptionApi, likeApi, historyApi, streamApi } from "./api";
import Videoplayer from "./Videoplayer";
import Card from "./Card";
import CardGrid from "./CardGrid";
import Cardloading from "./Cardloading";
import Comments from "./Comments";

const defaultAvatar = "https://cdn-icons-png.flaticon.com/128/1077/1077063.png";

const Watch = (params) => {
    
    const [isliked, setisliked] = useState(false);
    const [isdisliked, setIsdisliked] = useState(false);
    const [watchdata, setwatchdata] = useState({});
    const [relateddata, setRelateddata] = useState(null);
    const [show_desc, setshow_desc] = useState(false);
    const [fetchFailed, setFetchFailed] = useState(false);
    const [loading, setLoading] = useState(true);
    const user = params.user;
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
        if (!watchdata || !watchdata.video_id) return;
        if (watchdata.link && isUploadedLink(watchdata.link)) {
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

    // Picks the best available playback tier from the stream-resolver
    // Priority: HLS (adaptive quality) > progressive (single muxed) > adaptive (separate video+audio)
    // Always populate qualityoptions from all available formats for the quality menu.
useEffect(() => {
        if (isUploaded || !streamData || !streamData.video_id) return;

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

        // ALWAYS prefer progressive (muxed video+audio) when available.
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
            const chosenAudio = streamData.adaptive.audio && streamData.adaptive.audio[0];
            setVideo_url(chosenVideo.url);
            setAudio_url(chosenAudio ? chosenAudio.url : "");
            return;
        }

        setMode(null);
    }, [streamData, video_resolution, isUploaded]);

    const handleQualityChange = (option) => {
        setVideo_resolution(parseInt(option));
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
                                    style={{
                                        position: 'relative',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '75vh',
                                        maxHeight: 'vh',
                                        
                                    }}
                                    src={`https://www.youtube.com/embed/${watchdata.video_id}`}
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
                                handleQualityChange={handleQualityChange}
                                qualityoptions={qualityoptions}
                                video_resolution={video_resolution}
                                thumbnail={watchdata.thumbnail_link}
                                streamData={streamData}
                            />
                        )}
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
                                        src={watchdata.channel_icon || defaultAvatar}
                                        title="channel"
                                        alt="channel"
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
                                <button className="share_btn">
                                    <img
                                        src="https://cdn-icons-png.flaticon.com/128/2958/2958783.png"
                                        alt="share"
                                        title="Share"
                                    />
                                    Share
                                </button>
                                <button className="download_btn">
                                    <img
                                        src="https://cdn-icons-png.flaticon.com/128/9131/9131795.png"
                                        alt="download"
                                        title="Download"
                                    />
                                    Download
                                </button>
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
        </>
    );
};

export default Watch;