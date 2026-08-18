import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import "./Uploads.css";
import { videoApi } from "./api";
import UploadVideo from "./UploadVideo";
import EditVideo from "./EditVideo";
import DeleteVideoModal from "./DeleteVideoModal";

const STATUS = {
    UPLOADING: "uploading",
    FAILED: "failed",
    UPLOADED: "uploaded",
};

const statusOf = (u) =>
    u.upload_status === 1
        ? STATUS.UPLOADING
        : u.upload_status === 2
        ? STATUS.FAILED
        : STATUS.UPLOADED;

const STATUS_META = {
    uploading: { label: "Uploading", className: "uploading" },
    failed: { label: "Failed", className: "failed" },
    uploaded: { label: "Uploaded", className: "uploaded" },
};

const getWatchPath = (u) =>
    u.isShort === 1 ? `/shorts?video_id=${u.video_id}` : `/watch?video_id=${u.video_id}`;

const getThumb = (u) => {
    if (u.thumbnail_link) return u.thumbnail_link;
    if (u.link && u.link.includes("youtube.com")) {
        const videoId = u.link.match(/[?&]v=([^&]+)/)?.[1];
        if (videoId) return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    }
    if (u.link && u.link.includes("res.cloudinary.com")) {
        return u.link.replace(/\.[a-zA-Z0-9]+$/, ".jpg");
    }
    return "";
};

const Uploads = (params) => {
    const [uploads, setUploads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUpload, setShowUpload] = useState(false);
    const [editingVideo, setEditingVideo] = useState(null);
    const [deletingVideo, setDeletingVideo] = useState(null);
    const [filter, setFilter] = useState("all");
    const user = params.user;

    const fetchUploads = useCallback(async () => {
        if (user === "Guest") return;
        try {
            const response = await videoApi.getUploadingVideos(user.channel_id);
            setUploads(response.uploads || []);
        } catch (error) {
            console.log("Error fetching uploads: ", error.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchUploads();
    }, [fetchUploads]);

    useEffect(() => {
        if (!uploads.some((u) => u.upload_status === 1)) return;
        const timer = setInterval(fetchUploads, 8000);
        return () => clearInterval(timer);
    }, [uploads, fetchUploads]);

    const counts = useMemo(() => {
        const c = { uploading: 0, failed: 0, uploaded: 0, all: uploads.length };
        uploads.forEach((u) => {
            c[statusOf(u)] += 1;
        });
        return c;
    }, [uploads]);

    const filtered = useMemo(() => {
        if (filter === "all") return uploads;
        return uploads.filter((u) => statusOf(u) === filter);
    }, [uploads, filter]);

    if (user === "Guest") {
        return (
            <div className="uploads-guest">
                <div className="uploads-guest-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
                    </svg>
                </div>
                <h2>Sign in to view your uploads</h2>
                <p>Upload, edit, and track your videos all from one place.</p>
                <Link to="/login" style={{ textDecoration: "none" }}>
                    <button className="sign_in">Sign In</button>
                </Link>
            </div>
        );
    }

    return (
        <div className="uploads-page">
            <div className="uploads-inner">
                <div className="uploads-head">
                    <div className="uploads-head-text">
                        <h1 className="uploads-title">Uploads</h1>
                        <p className="uploads-subtitle">
                            {loading
                                ? "Loading your uploads…"
                                : uploads.length
                                ? `${counts.uploaded} uploaded${
                                      counts.uploading
                                          ? ` · ${counts.uploading} uploading`
                                          : ""
                                  }${
                                      counts.failed
                                          ? ` · ${counts.failed} failed`
                                          : ""
                              }`
                                : "Manage the videos you've uploaded"}
                        </p>
                    </div>
                    <button
                        className="upload-video-btn"
                        onClick={() => setShowUpload(true)}
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                        Upload video
                    </button>
                </div>

                <div className="uploads-tabs">
                    <button
                        className={"uploads-tab" + (filter === "all" ? " active" : "")}
                        onClick={() => setFilter("all")}
                    >
                        <span className="tab-dot" />
                        All
                        <span className="tab-count">{counts.all}</span>
                    </button>
                    {Object.keys(STATUS_META).map((key) => (
                        <button
                            key={key}
                            className={
                                "uploads-tab " + STATUS_META[key].className +
                                (filter === key ? " active" : "")
                            }
                            onClick={() => setFilter(key)}
                        >
                            <span className="tab-dot" />
                            {STATUS_META[key].label}
                            <span className="tab-count">{counts[key]}</span>
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="uploads-empty">Loading…</div>
                ) : uploads.length === 0 ? (
                    <div className="uploads-empty">
                        <div className="uploads-empty-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
                            </svg>
                        </div>
                        <p className="uploads-empty-title">No uploads yet</p>
                        <p className="uploads-empty-text">
                            Click "Upload video" to add your first video.
                        </p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="uploads-empty">
                        <p className="uploads-empty-text">No videos in this section.</p>
                    </div>
                ) : (
                    <div className="uploads-list">
                        {filtered.map((u) => (
                            <div
                                key={u.video_id}
                                className="upload-item"
                                style={{
                                    animation: `upload-item-in 0.3s ease ${filtered.indexOf(u) *
                                        0.05}s`,
                                }}
                            >
                                <Link
                                    to={
                                        u.link
                                            ? getWatchPath(u)
                                            : undefined
                                    }
                                    className={
                                        u.link
                                            ? "upload-item-thumb-wrap"
                                            : "upload-item-thumb-wrap-no-link"
                                    }
                                >
                                    {getThumb(u) ? (
                                        <img
                                            className="upload-item-thumb"
                                            src={getThumb(u)}
                                            alt=""
                                            loading="lazy"
                                        />
                                    ) : (
                                        <span
                                            className="upload-item-thumb-ph"
                                        >
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                            >
                                                <path
                                                    d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"
                                                />
                                            </svg>
                                        </span>
                                    )}
                                </Link>
                                <div className="upload-item-info">
                                    <p className="upload-item-title">
                                        {u.title}
                                    </p>
                                    <div className="upload-item-meta">
                                        <span
                                            className={
                                                "upload-badge " +
                                                STATUS_META[statusOf(u)].className
                                            }
                                        >
                                            <span
                                                className="upload-badge-pip"
                                            />
                                            {STATUS_META[statusOf(u)].label}
                                        </span>
                                        {statusOf(u) === STATUS.UPLOADING ? (
                                            <span
                                                className="upload-item-percent"
                                            >
                                                {u.upload_progress}%
                                            </span>
                                        ) : null}
                                        {u.isShort === 1 ? (
                                            <span className="upload-item-kind">
                                                Short
                                            </span>
                                        ) : null}
                                    </div>
                                    {statusOf(u) === STATUS.UPLOADING ? (
                                        <div className="uploads-progress-bar">
                                            <div
                                                className="uploads-progress-fill"
                                                style={{
                                                    width: `${u.upload_progress}%`,
                                                }}
                                            />
                                        </div>
                                    ) : null}
                                    {statusOf(u) === STATUS.FAILED ? (
                                        <p
                                            className="upload-item-error"
                                        >
                                            {u.upload_error ||
                                                "Upload failed. Please try again."}
                                        </p>
                                    ) : null}
                                </div>
                                <div
                                    className="upload-item-actions"
                                    style={{ flexDirection: u.link ? "row" : "column" }}
                                >
                                    {u.link ? (
                                        <Link
                                            to={getWatchPath(u)}
                                            className="upload-item-action"
                                            title="Watch video"
                                        >
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                            >
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                        </Link>
                                    ) : null}
                                    <button
                                        className="upload-item-action"
                                        title="Edit video"
                                        onClick={() => setEditingVideo(u)}
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                        >
                                            <path
                                                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                                            />
                                        </svg>
                                    </button>
                                    <button
                                        className="upload-item-action upload-item-action-delete"
                                        title="Delete video"
                                        onClick={() => setDeletingVideo(u)}
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                        >
                                            <path
                                                d="M6 7h12l-1 13.01A2 2 0 0 1 15.01 22H8.99a2 2 0 0 1-1.99-1.99L6 7zm3-3h6l1 2H8l1-2zM4 6h16v2H4V6z"
                                            />
                                        </svg>
                                    </button>
                                    </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {showUpload ? (
                <UploadVideo
                    user={user}
                    onClose={() => setShowUpload(false)}
                    onUploaded={() => fetchUploads()}
                />
            ) : null}
            {editingVideo ? (
                <EditVideo
                    video={editingVideo}
                    user={user}
                    onClose={() => setEditingVideo(null)}
                    onUpdated={() => fetchUploads()}
                />
            ) : null}
            {deletingVideo ? (
                <DeleteVideoModal
                    video={deletingVideo}
                    user={user}
                    onClose={() => setDeletingVideo(null)}
                    onDeleted={() => fetchUploads()}
                />
            ) : null}
        </div>
    );
};

export default Uploads;