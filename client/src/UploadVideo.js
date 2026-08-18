import React, { useRef, useState } from "react";
import { uploadApi, videoApi } from "./api";
import { useNavigate } from "react-router-dom";
import { useToast } from "./ToastContext";
import Modal from "./Modal";
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
    const [thumbnailLink, setThumbnailLink] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const videoInputRef = useRef(null);
    const thumbInputRef = useRef(null);
    const user = params.user;
    const navigate = useNavigate();
    const toast = useToast();

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
        e.target.value = "";
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

        const promise = uploadApi
            .uploadImage(file)
            .then((res) => {
                setThumbnailLink(res.url);
                if (toast) toast.showToast("Thumbnail uploaded!", "success");
                return res;
            })
            .catch((err) => {
                console.error("Thumbnail upload error:", err);
                setError(err.message || "Failed to upload thumbnail.");
                throw err;
            });
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
        setError("");
        setSubmitting(true);
        try {
            const res = await uploadApi.uploadVideo(videoFile, thumbFile, {
                title: title.trim() || "Untitled",
                description,
                tags,
                category,
                type,
                user_id: user.channel_id,
                duration: 0,
            });
            const id = res.video_id;

            if (thumbFile) {
                const thumbRes = await uploadApi.uploadImage(thumbFile);
                await videoApi.updateVideo({
                    video_id: id,
                    user_id: user.channel_id,
                    title,
                    description,
                    tags,
                    category,
                    isShort: type,
                    thumbnail_link: thumbRes.url,
                });
            }

            if (toast) toast.showToast("Video uploaded successfully!", "success");
            if (params.onUploaded) params.onUploaded();
            if (params.onClose) params.onClose();
            navigate(`/uploads`);
        } catch (err) {
            console.error("Upload error:", err);
            setError(err.message || "Upload failed. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const footer = (
        <>
            <button
                className="upload-btn upload-cancel"
                onClick={params.onClose}
                disabled={submitting}
            >
                Cancel
            </button>
            <button
                className="upload-btn upload-submit"
                onClick={handleUpload}
                disabled={submitting}
            >
                {submitting ? "Uploading…" : "Upload"}
            </button>
        </>
    );

    return (
        <Modal
            isOpen
            onClose={params.onClose}
            title="Upload video"
            size="large"
            footer={footer}
        >
            <div className="upload-form">
                <div className="upload-field">
                    <label>Video file</label>
                    <div
                        className="dropzone"
                        onClick={() => videoInputRef.current?.click()}
                    >
                        <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/*"
                            onChange={onVideoChange}
                        />
                        <span className="dropzone-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
                            </svg>
                        </span>
                        <span className="dropzone-text">
                            {videoFile
                                ? videoFile.name
                                : "Click to select a video file"}
                        </span>
                        <span className="dropzone-hint">
                            MP4, WebM, MOV, or any format YouTube supports
                        </span>
                    </div>
                    {videoPreview ? (
                        <video
                            className="upload-preview upload-video-preview"
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
                        placeholder="Give your video a title"
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
                            {thumbFile
                                ? thumbFile.name
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
            </div>
        </Modal>
    );
};

export default UploadVideo;
