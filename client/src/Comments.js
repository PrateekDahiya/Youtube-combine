import React, { useEffect, useState, useCallback } from "react";
import { commentApi } from "./api";
import { useToast } from "./ToastContext";
import "./Comments.css";

const defaultAvatar = "https://cdn-icons-png.flaticon.com/128/1077/1077063.png";

const getDateDifference = (date1, date2) => {
    if (!date1 || !date2) return "";
    const differenceMs = Math.abs(date1 - date2);
    const units = [
        ["year", 365 * 24 * 60 * 60 * 1000],
        ["month", 30 * 24 * 60 * 60 * 1000],
        ["week", 7 * 24 * 60 * 60 * 1000],
        ["day", 24 * 60 * 60 * 1000],
        ["hour", 60 * 60 * 1000],
        ["minute", 60 * 1000],
        ["second", 1000],
    ];
    for (const [label, ms] of units) {
        const value = Math.floor(differenceMs / ms);
        if (value > 0) return `${value} ${label}${value === 1 ? "" : "s"} ago`;
    }
    return "just now";
};

const formatCount = (num) => {
    if (!num) return "";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return String(num);
};

const Comments = (params) => {
    const videoId = params.videoId;
    const user = params.user;
    const isGuest = !user || user === "Guest";
    const toast = useToast();

    const [tab, setTab] = useState("native");

    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newText, setNewText] = useState("");
    const [posting, setPosting] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editingText, setEditingText] = useState("");
    const [savingEdit, setSavingEdit] = useState(false);

    const [ytComments, setYtComments] = useState(null);
    const [ytLoading, setYtLoading] = useState(false);
    const [ytError, setYtError] = useState("");
    const [ytDisabled, setYtDisabled] = useState(false);
    const [ytNextPageToken, setYtNextPageToken] = useState(null);
    const [ytLoadingMore, setYtLoadingMore] = useState(false);

    const fetchComments = useCallback(async () => {
        if (!videoId) return;
        try {
            const response = await commentApi.getComments(videoId);
            setComments(response.comments || []);
        } catch (error) {
            console.error("Error fetching comments:", error.message);
        } finally {
            setLoading(false);
        }
    }, [videoId]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    const fetchYoutubeComments = useCallback(
        async (pageToken) => {
            if (!videoId) return;
            if (pageToken) setYtLoadingMore(true);
            else setYtLoading(true);
            setYtError("");
            try {
                const response = await commentApi.getYoutubeComments(videoId, pageToken);
                setYtDisabled(!!response.disabled);
                setYtNextPageToken(response.nextPageToken || null);
                setYtComments((prev) =>
                    pageToken ? [...(prev || []), ...(response.comments || [])] : response.comments || []
                );
            } catch (error) {
                console.error("Error fetching YouTube comments:", error.message);
                setYtError(error.message || "Failed to load YouTube comments.");
            } finally {
                setYtLoading(false);
                setYtLoadingMore(false);
            }
        },
        [videoId]
    );

    const handleTabChange = (nextTab) => {
        setTab(nextTab);
        if (nextTab === "youtube" && ytComments === null && !ytLoading) {
            fetchYoutubeComments(null);
        }
    };

    const handlePost = async () => {
        const text = newText.trim();
        if (!text || isGuest) return;
        setPosting(true);
        try {
            const response = await commentApi.addComment(videoId, user.channel_id, text);
            if (response.comment) {
                setComments((prev) => [response.comment, ...prev]);
            } else {
                fetchComments();
            }
            setNewText("");
            if (toast) toast.showToast("Comment posted!", "success");
        } catch (error) {
            console.error("Error posting comment:", error.message);
            if (toast) toast.showToast(error.message || "Failed to post comment.", "error");
        } finally {
            setPosting(false);
        }
    };

    const startEdit = (comment) => {
        setEditingId(comment.comment_id);
        setEditingText(comment.comment_text);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingText("");
    };

    const saveEdit = async (comment) => {
        const text = editingText.trim();
        if (!text) return;
        setSavingEdit(true);
        try {
            await commentApi.editComment(comment.comment_id, user.channel_id, text);
            setComments((prev) =>
                prev.map((c) =>
                    c.comment_id === comment.comment_id
                        ? { ...c, comment_text: text, updated_at: new Date().toISOString() }
                        : c
                )
            );
            cancelEdit();
            if (toast) toast.showToast("Comment updated!", "success");
        } catch (error) {
            console.error("Error updating comment:", error.message);
            if (toast) toast.showToast(error.message || "Failed to update comment.", "error");
        } finally {
            setSavingEdit(false);
        }
    };

    const deleteComment = async (comment) => {
        try {
            await commentApi.deleteComment(comment.comment_id, user.channel_id);
            setComments((prev) => prev.filter((c) => c.comment_id !== comment.comment_id));
            if (toast) toast.showToast("Comment deleted.", "success");
        } catch (error) {
            console.error("Error deleting comment:", error.message);
            if (toast) toast.showToast(error.message || "Failed to delete comment.", "error");
        }
    };

    return (
        <div className="comments-section">
            <div className="comments-tabs">
                <button
                    className={"comments-tab" + (tab === "native" ? " active" : "")}
                    onClick={() => handleTabChange("native")}
                >
                    Comments {comments.length ? `(${comments.length})` : ""}
                </button>
                <button
                    className={"comments-tab" + (tab === "youtube" ? " active" : "")}
                    onClick={() => handleTabChange("youtube")}
                >
                    YouTube comments
                </button>
            </div>

            {tab === "native" ? (
                <div className="comments-native">
                    {!isGuest ? (
                        <div className="comment-composer">
                            <img
                                className="comment-avatar"
                                src={user.channel_icon || defaultAvatar}
                                alt=""
                            />
                            <div className="comment-composer-input">
                                <textarea
                                    value={newText}
                                    onChange={(e) => setNewText(e.target.value)}
                                    placeholder="Add a comment…"
                                    rows="2"
                                />
                                {newText.trim() ? (
                                    <div className="comment-composer-actions">
                                        <button
                                            className="comment-btn comment-btn-cancel"
                                            onClick={() => setNewText("")}
                                            disabled={posting}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="comment-btn comment-btn-submit"
                                            onClick={handlePost}
                                            disabled={posting}
                                        >
                                            {posting ? "Posting…" : "Comment"}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        <p className="comments-guest-hint">Sign in to add a comment.</p>
                    )}

                    {loading ? (
                        <p className="comments-empty">Loading comments…</p>
                    ) : comments.length === 0 ? (
                        <p className="comments-empty">No comments yet. Be the first to comment.</p>
                    ) : (
                        <div className="comments-list">
                            {comments.map((comment) => (
                                <div className="comment-item" key={comment.comment_id}>
                                    <img
                                        className="comment-avatar"
                                        src={comment.channel_icon || defaultAvatar}
                                        alt=""
                                    />
                                    <div className="comment-body">
                                        <div className="comment-meta">
                                            <span className="comment-author">
                                                {comment.channel_name || "Unknown"}
                                            </span>
                                            <span className="comment-time">
                                                {getDateDifference(new Date(), new Date(comment.comment_time))}
                                                {comment.updated_at ? " (edited)" : ""}
                                            </span>
                                        </div>
                                        {editingId === comment.comment_id ? (
                                            <div className="comment-edit">
                                                <textarea
                                                    value={editingText}
                                                    onChange={(e) => setEditingText(e.target.value)}
                                                    rows="2"
                                                />
                                                <div className="comment-composer-actions">
                                                    <button
                                                        className="comment-btn comment-btn-cancel"
                                                        onClick={cancelEdit}
                                                        disabled={savingEdit}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        className="comment-btn comment-btn-submit"
                                                        onClick={() => saveEdit(comment)}
                                                        disabled={savingEdit}
                                                    >
                                                        {savingEdit ? "Saving…" : "Save"}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="comment-text">{comment.comment_text}</p>
                                        )}
                                    </div>
                                    {!isGuest &&
                                    user.channel_id === comment.user_id &&
                                    editingId !== comment.comment_id ? (
                                        <div className="comment-actions">
                                            <button
                                                className="comment-action"
                                                title="Edit comment"
                                                onClick={() => startEdit(comment)}
                                            >
                                                <svg viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                                </svg>
                                            </button>
                                            <button
                                                className="comment-action comment-action-delete"
                                                title="Delete comment"
                                                onClick={() => deleteComment(comment)}
                                            >
                                                <svg viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M6 7h12l-1 13.01A2 2 0 0 1 15.01 22H8.99a2 2 0 0 1-1.99-1.99L6 7zm3-3h6l1 2H8l1-2zM4 6h16v2H4V6z" />
                                                </svg>
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="comments-youtube">
                    {ytLoading ? (
                        <p className="comments-empty">Loading YouTube comments…</p>
                    ) : ytError ? (
                        <p className="comments-empty">{ytError}</p>
                    ) : ytDisabled || !ytComments || ytComments.length === 0 ? (
                        <p className="comments-empty">
                            No YouTube comments available for this video.
                        </p>
                    ) : (
                        <>
                            <div className="comments-list">
                                {ytComments.map((comment) => (
                                    <div className="comment-item" key={comment.id}>
                                        <img
                                            className="comment-avatar"
                                            src={comment.authorAvatar || defaultAvatar}
                                            alt=""
                                        />
                                        <div className="comment-body">
                                            <div className="comment-meta">
                                                <span className="comment-author">{comment.author}</span>
                                                <span className="comment-time">
                                                    {getDateDifference(new Date(), new Date(comment.publishedAt))}
                                                </span>
                                            </div>
                                            <p className="comment-text">{comment.text}</p>
                                            {comment.likeCount ? (
                                                <span className="comment-likes">
                                                    👍 {formatCount(comment.likeCount)}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {ytNextPageToken ? (
                                <button
                                    className="comments-load-more"
                                    onClick={() => fetchYoutubeComments(ytNextPageToken)}
                                    disabled={ytLoadingMore}
                                >
                                    {ytLoadingMore ? "Loading…" : "Load more"}
                                </button>
                            ) : null}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default Comments;
