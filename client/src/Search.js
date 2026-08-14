import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import Card from "./Card";
import { searchApi } from "./api";
import "./Search.css";
import CardGrid from "./CardGrid";
import Cardloading from "./Cardloading";
import InfiniteScroll from "./InfiniteScroll";

const defaultAvatar = "https://cdn-icons-png.flaticon.com/128/1077/1077063.png";

const Search = () => {
    const locationHook = useLocation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [page_no, setpage_no] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const queryString = locationHook.search;
    const searchQuery = new URLSearchParams(queryString).get("query") || "";

    const mergeVideos = (videos) => {
        setData((prev) => {
            if (prev === null || prev.videos === undefined) {
                return { ...(prev || {}), videos };
            }
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
        setData(null);
        setpage_no(1);
        setHasMore(true);
        setLoading(true);
    }, [queryString]);

    useEffect(() => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const fetchData = async () => {
            try {
                const response = await searchApi.search(searchQuery, page_no);
                mergeVideos(response.videos || []);
                setData((prev) => ({
                    ...(prev || {}),
                    channels: response.channels || [],
                }));
            } catch (error) {
                console.log("Error fetching search:", error.message);
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        };
        fetchData();
    }, [queryString, page_no]);

    const loadMore = () => {
        if (loadingMore || !hasMore) return;
        setpage_no((prev) => prev + 1);
    };

    return loading ? (
        <Cardloading page="search" />
    ) : (
        <div className="searchPage">
            <p className="channel-find-error ">
                *If you can't find the channel, please send feedback with the
                channel ID to add it instantly.
            </p>
            <div className="search-results">
                {data && data.channels && data.channels.length > 0 ? (
                    <div className="search-section">
                        <h2 className="search-heading">Channels</h2>
                        <div className="channel-results">
                            {data.channels.map((item) => (
                                <Link
                                    key={item.channel_id}
                                    to={`/channel?channel_id=${item.channel_id}`}
                                    className="channel-result"
                                >
                                    <img
                                        src={item.channel_icon || defaultAvatar}
                                        alt={item.channel_name || "channel"}
                                    />
                                    <div className="channel-result-text">
                                        <p className="channel-result-name">
                                            {item.channel_name || ""}
                                        </p>
                                        <p className="channel-result-meta">
                                            {item.custom_url || ""}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : null}
                {data && data.videos && data.videos.length > 0 ? (
                    <div className="search-section">
                        <h2 className="search-heading">Videos</h2>
                        <CardGrid variant="fluid" className="search-cards">
                            {data.videos.map((item) => (
                                <Card key={item.video_id} data={item} />
                            ))}
                        </CardGrid>
                        <InfiniteScroll
                            hasMore={hasMore}
                            loading={loadingMore}
                            onLoadMore={loadMore}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default Search;