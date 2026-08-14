import React, { useState, useRef } from "react";
import { uploadApi } from "./api";
import { useNavigate } from "react-router-dom";
import "./UploadVideo.css";

const CHUNK_SIZE = 5 * 1024 * 1024;

async function cloudinaryChunkedUpload(file, resourceType, onProgress) {
    const uniqueId =
        "vidvault-" + Math.random().toString(36).slice(2) + "-" + Date.now();
    const total = file.size;
    const totalChunks = Math.max(1, Math.ceil(total / CHUNK_SIZE));
    let result = null;
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, total);
        const piece = file.slice(start, end);
        const sig = await uploadApi.getUploadSignature(resourceType);
        const formData = new FormData();
        formData.append("file", piece);
        formData.append("api_key", sig.api_key);
        formData.append("timestamp", String(sig.timestamp));
        formData.append("signature", sig.signature);
        formData.append("folder", sig.folder);
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${sig.cloud_name}/${resourceType}/upload`,
            {
                method: "POST",
                body: formData,
                headers: {
                    "X-Unique-Upload-Id": uniqueId,
                    "Content-Range": `bytes ${start}-${end - 1}/${total}`,
                },
            }
        );
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(
                "Chunk upload failed: " + String(errText).slice(0, 120)
            );
        }
        if (onProgress) onProgress(Math.round((end / total) * 100));
        if (i === totalChunks - 1) {
            result = await response.json();
        }
    }
    return result;
}

async function cloudinaryIsAvailable() {
    try {
        await uploadApi.getUploadSignature("video");
        return true;
    } catch (err) {
        return false;
    }
}

const UploadVideo = (params) => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState("");
    const [category, setCategory] = useState("");
    const [type, setType] = useState("video");
    const [videoFile, setVideoFile] = useState(null);
    const [thumbFile, setThumbFile] = useState(null);
    const [videoPreview, setVideoPreview] = useState("");
    const [thumbPreview, setThumbPreview] = useState("");
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const videoInputRef = useRef(null);
    const thumbInputRef = useRef(null);
    const user = params.user;
    const navigate = useNavigate();

    const categories = [
        "Music",
        "Gaming",
        "Movies",
        "News",
        "Sports",
        "Education",
        "Entertainment",
        "Other",
    ];

    const onVideoChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setError("");
        if (!/^video\//.test(file.type)) {
            setError("Please select a valid video file.");
            e.target.value = "";
            return;
        }
        setVideoFile(file);
        setVideoPreview(URL.createObjectURL(file));
    };

    const onThumbChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setError("");
        if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) {
            setError("Please select a valid thumbnail image.");
            e.target.value = "";
            return;
        }
        setThumbFile(file);
        setThumbPreview(URL.createObjectURL(file));
    };

    const handleUpload = async () => {
        if (!videoFile) {
            setError("Please choose a video file.");
            return;
        }
        if (!title.trim()) {
            setError("Please enter a title.");
            return;
        }
        setUploading(true);
        setError("");
        setSuccess("");
        setProgress(0);
        const metadata = {
            title,
            description,
            tags,
            category,
            type,
            user_id: user.channel_id,
            duration: 0,
        };

        try {
            if (await cloudinaryIsAvailable()) {
                const videoResult = await cloudinaryChunkedUpload(
                    videoFile,
                    "video",
                    setProgress
                );
                setProgress(100);
                let thumbnail_link = "";
                if (thumbFile) {
                    const thumbResult = await cloudinaryChunkedUpload(
                        thumbFile,
                        "image",
                        () => {}
                    );
                    thumbnail_link =
                        (thumbResult && thumbResult.secure_url) || "";
                }
                await uploadApi.completeVideoUpload({
                    ...metadata,
                    link: (videoResult && videoResult.secure_url) || "",
                    thumbnail_link,
                });
            } else {
                await uploadApi.uploadVideo(videoFile, thumbFile, metadata);
            }
            setSuccess("Upload started! Track progress in Your channel.");
            setTimeout(() => {
                if (params.onClose) params.onClose();
                if (params.onUploaded) params.onUploaded();
                navigate(`/uploads`);
            }, 800);
        } catch (err) {
            console.error("Upload error:", err);
            setError(err.message || "Upload failed. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="upload-overlay" onClick={params.onClose}>
            <div
                className="upload-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="upload-modal-header">
                    <h2>Upload video</h2>
                    <button
                        className="upload-close"
                        onClick={params.onClose}
                    >
                        X
                    </button>
                </div>
                <div className="upload-modal-body">
                    <div className="upload-field">
                        <label>Video file</label>
                        <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/*"
                            onChange={onVideoChange}
                        />
                        {videoPreview ? (
                            <video
                                className="upload-video-preview"
                                src={videoPreview}
                                controls
                            />
                        ) : null}
                    </div>
                    <div className="upload-field">
                        <label>Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Video title"
                        />
                    </div>
                    <div className="upload-field">
                        <label>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe your video"
                            rows="3"
                        />
                    </div>
                    <div className="upload-field">
                        <label>Tags (comma separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="tag1, tag2, tag3"
                        />
                    </div>
                    <div className="upload-field-2col">
                        <div className="upload-field">
                            <label>Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            >
                                <option value="">Select category</option>
                                {categories.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="upload-field">
                            <label>Type</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                            >
                                <option value="video">Video</option>
                                <option value="short">Short</option>
                            </select>
                        </div>
                    </div>
                    <div className="upload-field">
                        <label>Thumbnail (optional)</label>
                        <input
                            ref={thumbInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/gif,image/webp"
                            onChange={onThumbChange}
                        />
                        {thumbPreview ? (
                            <img
                                className="upload-thumb-preview"
                                src={thumbPreview}
                                alt="thumbnail"
                            />
                        ) : null}
                    </div>
                    {error ? <p className="upload-error">{error}</p> : null}
                    {uploading ? (
                        <div className="upload-progress-block">
                            <div className="upload-progress-bar">
                                <div
                                    className="upload-progress-fill"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="upload-progress-text">
                                Uploading… {progress}%
                            </p>
                        </div>
                    ) : null}
                    {success ? (
                        <p className="upload-success">{success}</p>
                    ) : null}
                </div>
                <div className="upload-modal-footer">
                    <button
                        className="upload-cancel"
                        onClick={params.onClose}
                        disabled={uploading}
                    >
                        Cancel
                    </button>
                    <button
                        className="upload-submit"
                        onClick={handleUpload}
                        disabled={uploading}
                    >
                        {uploading ? "Uploading..." : "Upload"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadVideo;
