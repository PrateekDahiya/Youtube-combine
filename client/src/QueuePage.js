import React from "react";
import { Link } from "react-router-dom";
import { useQueue } from "./QueueContext";
import "./QueuePage.css";

const QueuePage = () => {
    const queue = useQueue();

    const playUrl = (video) =>
        video.isShort ? `/shorts?video_id=${video.video_id}` : `/watch?video_id=${video.video_id}`;

    const playAtAndGo = (index) => {
        queue.playAt(index);
        const video = queue.queue[index];
        if (video) window.location.href = playUrl(video);
    };

    const playHistoryAndGo = (video) => {
        window.location.href = playUrl(video);
    };

    return (
        <div className="queue-page">
            <h1>Queue</h1>
            {queue.queue.length === 0 ? (
                <div className="queue-page-empty">
                    <p>Your queue is empty.</p>
                    <p>Add videos from any video card menu to build a playlist.</p>
                    <Link to="/" className="queue-page-home">Browse videos</Link>
                </div>
            ) : (
                <div className="queue-page-section">
                    <h2>Up next</h2>
                    <div className="queue-page-grid">
                        {queue.queue.map((video, index) => (
                            <div
                                key={video.video_id}
                                className={`queue-page-card ${index === queue.currentIndex ? "current" : ""} ${index < queue.currentIndex ? "played" : ""}`}
                            >
                                <div
                                    className="queue-page-thumb-wrap"
                                    onClick={() => playAtAndGo(index)}
                                >
                                    {video.thumbnail_link ? (
                                        <img
                                            src={video.thumbnail_link}
                                            alt={video.title}
                                            loading="lazy"
                                        />
                                    ) : null}
                                    <span className="queue-page-num">{index + 1}</span>
                                </div>
                                <div className="queue-page-info">
                                    <p className="queue-page-title" onClick={() => playAtAndGo(index)}>
                                        {video.title}
                                    </p>
                                    <p className="queue-page-channel">{video.channel_name}</p>
                                </div>
                                <button
                                    className="queue-page-remove"
                                    title="Remove from queue"
                                    onClick={() => queue.dequeue(video.video_id)}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                    <button className="queue-page-clear" onClick={queue.clearQueue}>
                        Clear queue
                    </button>
                </div>
            )}
            {queue.history.length > 0 ? (
                <div className="queue-page-section">
                    <h2>Recently played</h2>
                    <div className="queue-page-grid">
                        {queue.history.map((video) => (
                            <div key={video.video_id + (video.playedAt || "")} className="queue-page-card">
                                <div
                                    className="queue-page-thumb-wrap"
                                    onClick={() => playHistoryAndGo(video)}
                                >
                                    {video.thumbnail_link ? (
                                        <img
                                            src={video.thumbnail_link}
                                            alt={video.title}
                                            loading="lazy"
                                        />
                                    ) : null}
                                </div>
                                <div className="queue-page-info">
                                    <p className="queue-page-title" onClick={() => playHistoryAndGo(video)}>
                                        {video.title}
                                    </p>
                                    <p className="queue-page-channel">{video.channel_name}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="queue-page-clear" onClick={queue.clearHistory}>
                        Clear history
                    </button>
                </div>
            ) : null}
        </div>
    );
};

export default QueuePage;
