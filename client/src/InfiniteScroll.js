import React, { useEffect, useRef } from "react";
import "./InfiniteScroll.css";

const InfiniteScroll = ({ hasMore, loading, onLoadMore }) => {
    const sentinelRef = useRef(null);
    const onLoadMoreRef = useRef(onLoadMore);
    onLoadMoreRef.current = onLoadMore;

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading) {
                    onLoadMoreRef.current();
                }
            },
            { root: null, rootMargin: "200px 0px" }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasMore, loading]);

    if (!hasMore) return null;

    return (
        <div ref={sentinelRef} className="infinite-scroll-sentinel">
            {loading ? "Loading more..." : ""}
        </div>
    );
};

export default InfiniteScroll;
