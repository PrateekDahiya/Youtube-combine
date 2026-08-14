import React, { useState, useRef } from "react";
import { videoApi, uploadApi } from "./api";
import Modal from "./Modal";
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
    const thumbInputRef = useRef(null);

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
            setThumbnail(response.url);
        } catch (uploadErr) {
            console.error("Thumbnail upload error:", uploadErr);
            setError(uploadErr.message || "Failed to upload thumbnail.");
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
            await videoApi.updateVideo({
                video_id: video.video_id,
                user_id: user.channel_id,
                title,
                description,
                tags,
                category,
                isShort: type,
                thumbnail_link: thumbnail,
            });
            setSuccess("Video updated!");
            setTimeout(() => {
                if (params.onClose) params.onClose();
                if (params.onUpdated) params.onUpdated();
            }, 800);
        } catch (err) {
            console.error("Update error:", err);
            setError(err.message || "Update failed. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const footer = (
        <>
            <button
                className="upload-btn upload-cancel"
                onClick={params.onClose}
                disabled={saving}
            >
                Cancel
            </button>
            <button
                className="upload-btn upload-submit"
                onClick={handleSave}
                disabled={saving}
            >
                {saving ? "Saving…" : "Save"}
            </button>
        </>
    );

    return (
        <Modal
            isOpen
            onClose={params.onClose}
            title="Edit video"
            size="large"
            footer={footer}
        >
            <div className="upload-form">
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
                    <div
                        className="dropzone"
                        onClick={() => thumbInputRef.current?.click()}
                    >
                        <input
                            ref={thumbInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/gif,image/webp"
                            onChange={onThumbChange}
                        />
                        <span className="dropzone-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                            </svg>
                        </span>
                        <span className="dropzone-text">
                            {thumbPreview
                                ? "Click to change thumbnail"
                                : "Click to select a thumbnail"}
                        </span>
                        <span className="dropzone-hint">
                            PNG, JPEG, GIF or WebP
                        </span>
                    </div>
                    {thumbPreview ? (
                        <img
                            className="upload-preview upload-thumb-preview"
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
        </Modal>
    );
};

export default EditVideo;