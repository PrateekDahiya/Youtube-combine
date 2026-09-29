import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { streamApi, watchlaterApi } from "./api";
import Cookies from "js-cookie";
import ShareDialog from "./ShareDialog";
import { useToast } from "./ToastContext";
import { useQueue } from "./QueueContext";
import { avatarFallback, thumbFallback, handleImgError } from "./imgFallback";
import "./Card.css";

const Card = React.memo((params) => {
    const navigate = useNavigate();
    const [linkto, setLinkto] = useState();
    const [video_id, setVideo_id] = useState(null);
    const [user_chl_id, setUser_chl_id] = useState(null);
    const [user, setCrntuser] = useState("Guest");
    const [watchlater, setWatchlater] = useState(false);
    const [forTrending, setForTrending] = useState(false);
    const [forrelated, setForrelated] = useState(false);
    const [showCardMenu, setShowCardMenu] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [statsWrapped, setStatsWrapped] = useState(false);
    const cardMenuRef = useRef(null);
    const metaRef = useRef(null);
    const channelRef = useRef(null);
    const statsRef = useRef(null);
    const { showToast } = useToast();
    const { enqueue } = useQueue();

    const getUserFromCookie = () => {
        const userCookie = Cookies.get("user");
        try {
            return userCookie ? JSON.parse(userCookie) : "Guest";
        } catch (error) {
            return "Guest";
        }
    };

    useEffect(() => {
        setCrntuser(getUserFromCookie());
    }, [Cookies.get("user")]);

    const addwatchlater = async () => {
        if (user === "Guest") return;
        await watchlaterApi.addToWatchlater(user_chl_id, video_id);
        setWatchlater(true);
    };

    const removewatchlater = async () => {
        if (user === "Guest") return;
        await watchlaterApi.removeFromWatchlater(user_chl_id, video_id);
        setWatchlater(false);
    };

    const handleWatchlater = useCallback(() => {
        if (watchlater === true) {
            removewatchlater();
        } else {
            addwatchlater();
        }
    }, [watchlater, user, user_chl_id, video_id]);

    useEffect(() => {
        const checkWrap = () => {
            if (channelRef.current && statsRef.current) {
                setStatsWrapped(statsRef.current.offsetTop > channelRef.current.offsetTop);
            }
        };
        checkWrap();
        const observer = new ResizeObserver(checkWrap);
        if (metaRef.current) observer.observe(metaRef.current);
        window.addEventListener("resize", checkWrap);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", checkWrap);
        };
    }, [params.data.video_id]);

    useEffect(() => {
        if (!showCardMenu) return;
        const handleClickOutside = (event) => {
            if (cardMenuRef.current && !cardMenuRef.current.contains(event.target)) {
                setShowCardMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showCardMenu]);

    const getShareUrl = () =>
        `${window.location.origin}/watch?video_id=${params.data.video_id}`;

    const handleDownload = async () => {
        setShowCardMenu(false);
        const link = params.data.link;
        if (link && (link.startsWith("/uploads/") || link.includes("res.cloudinary.com"))) {
            const a = document.createElement("a");
            a.href = link;
            a.download = "";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast("Download started");
            return;
        }
        setDownloading(true);
        try {
            const response = await streamApi.getStream(params.data.video_id);
            const stream = response.data || response;
            const progressive = (stream && stream.progressive) || [];
            if (progressive.length > 0 && progressive[0].url) {
                window.open(progressive[0].url, "_blank", "noopener");
                showToast("Opening video file in a new tab");
            } else {
                showToast("Download unavailable for this video", "error");
            }
        } catch (error) {
            console.log("Error fetching download stream:", error.message);
            showToast("Download unavailable for this video", "error");
        } finally {
            setDownloading(false);
        }
    };

    useEffect(() => {
        setVideo_id(params.data.video_id);
        setForTrending(params.forTrending || false);
        setForrelated(params.forrelated || false);
        setUser_chl_id(user.channel_id);
        setWatchlater(Boolean(params.data.is_watchlater));
    }, [params.data.video_id, user, params.forTrending, params.forrelated, params.data.is_watchlater]);

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

    const formatNumber = (num) => {
        if (!num) return "";

        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + "M";
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + "K";
        } else {
            return num.toString();
        }
    };

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

    const handleChannelClick = useCallback((e, channelId) => {
        navigate(`/channel?channel_id=${channelId}`);
    }, [navigate]);

    useEffect(() => {
        const setlink = async () => {
            setLinkto(
                ((await params.data.isShort) === 1
                    ? "/shorts?video_id="
                    : "/watch?video_id=") + params.data.video_id
            );
        };
        setlink();
    }, []);

    const thumbnailSrc = useMemo(() => {
        if (params.data.thumbnail_link) {
            return params.data.thumbnail_link.replace(
                /\/maxresdefault\.jpg$/,
                "/hqdefault.jpg"
            );
        }
        if (params.data.link && params.data.link.includes("res.cloudinary.com")) {
            return params.data.link.replace(/\.[a-zA-Z0-9]+$/, ".jpg");
        }
        return "";
    }, [params.data.thumbnail_link, params.data.link]);

    return (
        <>
        <Link
            to={linkto}
            className={`card ${
                forTrending || forrelated ? "trending-card" : ""
            }`}
        >
            <div
                className={
                    forrelated
                        ? "card-thumb forrelated-thumbnail"
                        : "card-thumb thumbnail"
                }
            >
                <button
                    className="card-menu-trigger"
                    title="More actions"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    aria-expanded={showCardMenu}
                    onClick={(e) => {
                        e.preventDefault();
                        setShowCardMenu((prev) => !prev);
                    }}
                >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                </button>
                {showCardMenu ? (
                    <div
                        className="card-menu"
                        role="menu"
                        ref={cardMenuRef}
                        onClick={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div
                            className="card-menu-item"
                            role="menuitem"
                            onClick={() => {
                                setShowCardMenu(false);
                                setShowShare(true);
                            }}
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" />
                            </svg>
                            <span>Share</span>
                        </div>
                        <div
                            className={`card-menu-item ${downloading ? "disabled" : ""}`}
                            role="menuitem"
                            onClick={() => {
                                if (!downloading) handleDownload();
                            }}
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                            </svg>
                            <span>{downloading ? "Preparing…" : "Download"}</span>
                        </div>
                        <div
                            className="card-menu-item"
                            role="menuitem"
                            onClick={() => {
                                setShowCardMenu(false);
                                handleWatchlater();
                            }}
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.6l4.2 2.5-.8 1.3L11 13.5V7h1.5v5.6z" />
                            </svg>
                            <span>{watchlater ? "Saved to Watch later" : "Save to Watch later"}</span>
                        </div>
                        <div
                            className="card-menu-item"
                            role="menuitem"
                            onClick={() => {
                                setShowCardMenu(false);
                                enqueue(params.data);
                                showToast("Added to queue");
                            }}
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                <path d="M4 6h12v2H4zm0 5h12v2H4zm0 5h7v2H4zM17 11l5 5-5 5v-3h-3v-4h3v-3z" />
                            </svg>
                            <span>Add to queue</span>
                        </div>
                        {params.onRemoveHistory ? (
                            <div
                                className="card-menu-item"
                                role="menuitem"
                                onClick={() => {
                                    setShowCardMenu(false);
                                    params.onRemoveHistory(params.data);
                                }}
                            >
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 1 1 7 7 7 7 0 0 1-4.93-2.03l-1.42 1.42A8.96 8.96 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                                </svg>
                                <span>Remove from history</span>
                            </div>
                        ) : null}
                        {params.onEdit ? (
                            <div
                                className="card-menu-item"
                                role="menuitem"
                                onClick={() => {
                                    setShowCardMenu(false);
                                    params.onEdit(params.data);
                                }}
                            >
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                </svg>
                                <span>Edit video</span>
                            </div>
                        ) : null}
                        {params.onDelete ? (
                            <div
                                className="card-menu-item card-menu-danger"
                                role="menuitem"
                                onClick={() => {
                                    setShowCardMenu(false);
                                    params.onDelete(params.data);
                                }}
                            >
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                    <path d="M6 7h12l-1 13.01A2 2 0 0 1 15.01 22H8.99a2 2 0 0 1-1.99-1.99L6 7zm3-3h6l1 2H8l1-2zM4 6h16v2H4V6z" />
                                </svg>
                                <span>Delete video</span>
                            </div>
                        ) : null}
                    </div>
                ) : null}
                <img
                    title={params.data.channel_name}
                    src={thumbnailSrc}
                    alt={params.data.title || ""}
                    loading="lazy"
                    decoding="async"
                    onError={handleImgError(thumbFallback)}
                />
                {forTrending || forrelated ? null : (
                    <span className="duration">
                        {formatDuration(params.data.duration)}
                    </span>
                )}
            </div>

                <div className="info">
                    {forrelated ? null : (
                        <img
                            src={params.data.channel_icon || avatarFallback()}
                            alt={params.data.channel_name || ""}
                            title={params.data.channel_name || ""}
                            loading="lazy"
                            decoding="async"
                            onError={handleImgError(avatarFallback)}
                            onClick={(e) => {
                                e.preventDefault();
                                handleChannelClick(e, params.data.channel_id);
                            }}
                        />
                    )}
                    <div className="text">
                        <p className="videotitle" title={params.data.title || ""}>
                            {params.data.title || ""}
                        </p>
                        <div className="card-meta" ref={metaRef}>
                            <div
                                className="channelname"
                                ref={channelRef}
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleChannelClick(e, params.data.channel_id);
                                }}
                            >
                                {params.data.channel_name || ""}
                            </div>
                            <p className="meta-stats" ref={statsRef}>
                                {statsWrapped ? null : <>&bull; </>}
                                {formatNumber(params.data.views)} views &bull; {getDateDifference(
                                    new Date(),
                                    new Date(params.data.upload_time)
                                ) + " ago"}
                            </p>
                        </div>
                        {forTrending ? (
                            <p className="short-desc-trend">
                                {params.data.short_desc.length >= 300
                                    ? params.data.short_desc.substring(0, 200) +
                                      "..."
                                    : params.data.short_desc || ""}
                            </p>
                        ) : null}
                    </div>
                </div>
        </Link>
        <ShareDialog
            isOpen={showShare}
            onClose={() => setShowShare(false)}
            url={getShareUrl()}
            title={params.data.title}
            onCopied={(ok) => {
                if (ok) {
                    showToast("Link copied to clipboard");
                    setShowShare(false);
                } else {
                    showToast("Copy failed — select the link manually", "error");
                }
            }}
        />
        </>
    );
});

export default Card;