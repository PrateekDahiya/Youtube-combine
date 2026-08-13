import { useEffect, useState } from "react";
import Card from "./Card";
import axios from "axios";
import "./Home.css";
import Cardloading from "./Cardloading";
import CardGrid from "./CardGrid";
import InfiniteScroll from "./InfiniteScroll";

const Home = (params) => {
    const [data, setData] = useState(null);
    const [topTags, setTopTags] = useState([]);
    const [selectedTag, setSelectedTag] = useState("All");
    const [selectedType, setSelectedType] = useState("All");
    const serverurl = process.env.REACT_APP_SERVER_URL;
    const [page_no, setpage_no] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const user = params.user;
    const videoTypes = ["All", "Music", "Gaming", "Movies", "News", "Sports"];

    const mergeVideos = (videos) => {
        setData((prev) => {
            if (prev === null) return videos;
            const existingIds = new Set(prev.map((v) => v.video_id));
            const fresh = videos.filter((v) => !existingIds.has(v.video_id));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
        if (videos.length < 24) {
            setHasMore(false);
        }
    };

    useEffect(() => {
        setData(null);
        setpage_no(1);
        setHasMore(true);
    }, [selectedTag, selectedType]);

    useEffect(() => {
        const fetchHomeTags = async () => {
            if (user === "Guest" || !user.channel_id) {
                setTopTags([]);
                return;
            }

            try {
                const response = await axios.get(
                    `${serverurl}/home-tags?user_id=${user.channel_id}`
                );
                setTopTags(response.data.tags || []);
            } catch (error) {
                console.log("Error in fetching home tags: ", error.message);
            }
        };

        fetchHomeTags();
    }, [serverurl, user]);

    useEffect(() => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const fetchData = async () => {
            try {
                let response;
                if (selectedTag !== "All") {
                    response = await axios.get(
                        `${serverurl}/feed-by-tag?tag=${encodeURIComponent(
                            selectedTag
                        )}&page=${page_no}`
                    );
                    mergeVideos(response.data.videos || []);
                } else if (selectedType !== "All") {
                    response = await axios.get(
                        `${serverurl}/feed-by-tag?type=${encodeURIComponent(
                            selectedType
                        )}&page=${page_no}`
                    );
                    mergeVideos(response.data.videos || []);
                } else if (user !== "Guest" && user.channel_id) {
                    response = await axios.get(
                        `${serverurl}/personalized-feed?page=${page_no}&user_id=${user.channel_id}`
                    );
                    mergeVideos(response.data.videos || []);
                } else {
                    response = await axios.get(
                        `${serverurl}/home?page=${page_no}`
                    );
                    mergeVideos(response.data.videos || []);
                }
            } catch (error) {
                console.log("Error in fetching: ", error.message);
            } finally {
                setLoadingMore(false);
            }
        };
        fetchData();
    }, [page_no, user.channel_id, selectedTag, selectedType, serverurl, user]);

    const loadMore = () => {
        if (loadingMore || !hasMore) return;
        setpage_no((prev) => prev + 1);
    };

    return (
        <>
            {data ? (
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
                                                (selectedTag === tag ? "active" : "")
                                            }
                                            onClick={() => {
                                                setSelectedTag(tag);
                                                setSelectedType("All");
                                            }}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </>
                            ) : null}
                        </div>
                        <div className="home-tag-row">
                            <span className="home-tag-label">Video type</span>
                            {videoTypes.map((tag) => (
                                <button
                                    key={tag}
                                    className={
                                        "home-tag " +
                                        (selectedType === tag ? "active" : "")
                                    }
                                    onClick={() => {
                                        setSelectedType(tag);
                                        setSelectedTag("All");
                                    }}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
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
                </>
            ) : (
                <Cardloading />
            )}
        </>
    );
};

export default Home;
