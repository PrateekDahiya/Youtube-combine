import React, { useState, useEffect } from "react";
import Card from "./Card";
import { Link } from "react-router-dom";
import { subscriptionApi } from "./api";
import "./Subscription.css";
import CardGrid from "./CardGrid";
import Cardloading from "./Cardloading";
import InfiniteScroll from "./InfiniteScroll";

const defaultAvatar = "https://cdn-icons-png.flaticon.com/128/1077/1077063.png";

const Subscription = (params) => {
    const [videos, setVideos] = useState({ data: [] });
    const [channels, setChannels] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState("all");
    const [typeShort, setType] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page_no, setpage_no] = useState(1);
    const user = params.user;

    const mergeVideos = (newVideos) => {
        setVideos((prev) => {
            const existing = prev.data || [];
            const existingIds = new Set(existing.map((v) => v.video_id));
            const fresh = newVideos.filter((v) => !existingIds.has(v.video_id));
            return fresh.length > 0
                ? { ...prev, data: [...existing, ...fresh] }
                : prev;
        });
        if (newVideos.length < 24) {
            setHasMore(false);
        }
    };

    useEffect(() => {
        setVideos({ data: [] });
        setpage_no(1);
        setHasMore(true);
        setLoading(true);
    }, [typeShort]);

    useEffect(() => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const fetchData = async () => {
            try {
                const response = await subscriptionApi.getSubscriptionVideos(user.channel_id, typeShort, page_no);
                mergeVideos(response.data || []);
            } catch (error) {
                console.log("Error fetching subscription videos:", error.message);
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        };
        fetchData();
    }, [typeShort, page_no, user.channel_id, user]);

    useEffect(() => {
        const fetchChannels = async () => {
            try {
                const response = await subscriptionApi.getSubscriptions(user.channel_id);
                setChannels(response.subscription || []);
            } catch (error) {
                console.log("Error fetching subscriptions:", error.message);
            }
        };
        fetchChannels();
    }, [user.channel_id, user]);

    const filteredVideos =
        selectedChannel === "all"
            ? videos.data || []
            : (videos.data || []).filter(
                  (item) => item.channel_id === selectedChannel
              );

    const loadMore = () => {
        if (loadingMore || !hasMore) return;
        setpage_no((prev) => prev + 1);
    };

    return (
        <>
            {params.user !== "Guest" ? (
                loading ? (
                    <Cardloading page="subscription" />
                ) : (
                <div className="subsbox">
                    <h1>Subscriptions</h1>
                    <h3>Latest</h3>
                    {channels.length > 0 ? (
                        <div className="channel-strip">
                            <button
                                className={
                                    "channel-pill " +
                                    (selectedChannel === "all" ? "active" : "")
                                }
                                onClick={() => setSelectedChannel("all")}
                            >
                                All
                            </button>
                            {channels.map((item) => (
                                <button
                                    key={item.channel_id}
                                    className={
                                        "channel-pill " +
                                        (selectedChannel === item.channel_id
                                            ? "active"
                                            : "")
                                    }
                                    onClick={() =>
                                        setSelectedChannel(item.channel_id)
                                    }
                                >
                                    <img
                                        src={item.channel_icon || defaultAvatar}
                                        alt={item.channel_name}
                                    />
                                    <span>{item.channel_name}</span>
                                </button>
                            ))}
                        </div>
                    ) : null}
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
                    </div>
                    {filteredVideos.length > 0 ? (
                        <CardGrid variant="fluid">
                            {filteredVideos.map((item) => (
                                <Card key={item.video_id} data={item} />
                            ))}
                            <InfiniteScroll
                                hasMore={hasMore}
                                loading={loadingMore}
                                onLoadMore={loadMore}
                            />
                        </CardGrid>
                    ) : (
                        <></>
                    )}
                </div>
                )
            ) : (
                <div className="guestuser">
                    <img
                        className="bigicon"
                        src="https://cdn-icons-png.flaticon.com/128/2989/2989849.png"
                        alt="subscriptions"
                        title="Subscriptions"
                    />
                    <h2>Don't miss new videos</h2>
                    <h3>
                        Sign in to see updates from your favorite VidVault
                        channels
                    </h3>
                    <Link to="/login" style={{ textDecoration: "none" }}>
                        <button className="sign_in">
                            <img
                                className="guesticon"
                                title="Sign In"
                                src="https://cdn-icons-png.flaticon.com/128/1077/1077063.png"
                                alt="user"
                            />
                            Sign In
                        </button>
                    </Link>
                </div>
            )}
        </>
    );
};

export default Subscription;