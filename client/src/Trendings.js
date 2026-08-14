import React, { useState, useEffect } from "react";
import Card from "./Card";
import { trendingApi } from "./api";
import { useLocation } from "react-router-dom";
import "./Trendings.css";
import CardGrid from "./CardGrid";
import Cardloading from "./Cardloading";
import InfiniteScroll from "./InfiniteScroll";

const Trendings = (params) => {
    const locationHook = useLocation();
    const [type, setType] = useState(0);
    const [data, setdata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [page_no, setpage_no] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(
        new URLSearchParams(locationHook.pathname)
    );
    const user = params.user;

    useEffect(() => {
        const currentpage = new URLSearchParams(locationHook.pathname);
        setPage(currentpage);
    }, [locationHook]);

    const mergeVideos = (videos) => {
        setdata((prev) => {
            if (prev === null) return { videos };
            const existingIds = new Set(prev.videos.map((v) => v.video_id));
            const fresh = videos.filter((v) => !existingIds.has(v.video_id));
            return fresh.length > 0
                ? { ...prev, videos: [...prev.videos, ...fresh] }
                : prev;
        });
        if (videos.length < 24) {
            setHasMore(false);
        }
    };

    useEffect(() => {
        setdata(null);
        setpage_no(1);
        setHasMore(true);
        setLoading(true);
    }, [type]);

    useEffect(() => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const fetchData = async () => {
            try {
                const response = await trendingApi.getTrendings(type, page_no);
                mergeVideos(response.videos || []);
            } catch (error) {
                console.log("Error fetching trendings:", error.message);
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        };
        fetchData();
    }, [type, user, page, page_no]);

    const loadMore = () => {
        if (loadingMore || !hasMore) return;
        setpage_no((prev) => prev + 1);
    };

    return (
        <>
            {loading ? (
                <Cardloading page="trendings" />
            ) : data && data.videos ? (
                <div className="trendingbox">
                    <div className="trend-heading">
                        <img
                            className="caticon"
                            src="https://cdn-icons-png.flaticon.com/128/1946/1946430.png"
                            alt="trending"
                            title="Trending"
                        />
                        <p className="trendheading">Trendings</p>
                    </div>
                    <div className="menus trend-menus">
                        <p
                            className={
                                "menubutton " + (type === 0 ? "active" : "")
                            }
                            onClick={() => {
                                setType(0);
                            }}
                        >
                            Now
                        </p>
                        <p
                            className={
                                "menubutton " + (type === 1 ? "active" : "")
                            }
                            onClick={() => {
                                setType(1);
                            }}
                        >
                            Music
                        </p>
                        <p
                            className={
                                "menubutton " + (type === 2 ? "active" : "")
                            }
                            onClick={() => {
                                setType(2);
                            }}
                        >
                            Gaming
                        </p>
                        <p
                            className={
                                "menubutton " + (type === 3 ? "active" : "")
                            }
                            onClick={() => {
                                setType(3);
                            }}
                        >
                            Movies
                        </p>
                    </div>
                    <div>
                        <hr className="line"></hr>
                    </div>
                    <CardGrid variant="trending" className="trendings">
                        {data.videos.map((item) => (
                            <Card
                                key={item.video_id}
                                data={item}
                                forTrending={true}
                            />
                        ))}
                        <InfiniteScroll
                            hasMore={hasMore}
                            loading={loadingMore}
                            onLoadMore={loadMore}
                        />
                    </CardGrid>
                </div>
            ) : (
                <></>
            )}
        </>
    );
};

export default Trendings;