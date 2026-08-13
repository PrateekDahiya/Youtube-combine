import { useEffect, useState, useRef } from "react";
import Card from "./Card";
import axios from "axios";
import { useLocation } from "react-router-dom";
import "./Home.css";
import Cardloading from "./Cardloading";

const Home = (params) => {
    const locationHook = useLocation();
    const [data, setData] = useState(null);
    const [selectedTag, setSelectedTag] = useState("All");
    const serverurl = process.env.REACT_APP_SERVER_URL;
    const [page, setPage] = useState(
        new URLSearchParams(locationHook.pathname)
    );
    const [page_no, setpage_no] = useState(1);
    const [startlistner, setstartlistner] = useState(false);
    const user = params.user;

    const normalizeTag = (tag) => tag.toLowerCase().trim();

    const getTopTags = () => {
        const counts = {};

        (data || []).forEach((item) => {
            (item.tags || "")
                .split(",")
                .map(normalizeTag)
                .filter(Boolean)
                .forEach((tag) => {
                    counts[tag] = (counts[tag] || 0) + 1;
                });
        });

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([tag]) => tag);
    };

    const topTags = getTopTags();
    const videoTypes = ["All", "Music", "Gaming", "Movies", "News", "Sports"];

    useEffect(() => {
        setData(null);
        setpage_no(1);
    }, [selectedTag]);

    useEffect(() => {
        const currentpage = new URLSearchParams(locationHook.pathname);
        setPage(currentpage);
    }, [locationHook]);

    useEffect(() => {
        const fetchData = async () => {
            if (selectedTag !== "All") {
                await axios
                    .get(
                        `${serverurl}/feed-by-tag?tag=${encodeURIComponent(
                            selectedTag
                        )}&page=${page_no}`
                    )
                    .then((response) => {
                        const videos = response.data.videos || [];
                        setData((prev) =>
                            prev === null
                                ? videos
                                : videos.length === 0
                                ? prev
                                : prev[0].video_id !== videos[0].video_id
                                ? [...prev, ...videos]
                                : prev
                        );
                    })
                    .catch((error) => {
                        console.log("Error in fetching: ", error.message);
                    });
                return;
            }

            if (user.channel_id) {
                await axios
                    .get(
                        `${serverurl}/personalized-feed?page=${page_no}&user_id=${user.channel_id}`
                    )
                    .then((response) => {
                        const videos = response.data.videos || [];
                        setData((prev) =>
                            prev === null
                                ? videos
                                : videos.length === 0
                                ? prev
                                : prev[0].video_id !== videos[0].video_id
                                ? [...prev, ...videos]
                                : prev
                        );
                    })
                    .catch((error) => {
                        console.log("Error in fetching: ", error.message);
                    });
            }
            if (user === "Guest") {
                await axios
                    .get(`${serverurl}/home?page=${page_no}`)
                    .then((response) => {
                        const videos = response.data.videos || [];
                        setData((prev) =>
                            prev === null
                                ? videos
                                : videos.length === 0
                                ? prev
                                : prev[0].video_id !== videos[0].video_id
                                ? [...prev, ...videos]
                                : prev
                        );
                    })
                    .catch((error) => {
                        console.log("Error in fetching: ", error.message);
                    });
            }
        };

        fetchData();
    }, [page_no, user.channel_id]);

    const handleScroll = async () => {
        const cards = document.getElementsByClassName("cards")[0];

        if (window.innerHeight + cards.scrollTop - 4 >= cards.scrollHeight) {
            setpage_no((prev) => prev + 1);
        }
    };

    useEffect(() => {
        if (data) {
            const cards = document.getElementsByClassName("cards")[0];
            cards.addEventListener("scroll", handleScroll);
            return () => cards.removeEventListener("scroll", handleScroll);
        }
    }, [startlistner]);

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
                                            onClick={() => setSelectedTag(tag)}
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
                                        (selectedTag === tag ? "active" : "")
                                    }
                                    onClick={() => setSelectedTag(tag)}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div
                        className="cards"
                        onLoad={() => {
                            setstartlistner(true);
                        }}
                    >
                        {data.map((item) => (
                            <Card key={item.video_id} data={item} />
                        ))}
                    </div>
                </>
            ) : (
                <Cardloading />
            )}
        </>
    );
};

export default Home;
