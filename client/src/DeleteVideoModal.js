import React, { useState } from "react";
import { videoApi } from "./api";
import { useToast } from "./ToastContext";
import Modal from "./Modal";
import "./UploadVideo.css";

const DeleteVideoModal = (params) => {
    const video = params.video;
    const user = params.user;
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState("");
    const toast = useToast();

    const handleDelete = async () => {
        setDeleting(true);
        setError("");
        try {
            await videoApi.deleteVideo(video.video_id, user.channel_id);
            if (toast) toast.showToast("Video deleted.", "success");
            if (params.onDeleted) params.onDeleted(video);
            if (params.onClose) params.onClose();
        } catch (err) {
            console.error("Delete video error:", err);
            setError(err.message || "Failed to delete video. Please try again.");
            setDeleting(false);
        }
    };

    const footer = (
        <>
            <button
                className="upload-btn upload-cancel"
                onClick={params.onClose}
                disabled={deleting}
            >
                Cancel
            </button>
            <button
                className="upload-btn upload-delete"
                onClick={handleDelete}
                disabled={deleting}
            >
                {deleting ? "Deleting…" : "Delete"}
            </button>
        </>
    );

    return (
        <Modal
            isOpen
            onClose={params.onClose}
            title="Delete video"
            size="small"
            closeOnBackdrop={!deleting}
            closeOnEscape={!deleting}
            footer={footer}
        >
            <p>
                Are you sure you want to delete{" "}
                <strong>{video.title || "this video"}</strong>? This can&apos;t
                be undone.
            </p>
            {error ? <p className="upload-error">{error}</p> : null}
        </Modal>
    );
};

export default DeleteVideoModal;
