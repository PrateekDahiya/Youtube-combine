import React from "react";
import "./Cardloading.css";

const SkeletonCard = () => (
    <div className="sk-card">
        <div className="sk-thumb"></div>
        <div className="sk-cardbody">
            <div className="sk-cardicon"></div>
            <div className="sk-cardtext">
                <div className="sk-line"></div>
                <div className="sk-line"></div>
            </div>
        </div>
    </div>
);

const SkeletonGrid = ({ count = 8, single = false }) => {
    const items = Array.from({ length: count }, (_, i) => i);
    return (
        <div className={single ? "sk-cards-grid" : "sk-videos sk-cards-grid"}>
            {items.map((i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
};

const SkeletonTrending = ({ count = 5 }) => {
    const items = Array.from({ length: count }, (_, i) => i);
    return (
        <div className="sk-cards-grid">
            {items.map((i) => (
                <div className="sk-trending-row" key={i}>
                    <div className="sk-trendthumb"></div>
                    <div className="sk-trendmeta">
                        <div className="sk-line"></div>
                        <div className="sk-line"></div>
                        <div className="sk-line"></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const SkeletonWatch = () => (
    <>
        <div className="sk-watch">
            <div className="sk-video"></div>
            <div className="sk-title"></div>
            <div className="sk-actions">
                <div className="sk-round"></div>
                <div className="sk-textblock">
                    <div className="sk-line"></div>
                    <div className="sk-line"></div>
                </div>
                <div className="sk-pill"></div>
                <div className="sk-pill"></div>
                <div className="sk-pill"></div>
            </div>
        </div>
        <div className="sk-page">
            <div className="sk-section">
                <div className="sk-sectiontitle"></div>
                <SkeletonGrid count={5} single />
            </div>
        </div>
    </>
);

const SkeletonChannel = () => (
    <div className="sk-page">
        <div className="sk-img" style={{ height: 170, marginBottom: 20 }}></div>
        <div className="sk-chanhero">
            <div className="sk-avatarpic"></div>
            <div className="sk-channeltext">
                <div className="sk-line"></div>
                <div className="sk-line"></div>
                <div className="sk-line"></div>
                <div className="sk-buttons">
                    <div className="sk-pill"></div>
                    <div className="sk-pill"></div>
                </div>
            </div>
        </div>
        <SkeletonGrid count={8} />
    </div>
);

const Cardloading = (params) => {
    const page = params.page;
    if (page === "watch") return <SkeletonWatch />;
    if (page === "channel" || page === "yourchannel")
        return <SkeletonChannel />;
    if (page === "category")
        return (
            <div className="sk-page">
                <div className="sk-headerline">
                    <div className="sk-round"></div>
                    <div className="sk-line"></div>
                </div>
                <SkeletonGrid count={8} />
            </div>
        );
    if (page === "trendings")
        return (
            <div className="sk-page">
                <div className="sk-headerline">
                    <div className="sk-round"></div>
                    <div className="sk-line"></div>
                </div>
                <div className="sk-videos">
                    <SkeletonTrending />
                </div>
            </div>
        );
    if (page === "search")
        return (
            <div className="sk-page">
                <div className="sk-line" style={{ width: "70%", marginBottom: 16 }}></div>
                <div className="sk-section">
                    <div className="sk-sectiontitle"></div>
                    <div className="sk-channel-cards">
                        {[0, 1, 2, 3].map((i) => (
                            <div className="sk-channel-card" key={i}>
                                <div className="sk-round"></div>
                                <div className="sk-channeltext">
                                    <div className="sk-line"></div>
                                    <div className="sk-line"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="sk-section">
                    <div className="sk-sectiontitle"></div>
                    <div className="sk-videos">
                        <SkeletonGrid count={6} single />
                    </div>
                </div>
            </div>
        );
    if (page === "subscription")
        return (
            <div className="sk-page">
                <div className="sk-line" style={{ width: 200, height: 24, marginBottom: 16 }}></div>
                <div className="sk-line" style={{ width: 100, marginBottom: 16 }}></div>
                <div className="sk-channel-strip" style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div className="sk-pill" style={{ width: 130, height: 40 }} key={i}></div>
                    ))}
                </div>
                <SkeletonGrid count={8} />
            </div>
        );
    if (page === "you")
        return (
            <div className="sk-page">
                <div className="sk-img" style={{ height: 170, marginBottom: 20 }}></div>
                <div className="sk-chanhero">
                    <div className="sk-avatarpic"></div>
                    <div className="sk-channeltext">
                        <div className="sk-line"></div>
                        <div className="sk-line"></div>
                        <div className="sk-buttons">
                            <div className="sk-pill"></div>
                            <div className="sk-pill"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    if (page === "history")
        return (
            <div className="sk-page">
                <div className="sk-line" style={{ width: 220, height: 26, marginBottom: 24 }}></div>
                {[0, 1, 2].map((g) => (
                    <div className="sk-section" key={g}>
                        <div className="sk-sectiontitle"></div>
                        <div className="sk-cards-grid">
                            {[0, 1, 2].map((i) => (
                                <SkeletonCard key={i} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    if (page === "likes" || page === "watchlater")
        return (
            <div className="sk-page">
                <div className="sk-line" style={{ width: 200, height: 26, marginBottom: 24 }}></div>
                <SkeletonGrid count={9} />
            </div>
        );
    return (
        <div className="sk-body">
            <SkeletonGrid count={9} />
        </div>
    );
};

export default Cardloading;
