import React from "react";
import "./Cardloading.css";
const Cardloading = (params) => {
    const loadlist = [
        { index: 0 },
        { index: 1 },
        { index: 2 },
        { index: 3 },
        { index: 4 },
        { index: 5 },
        { index: 6 },
        { index: 7 },
        { index: 8 },
        { index: 9 },
        { index: 10 },
        { index: 11 },
        { index: 12 },
    ];
    return (
        <div
            className={
                params.page === "category"
                    ? "outerbox-loading category-outerbox"
                    : params.page === "channel"
                    ? "outerbox-loading channel-outerbox"
                    : params.page === "subscription"
                    ? "outerbox-loading subscription-outerbox"
                    : params.page === "watch"
                    ? "outerbox-loading watch-outerbox"
                    : "outerbox-loading"
            }
        >
            {params.page === "category" ? (
                <>
                    <div className="catheading-loading">
                        <div className="caticon-load"></div>
                        <div className="catheading-load"></div>
                    </div>
                    <div className="catmenus-load"></div>
                </>
            ) : params.page === "channel" ? (
                <>
                    <div className="chl-banner-load"></div>
                    <div className="channelinfo-load">
                        <div className="chl-mypic-load"></div>
                        <div className="chl-details-load">
                            <div className="name-load"></div>
                            <div className="subs-load"></div>
                            <div className="desc-load"></div>
                            <div className="subbuttons-load">
                                <div></div>
                                <div></div>
                            </div>
                        </div>
                    </div>
                    <div className="menus-load"></div>
                </>
            ) : params.page === "yourchannel" ? (
                <>
                    <div className="chl-banner-load"></div>
                    <div className="channelinfo-load">
                        <div className="chl-mypic-load"></div>
                        <div className="chl-details-load">
                            <div className="name-load"></div>
                            <div className="subs-load"></div>
                            <div className="desc-load"></div>
                        </div>
                    </div>
                    <div className="menus-load"></div>
                </>
            ) : (
                <></>
            )}
            {params.page === "watch" ? (
                <>
                    <div className="videop-load"></div>
                    <div className="vp-videotitle-load"></div>
                    <div className="channelbox-load">
                        <div className="boxpart1-load">
                            <div className="box-chl-icon-load"></div>
                            <div className="btn-load"></div>
                        </div>
                        <div className="boxpart2-load">
                            <div className="btn-load"></div>
                            <div className="btn-load"></div>
                            <div className="btn-load"></div>
                            <div className="btn-load"></div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="videos-loading">
                    {loadlist.map((item) => (
                        <div className="card-loading" key={item.index}>
                            <div className="img-load"></div>
                            <div className="info-load">
                                <div className="chl-icon-load"></div>
                                <div className="text-load">
                                    <div className="videotitle-load"></div>
                                    <div className="viewsntime-load"></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Cardloading;
