import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import "./Uploads.css";
import axios from "axios";
import UploadVideo from "./UploadVideo";

const Uploads = (params) => {
    const [uploads, setUploads] = useState([]);
    const [showUpload, setShowUpload] = useState(false);
    const serverurl = process.env.REACT_APP_SERVER_URL;
    const user = params.user;

    const fetchUploads = useCallback(async () => {
        if (user === "Guest") return;
        try {
            const response = await axios.get(
                `${serverurl}/uploadingVideos?channel_id=${user.channel_id}`
            );
            setUploads(response.data.uploads || []);
        } catch (error) {
            console.log("Error fetching uploads: ", error.message);
        }
    }, [serverurl, user]);

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
                                        : "Complete"}
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
                    </div>
                ))
            ) : (
                <p className="uploads-empty">
                    No uploads in progress. Click "Upload video" to add a new
                    one.
                </p>
            )}
            {showUpload ? (
                <UploadVideo
                    user={user}
                    onClose={() => setShowUpload(false)}
                    onUploaded={() => fetchUploads()}
                />
            ) : null}
        </div>
    );
};

export default Uploads;
