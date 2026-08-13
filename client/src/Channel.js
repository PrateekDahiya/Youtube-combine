import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "./Channel.css";
import axios from "axios";
import Card from "./Card";
import Cardloading from "./Cardloading";
import InfiniteScroll from "./InfiniteScroll";

const defaultAvatar = "https://cdn-icons-png.flaticon.com/128/1077/1077063.png";

const Channel = (params) => {
    const locationHook = useLocation();
    const [data, setData] = useState("");
    const [videos, setVideos] = useState({ videos: [] });
    const [query, setQuery] = useState("");
    const [typeShort, setType] = useState(0);
    const [refresh, setrefresh] = useState(0);
    const [page_no, setpage_no] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [issubed, setissubed] = useState(false);
    const [user_chl_id, setUser_chl_id] = useState(null);
    const serverurl = process.env.REACT_APP_SERVER_URL;

    const [channel_id, setChannel_id] = useState(
        new URLSearchParams(locationHook.search).get("channel_id")
    );
    const user = params.user;

    const addSubscriber = async () => {
        const requestData = {
            user_chl_id,
            channel_id,
        };

        const response = await axios.post(
            `${serverurl}/addtosubs`,
            requestData
        );
        setissubed(true);
    };

    const unsub = async () => {
        const requestData = {
            user_chl_id,
            channel_id,
        };

        const response = await axios.post(
            `${serverurl}/removefromsubs`,
            requestData
        );

        setissubed(false);
    };

    useEffect(() => {
        const issubscribed = async () => {
            const response = await axios.get(
                `${serverurl}/issub?user_id=${user_chl_id}&channel_id=${channel_id}`
            );
            setissubed(response.data.sub);
        };
        issubscribed();
    }, [user_chl_id, channel_id]);

    useEffect(() => {
        const currentChannel = new URLSearchParams(locationHook.search).get(
            "channel_id"
        );
        setChannel_id(currentChannel);
    }, [locationHook]);

    useEffect(() => {
        const fetchData = async () => {
            await axios
                .get(`${serverurl}/channel?channel_id=${channel_id}`)
                .then((response) => {
                    setData(response.data.channel[0]);
                })
                .catch((error) => {
                    console.log("Error in fetching: ", error.message);
                });
        };
        fetchData();
    }, [typeShort, channel_id, user]);

    function refreshdata() {
        setrefresh(refresh + 1);
    }

    const mergeVideos = (newVideos) => {
        setVideos((prev) => {
            const existing = prev.videos || [];
            const existingIds = new Set(existing.map((v) => v.video_id));
            const fresh = newVideos.filter((v) => !existingIds.has(v.video_id));
            return fresh.length > 0
                ? { videos: [...existing, ...fresh] }
                : prev;
        });
        if (newVideos.length < 24) {
            setHasMore(false);
        }
    };

    useEffect(() => {
        setVideos({ videos: [] });
        setpage_no(1);
        setHasMore(true);
    }, [typeShort, refresh, channel_id]);

    useEffect(() => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const fetchVideos = async () => {
            await axios
                .get(
                    `${serverurl}/getvideosofchannel` +
                        "?channel_id=" +
                        channel_id +
                        "&type=" +
                        typeShort +
                        "&query=" +
                        query +
                        "&page=" +
                        page_no
                )
                .then((response) => {
                    mergeVideos(response.data.videos || []);
                })
                .catch((error) => {
                    console.log("Error in fetching: ", error.message);
                })
                .finally(() => {
                    setLoadingMore(false);
                });
        };
        fetchVideos();
    }, [typeShort, refresh, channel_id, page_no, user]);

    const loadMore = () => {
        if (loadingMore || !hasMore) return;
        setpage_no((prev) => prev + 1);
    };

    useEffect(() => {
        setUser_chl_id(user.channel_id);
    }, [user]);

    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + "M";
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + "K";
        } else {
            return num.toString();
        }
    }

    function getshortinfo(str) {
        if (str.length <= 50) {
            return str;
        }
        const lastSpaceIndex = str.substring(0, 65).lastIndexOf(" ");
        return str.substring(0, lastSpaceIndex);
    }

    function formatNumberWithCommas(number) {
        return number.toLocaleString();
    }

    function formatISODate(isoDate) {
        const date = new Date(isoDate);
        const options = { year: "numeric", month: "short", day: "numeric" };
        return date.toLocaleDateString("en-US", options);
    }

    function show_moredesc() {
        let x = document.querySelector(".moredesc");
        if (x.style.display === "none") {
            x.style.display = "block";
        } else {
            x.style.display = "none";
        }
    }
    function close_moredesc() {
        let x = document.querySelector(".moredesc");
        if (x.style.display === "block") {
            x.style.display = "none";
        } else {
            x.style.display = "block";
        }
    }

    return (
        <>
            {data && videos.videos ? (
                <div className="outer">
                    {data.channel_banner !== "N/A" ? (
                        <div className="banner">
                            <img
                                alt="channel_banner"
                                title="Channel Banner"
                                src={data.channel_banner}
                            />
                        </div>
                    ) : (
                        ""
                    )}

                    <div className="channelinfo">
                        <img
                            className="mypic"
                            title={data.channel_name}
                            alt="Profile"
                            src={data.channel_icon || defaultAvatar}
                        />
                        <div className="details">
                            <p className="name">{data.channel_name}</p>
                            <p className="id">
                                {data.custom_url}
                                {" • "}
                                {formatNumber(data.subscribers)}
                                {" subscribers • "}
                                {formatNumber(data.video_count)}
                                {" videos"}
                            </p>
                            <p
                                className="desc"
                                onClick={() => {
                                    show_moredesc();
                                }}
                            >
                                {getshortinfo(data.short_desc)}...
                                <b>more</b>
                            </p>
                            <div className="moredesc">
                                <p className="deschead">
                                    About
                                    <span
                                        className="close-btn"
                                        onClick={() => {
                                            close_moredesc();
                                        }}
                                    >
                                        X
                                    </span>
                                </p>
                                <p className="descdata">{data.short_desc}</p>
                                <p className="deschead">Channel details</p>
                                <p className="descdata">
                                    <img
                                        alt="datashow"
                                        src="https://cdn-icons-png.flaticon.com/128/900/900782.png"
                                    />
                                    /channel?channel_id=
                                    {data.channel_id}
                                </p>
                                <p className="descdata">
                                    <img
                                        alt="datashow"
                                        src="https://cdn-icons-png.flaticon.com/128/825/825636.png"
                                    />
                                    {formatNumber(data.subscribers)} subscribers
                                </p>
                                <p className="descdata">
                                    <img
                                        alt="datashow"
                                        src="https://cdn-icons-png.flaticon.com/128/1179/1179120.png"
                                    />
                                    {formatNumber(data.video_count)} videos
                                </p>
                                <p className="descdata">
                                    <img
                                        alt="datashow"
                                        src="https://cdn-icons-png.flaticon.com/128/3742/3742162.png"
                                    />
                                    {formatNumberWithCommas(data.total_views)}{" "}
                                    views
                                </p>
                                <p className="descdata">
                                    <img
                                        alt="datashow"
                                        src="https://cdn-icons-png.flaticon.com/128/2342/2342329.png"
                                    />
                                    Joined {formatISODate(data.date_created)}
                                </p>
                                <p className="descdata">
                                    <img
                                        alt="datashow"
                                        src="https://cdn-icons-png.flaticon.com/128/2838/2838912.png"
                                    />
                                    {data.location}
                                </p>
                            </div>
                            <div className="subbuttons">
                                <button
                                    className={
                                        issubed ? "subscribe ed" : "subscribe"
                                    }
                                    onClick={() => {
                                        issubed ? unsub() : addSubscriber();
                                    }}
                                >
                                    {issubed ? "Subscribed" : "Subscribe"}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="menus">
                        <p
                            className={
                                "menubutton " +
                                (typeShort === 0 ? "active" : "")
                            }
                            onClick={() => {
                                setType(0);
                            }}
                        >
                            Videos
                        </p>
                        <p
                            className={
                                "menubutton " +
                                (typeShort === 1 ? "active" : "")
                            }
                            onClick={() => {
                                setType(1);
                            }}
                        >
                            Shorts
                        </p>
                        <p className="menubutton">Search Channel</p>

                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search"
                            className="channelsearch"
                        />
                        <button
                            onClick={() => {
                                refreshdata();
                            }}
                            className="chlsearchbtn"
                        >
                            <img
                                alt="searchchannel"
                                title="Search Channel"
                                src="https://cdn-icons-png.flaticon.com/128/2811/2811806.png"
                            />
                        </button>
                    </div>
                    <div className="videos">
                        {videos.videos.map((item) => (
                            <Card key={item.video_id} data={item} />
                        ))}
                    </div>
                    <InfiniteScroll
                        hasMore={hasMore}
                        loading={loadingMore}
                        onLoadMore={loadMore}
                    />
                </div>
            ) : (
                <Cardloading page="channel" />
            )}
        </>
    );
};

export default Channel;
