import React from "react";
import { Link } from "react-router-dom";
import { useQueue, LOOP_OFF, LOOP_ALL, LOOP_ONE } from "./QueueContext";
import "./QueuePopup.css";

const loopLabel = (mode) => {
    if (mode === LOOP_ALL) return "Loop all";
    if (mode === LOOP_ONE) return "Loop one";
    return "Loop off";
};

const QueuePopup = () => {
    const queue = useQueue();
    const { isOpen, setOpen, currentVideo, currentIndex } = queue;

    if (!isOpen) return null;

    const playUrl = (video) =>
        video.isShort ? `/shorts?video_id=${video.video_id}` : `/watch?video_id=${video.video_id}`;

    const goTo = (index) => {
        queue.playAt(index);
        const video = queue.queue[index];
        if (video) window.location.href = playUrl(video);
    };

    const step = (dir) => {
        const next = dir > 0 ? queue.peekNextIndex() : queue.peekPrevIndex();
        if (next === -1) return;
        goTo(next);
    };

    return (
        <div className="queue-popup">
            <div className="queue-popup-header">
                <span className="queue-popup-title">Queue</span>
                <div className="queue-popup-actions">
                    <button
                        className={`queue-icon-btn ${queue.loopMode !== LOOP_OFF ? "on" : ""}`}
                        title={loopLabel(queue.loopMode)}
                        onClick={queue.cycleLoop}
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M17 2l4 4-4 4V7H8a3 3 0 0 0-3 3v1H3V9a5 5 0 0 1 5-5h9V2zM7 22l-4-4 4-4v3h9a3 3 0 0 0 3-3V9h2v5a5 5 0 0 1-5 5H7v3z" />
                        </svg>
                        {queue.loopMode === LOOP_ONE ? <span className="queue-loop-one">1</span> : null}
                    </button>
                    <button
                        className={`queue-icon-btn ${queue.shuffle ? "on" : ""}`}
                        title={queue.shuffle ? "Shuffle on" : "Shuffle off"}
                        onClick={queue.toggleShuffle}
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                        </svg>
                    </button>
                    <button
                        className="queue-icon-btn"
                        title="Previous"
                        onClick={() => step(-1)}
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M6 6h2v12H6zM20 6l-10 6 10 6z" />
                        </svg>
                    </button>
                    <button
                        className="queue-icon-btn"
                        title="Next"
                        onClick={() => step(1)}
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M16 6h2v12h-2zM4 6l10 6-10 6z" />
                        </svg>
                    </button>
                    <button
                        className="queue-icon-btn"
                        title="Close queue"
                        onClick={() => setOpen(false)}
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" />
                        </svg>
                    </button>
                </div>
            </div>
            {currentVideo ? (
                <div className="queue-now-playing">
                    {currentVideo.thumbnail_link ? (
                        <img
                            src={currentVideo.thumbnail_link}
                            alt=""
                            loading="lazy"
                        />
                    ) : null}
                    <div className="queue-now-text">
                        <p className="queue-now-title">{currentVideo.title}</p>
                        <p className="queue-now-channel">{currentVideo.channel_name}</p>
                    </div>
                </div>
            ) : (
                <p className="queue-empty">Queue is empty — add videos from any card menu.</p>
            )}
            {queue.queue.length > 0 ? (
                <div className="queue-list">
                    {queue.queue.map((video, index) => (
                        <div
                            key={video.video_id}
                            className={`queue-row ${index === currentIndex ? "current" : ""} ${index < currentIndex ? "played" : ""}`}
                            onClick={() => goTo(index)}
                        >
                            <span className="queue-row-num">{index + 1}</span>
                            {video.thumbnail_link ? (
                                <img
                                    className="queue-row-thumb"
                                    src={video.thumbnail_link}
                                    alt=""
                                    loading="lazy"
                                />
                            ) : null}
                            <div className="queue-row-text">
                                <p className="queue-row-title">{video.title}</p>
                                <p className="queue-row-channel">{video.channel_name}</p>
                            </div>
                            <button
                                className="queue-row-remove"
                                title="Remove from queue"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    queue.dequeue(video.video_id);
                                }}
                            >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                                    <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            ) : null}
            <div className="queue-popup-footer">
                <Link to="/queue" onClick={() => setOpen(false)} className="queue-open-full">
                    Open full queue
                </Link>
                {queue.queue.length > 0 ? (
                    <button className="queue-clear-btn" onClick={queue.clearQueue}>
                        Clear
                    </button>
                ) : null}
            </div>
        </div>
    );
};

export default QueuePopup;
