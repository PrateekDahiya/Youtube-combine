import React, { useState, useEffect, useRef } from "react";
import Card from "./Card";
import { categoryApi } from "./api";
import { useLocation } from "react-router-dom";
import "./Category.css";
import CardGrid from "./CardGrid";
import Cardloading from "./Cardloading";
import InfiniteScroll from "./InfiniteScroll";

const Category = (params) => {
    const locationHook = useLocation();
    const [typeShort, setType] = useState(0);
    const [data, setdata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [page_no, setpage_no] = useState(1);
    const cursorRef = useRef(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [category, setCategory] = useState(
        new URLSearchParams(locationHook.search).get("category")
    );
    const user = params.user;
    function Heading(string) {
        if (!string) return "";
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    useEffect(() => {
        const currentCategory = new URLSearchParams(locationHook.search).get(
            "category"
        );
        setCategory(currentCategory);
    }, [locationHook]);

    const mergeVideos = (videos, nextCursor) => {
        setdata((prev) => {
            if (prev === null || prev.videos === undefined) {
                return { ...(prev || {}), videos };
            }
            const existingIds = new Set(prev.videos.map((v) => v.video_id));
            const fresh = videos.filter((v) => !existingIds.has(v.video_id));
            return fresh.length > 0
                ? { ...prev, videos: [...prev.videos, ...fresh] }
                : prev;
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
        setdata(null);
        setpage_no(1);
        cursorRef.current = null;
        setHasMore(true);
        setLoading(true);
    }, [typeShort, category]);

    useEffect(() => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const fetchData = async () => {
            try {
                const response = await categoryApi.getCategory(category, typeShort, page_no, cursorRef.current);
                mergeVideos(response.videos || [], response.nextCursor);
                setdata((prev) => ({ ...prev, caticon: response.caticon, category: response.category }));
            } catch (error) {
                console.log("Error fetching category:", error.message);
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        };
        fetchData();
    }, [typeShort, category, page_no, user]);

    const loadMore = () => {
        if (loadingMore || !hasMore) return;
        setpage_no((prev) => prev + 1);
    };

    return (
        <>
            {loading ? (
                <Cardloading page="category" />
            ) : data && data.videos ? (
                <div className="categorybox">
                    <div className="heading">
                        <img
                            className="caticon"
                            title={Heading(data.category)}
                            src={data.caticon}
                            alt="category"
                        />
                        <p className="catheading">{Heading(data.category)}</p>
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
                    </div>
                    <div>
                        <hr className="line"></hr>
                    </div>
                    <CardGrid variant="category" className="category">
                        {data.videos.map((item) => (
                            <Card key={item.video_id} data={item} />
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

export default Category;