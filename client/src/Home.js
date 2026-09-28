import { useEffect, useRef, useState } from "react";
import Card from "./Card";
import { feedApi } from "./api";
import "./Home.css";
import Cardloading from "./Cardloading";
import CardGrid from "./CardGrid";
import InfiniteScroll from "./InfiniteScroll";

const Home = (params) => {
    const [data, setData] = useState(null);
    const [topTags, setTopTags] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);
    const [selectedTypes, setSelectedTypes] = useState([]);
    const [newForYou, setNewForYou] = useState(false);
    const [page_no, setpage_no] = useState(1);
    const cursorRef = useRef(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const user = params.user;
    const videoTypes = ["Music", "Gaming", "Movies", "News", "Sports"];

    const toggleInList = (list, value) =>
        list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

    const toggleTag = (tag) => {
        setSelectedTags((prev) => toggleInList(prev, tag));
        setNewForYou(false);
    };

    const toggleType = (type) => {
        setSelectedTypes((prev) => toggleInList(prev, type));
        setNewForYou(false);
    };

    const clearFilters = () => {
        setSelectedTags([]);
        setSelectedTypes([]);
    };

    const hasFilters = selectedTags.length > 0 || selectedTypes.length > 0;

    const mergeVideos = (videos, nextCursor) => {
        setData((prev) => {
            if (prev === null) return videos;
            const existingIds = new Set(prev.map((v) => v.video_id));
            const fresh = videos.filter((v) => !existingIds.has(v.video_id));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
        if (typeof nextCursor === "string") {
            cursorRef.current = nextCursor;
        } else if (nextCursor === null) {
            setHasMore(false);
            cursorRef.current = null;
        } else if (videos.length < 24) {
            setHasMore(false);
            cursorRef.current = null;
        }
    };

    useEffect(() => {
        setData(null);
        setpage_no(1);
        cursorRef.current = null;
        setHasMore(true);
    }, [selectedTags, selectedTypes, newForYou]);

    useEffect(() => {
        const fetchHomeTags = async () => {
            if (user === "Guest" || !user.channel_id) {
                setTopTags([]);
                return;
            }

            try {
                const response = await feedApi.getHomeTags(user.channel_id);
                setTopTags(response.tags || []);
            } catch (error) {
                console.log("Error in fetching home tags: ", error.message);
            }
        };

        fetchHomeTags();
    }, [user]);

    useEffect(() => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const fetchData = async () => {
            try {
                let response;
                if (hasFilters) {
                    response = await feedApi.getFilteredFeed(selectedTags, selectedTypes, page_no, cursorRef.current, user.channel_id);
                    mergeVideos(response.videos || [], response.nextCursor);
                } else if (user !== "Guest" && user.channel_id) {
                    if (newForYou) {
                        response = await feedApi.getNewForYou(user.channel_id, page_no, cursorRef.current);
                    } else {
                        response = await feedApi.getPersonalizedFeed(user.channel_id, page_no, cursorRef.current);
                    }
                    mergeVideos(response.videos || [], response.nextCursor);
                } else {
                    response = await feedApi.getHome(page_no, cursorRef.current, user.channel_id);
                    mergeVideos(response.videos || [], response.nextCursor);
                }
            } catch (error) {
                console.log("Error in fetching: ", error.message);
            } finally {
                setLoadingMore(false);
            }
        };
        fetchData();
    }, [page_no, user.channel_id, selectedTags, selectedTypes, newForYou, hasFilters, user]);

    const loadMore = () => {
        if (loadingMore || !hasMore) return;
        setpage_no((prev) => prev + 1);
    };

    return (
        <>
            <div className="home-tags">
                <div className="home-tag-row">
                    {topTags.length > 0 ? (
                        <>
                            <span className="home-tag-label">Top tags</span>
                            {topTags.map((tag) => (
                                <button
                                    key={tag}
                                    className={
                                        "home-tag " +
                                        (selectedTags.includes(tag) ? "active" : "")
                                    }
                                    onClick={() => toggleTag(tag)}
                                >
                                    {tag}
                                </button>
                            ))}
                        </>
                    ) : null}
                    {user !== "Guest" && user.channel_id ? (
                        <button
                            className={"home-tag " + (newForYou ? "active" : "")}
                            onClick={() => {
                                setNewForYou(!newForYou);
                                clearFilters();
                            }}
                        >
                            New for you
                        </button>
                    ) : null}
                    {hasFilters ? (
                        <button className="home-tag home-tag-clear" onClick={clearFilters}>
                            Clear
                        </button>
                    ) : null}
                </div>
                <div className="home-tag-row">
                    <span className="home-tag-label">Video type</span>
                    {videoTypes.map((tag) => (
                        <button
                            key={tag}
                            className={
                                "home-tag " +
                                (selectedTypes.includes(tag) ? "active" : "")
                            }
                            onClick={() => toggleType(tag)}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>
            {data ? (
                <CardGrid variant="default">
                    {data.map((item) => (
                        <Card key={item.video_id} data={item} />
                    ))}
                    <InfiniteScroll
                        hasMore={hasMore}
                        loading={loadingMore}
                        onLoadMore={loadMore}
                    />
                </CardGrid>
            ) : (
                <Cardloading />
            )}
        </>
    );
};

export default Home;