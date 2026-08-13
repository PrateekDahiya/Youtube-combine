import React, { useState, useRef } from "react";
import axios from "axios";
import "./UploadVideo.css";

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
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const videoInputRef = useRef(null);
    const thumbInputRef = useRef(null);
    const serverurl = process.env.REACT_APP_SERVER_URL;
    const user = params.user;

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
        const formData = new FormData();
        formData.append("video", videoFile);
        if (thumbFile) formData.append("thumbnail", thumbFile);
        formData.append("title", title);
        formData.append("description", description);
        formData.append("tags", tags);
        formData.append("category", category);
        formData.append("type", type);
        formData.append("user_id", user.channel_id);
        formData.append("duration", 0);

        try {
            const response = await axios.post(
                `${serverurl}/uploadVideo`,
                formData,
                { headers: { "Content-Type": "multipart/form-data" } }
            );
            if (response.status === 200) {
                setSuccess("Video uploaded successfully!");
                setTimeout(() => {
                    if (params.onClose) params.onClose();
                    if (params.onUploaded) params.onUploaded();
                }, 1200);
            }
        } catch (err) {
            console.error("Upload error:", err);
            setError(
                (err.response && err.response.data && err.response.data.error) ||
                    "Upload failed. Please try again."
            );
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
