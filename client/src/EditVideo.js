import React, { useState } from "react";
import { videoApi, uploadApi } from "./api";
import "./UploadVideo.css";

const EditVideo = (params) => {
    const video = params.video;
    const user = params.user;
    const [title, setTitle] = useState(video.title || "");
    const [description, setDescription] = useState(
        video.video_description || ""
    );
    const [tags, setTags] = useState(video.tags || "");
    const [category, setCategory] = useState(video.category || "");
    const [type, setType] = useState(video.isShort === 1 ? "short" : "video");
    const initialThumb =
        video.thumbnail_link ||
        (video.link && video.link.includes("res.cloudinary.com")
            ? video.link.replace(/\.[a-zA-Z0-9]+$/, ".jpg")
            : "");
    const [thumbnail, setThumbnail] = useState(initialThumb);
    const [thumbPreview, setThumbPreview] = useState(initialThumb);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

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

    const onThumbChange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        setError("");
        if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) {
            setError("Please select a valid thumbnail image.");
            e.target.value = "";
            return;
        }
        setThumbPreview(URL.createObjectURL(file));
        try {
            const response = await uploadApi.uploadImage(file);
            setThumbnail(response.data.url);
        } catch (uploadErr) {
            console.error("Thumbnail upload error:", uploadErr);
            setError(
                (uploadErr.response &&
                    uploadErr.response.data &&
                    uploadErr.response.data.error) ||
                    "Failed to upload thumbnail."
            );
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            setError("Please enter a title.");
            return;
        }
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            const response = await videoApi.updateVideo({
                video_id: video.video_id,
                user_id: user.channel_id,
                title,
                description,
                tags,
                category,
                isShort: type,
                thumbnail_link: thumbnail,
            });
            if (response.status === 200) {
                setSuccess("Video updated!");
                setTimeout(() => {
                    if (params.onClose) params.onClose();
                    if (params.onUpdated) params.onUpdated();
                }, 800);
            }
        } catch (err) {
            console.error("Update error:", err);
            setError(
                (err.response && err.response.data && err.response.data.error) ||
                    "Update failed. Please try again."
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="upload-overlay" onClick={params.onClose}>
            <div
                className="upload-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="upload-modal-header">
                    <h2>Edit video</h2>
                    <button
                        className="upload-close"
                        onClick={params.onClose}
                    >
                        X
                    </button>
                </div>
                <div className="upload-modal-body">
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
                        <label>Thumbnail</label>
                        <input
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
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        className="upload-submit"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditVideo;
