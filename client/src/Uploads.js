import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import "./Uploads.css";
import { videoApi } from "./api";
import UploadVideo from "./UploadVideo";
import EditVideo from "./EditVideo";

const Uploads = (params) => {
    const [uploads, setUploads] = useState([]);
    const [showUpload, setShowUpload] = useState(false);
    const [editingVideo, setEditingVideo] = useState(null);
    const user = params.user;

    const fetchUploads = useCallback(async () => {
        if (user === "Guest") return;
        try {
            const response = await videoApi.getUploadingVideos(user.channel_id);
            setUploads(response.data.uploads || []);
        } catch (error) {
            console.log("Error fetching uploads: ", error.message);
        }
    }, [user]);

    useEffect(() => {
        fetchUploads();
    }, [fetchUploads]);

    useEffect(() => {
        if (!uploads.some((u) => u.upload_status === 1)) return;
        const timer = setInterval(fetchUploads, 2000);
        return () => clearInterval(timer);
    }, [uploads, fetchUploads]);

    if (user === "Guest") {
        return (
            <div className="uploads-guest">
                <h2>Sign in to view your uploads</h2>
                <Link to="/login" style={{ textDecoration: "none" }}>
                    <button className="sign_in">Sign In</button>
                </Link>
            </div>
        );
    }

    return (
        <div className="uploads-page">
            <div className="uploads-page-header">
                <h1 className="uploads-page-title">Uploads</h1>
                <button
                    className="upload-video-btn"
                    onClick={() => setShowUpload(true)}
                >
                    Upload video
                </button>
            </div>
            {uploads.length > 0 ? (
                uploads.map((u) => (
                    <div key={u.video_id} className="upload-item">
                        {u.thumbnail_link ? (
                            <img
                                className="upload-item-thumb"
                                src={u.thumbnail_link}
                                alt=""
                            />
                        ) : u.link && u.link.includes("res.cloudinary.com") ? (
                            <img
                                className="upload-item-thumb"
                                src={u.link.replace(
                                    /\.[a-zA-Z0-9]+$/,
                                    ".jpg"
                                )}
                                alt=""
                            />
                        ) : null}
                        <div className="upload-item-info">
                            <p className="upload-item-title">{u.title}</p>
                            <p
                                className={
                                    "upload-item-status" +
                                    (u.upload_status === 2 ? " failed" : "")
                                }
                            >
                                {u.upload_status === 1
                                    ? `Uploading… ${u.upload_progress}%`
                                    : u.upload_status === 2
                                        ? `Failed: ${
                                              u.upload_error || "Upload failed"
                                          }`
                                        : "Uploaded"}
                            </p>
                        </div>
                        {u.upload_status === 1 ? (
                            <div className="upload-progress-bar">
                                <div
                                    className="upload-progress-fill"
                                    style={{
                                        width: `${u.upload_progress}%`,
                                    }}
                                />
                            </div>
                        ) : null}
                        <span
                            className="upload-item-edit"
                            title="Edit video"
                            onClick={() => setEditingVideo(u)}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                                fill="currentColor"
                            >
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                            </svg>
                        </span>
                    </div>
                ))
            ) : (
                <p className="uploads-empty">
                    No uploads yet. Click "Upload video" to add a new one.
                </p>
            )}
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
        </div>
    );
};

export default Uploads;
