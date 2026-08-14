import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { watchlaterApi } from "./api";
import Cookies from "js-cookie";
import "./Card.css";

const defaultAvatar = "https://cdn-icons-png.flaticon.com/128/1077/1077063.png";

const Card = React.memo((params) => {
    const navigate = useNavigate();
    const [linkto, setLinkto] = useState();
    const [video_id, setVideo_id] = useState(null);
    const [user_chl_id, setUser_chl_id] = useState(null);
    const [user, setCrntuser] = useState("Guest");
    const [isHovered, setIsHovered] = useState(false);
    const [watchlater, setWatchlater] = useState(false);
    const [forTrending, setForTrending] = useState(false);
    const [forrelated, setForrelated] = useState(false);

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
        <Link
            to={linkto}
            className={`card ${
                forTrending || forrelated ? "trending-card" : ""
            }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {isHovered ? (
                <div
                    className={`watch-later ${isHovered ? "show" : ""}`}
                    onClick={(e) => {
                        e.preventDefault();
                        handleWatchlater();
                    }}
                >
                    {watchlater ? (
                        <img
                            alt="removeWatchlater"
                            title="Remove from Watch Later"
                            src="https://cdn-icons-png.flaticon.com/128/15641/15641363.png"
                        />
                    ) : (
                        <img
                            alt="addWatchlater"
                            title="Add to Watch Later"
                            src="https://cdn-icons-png.flaticon.com/128/15469/15469061.png"
                        />
                    )}
                </div>
            ) : (
                <></>
            )}
            {params.onEdit ? (
                <span
                    className="card-edit"
                    title="Edit video"
                    onClick={(e) => {
                        e.preventDefault();
                        params.onEdit(params.data);
                    }}
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="white"
                    >
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                    </svg>
                </span>
            ) : null}
            <img
                className={
                    forrelated ? "thumbnail forrelated-thumbnail" : "thumbnail"
                }
                title={params.data.channel_name}
                src={thumbnailSrc}
                alt={params.data.title || ""}
                loading="lazy"
                decoding="async"
            />
            {forTrending || forrelated ? null : (
                    <span className="duration">
                        {formatDuration(params.data.duration)}
                    </span>
                )}

                <div className="info">
                    {forrelated ? null : (
                        <img
                            src={params.data.channel_icon || defaultAvatar}
                            alt={params.data.channel_name || ""}
                            title={params.data.channel_name || ""}
                            loading="lazy"
                            decoding="async"
                            onClick={(e) => {
                                e.preventDefault();
                                handleChannelClick(e, params.data.channel_id);
                            }}
                        />
                    )}
                    <div className="text">
                        <p className="videotitle">
                            {params.data.title.length >= 100
                                ? params.data.title.substring(0, 50) + "..."
                                : params.data.title || ""}
                        </p>
                        <div
                            className="channelname"
                            onClick={(e) => {
                                e.preventDefault();
                                handleChannelClick(e, params.data.channel_id);
                            }}
                        >
                            {params.data.channel_name || ""}
                        </div>
                        <div className="viewsntime">
                            <p className="views">
                                {formatNumber(params.data.views)} views &bull;
                            </p>
                            <p className="time">
                                {getDateDifference(
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
    );
});

export default Card;