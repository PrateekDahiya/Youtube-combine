import React, { useEffect, useState } from "react";
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

const normalizeNative = (c) => ({
    key: `native-${c.comment_id}`,
    commentId: c.comment_id,
    source: "native",
    userId: c.user_id,
    author: c.channel_name || "Unknown",
    avatar: c.channel_icon,
    text: c.comment_text,
    time: c.comment_time,
    edited: !!c.updated_at,
    likeCount: 0,
});

const normalizeYoutube = (c) => ({
    key: `youtube-${c.id}`,
    commentId: c.id,
    source: "youtube",
    userId: null,
    author: c.author,
    avatar: c.authorAvatar,
    text: c.text,
    time: c.publishedAt,
    edited: false,
    likeCount: c.likeCount || 0,
});

const sortByTimeDesc = (list) =>
    [...list].sort((a, b) => new Date(b.time) - new Date(a.time));

const Comments = (params) => {
    const videoId = params.videoId;
    const user = params.user;
    const isGuest = !user || user === "Guest";
    const toast = useToast();

    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newText, setNewText] = useState("");
    const [posting, setPosting] = useState(false);
    const [editingKey, setEditingKey] = useState(null);
    const [editingText, setEditingText] = useState("");
    const [savingEdit, setSavingEdit] = useState(false);
    const [ytNextPageToken, setYtNextPageToken] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        if (!videoId) return;
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            const [nativeResult, youtubeResult] = await Promise.allSettled([
                commentApi.getComments(videoId),
                commentApi.getYoutubeComments(videoId),
            ]);
            if (cancelled) return;

            const native =
                nativeResult.status === "fulfilled"
                    ? (nativeResult.value.comments || []).map(normalizeNative)
                    : [];
            const youtube =
                youtubeResult.status === "fulfilled" && !youtubeResult.value.disabled
                    ? (youtubeResult.value.comments || []).map(normalizeYoutube)
                    : [];

            if (nativeResult.status === "rejected") {
                console.error("Error fetching comments:", nativeResult.reason.message);
            }
            if (youtubeResult.status === "rejected") {
                console.error("Error fetching YouTube comments:", youtubeResult.reason.message);
            }

            setComments(sortByTimeDesc([...native, ...youtube]));
            setYtNextPageToken(
                youtubeResult.status === "fulfilled" ? youtubeResult.value.nextPageToken || null : null
            );
            setLoading(false);
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [videoId]);

    const loadMoreYoutube = async () => {
        if (!ytNextPageToken) return;
        setLoadingMore(true);
        try {
            const response = await commentApi.getYoutubeComments(videoId, ytNextPageToken);
            const more = (response.comments || []).map(normalizeYoutube);
            setComments((prev) => sortByTimeDesc([...prev, ...more]));
            setYtNextPageToken(response.nextPageToken || null);
        } catch (error) {
            console.error("Error fetching more YouTube comments:", error.message);
        } finally {
            setLoadingMore(false);
        }
    };

    const handlePost = async () => {
        const text = newText.trim();
        if (!text || isGuest) return;
        setPosting(true);
        try {
            const response = await commentApi.addComment(videoId, user.channel_id, text);
            if (response.comment) {
                setComments((prev) => [normalizeNative(response.comment), ...prev]);
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
        setEditingKey(comment.key);
        setEditingText(comment.text);
    };

    const cancelEdit = () => {
        setEditingKey(null);
        setEditingText("");
    };

    const saveEdit = async (comment) => {
        const text = editingText.trim();
        if (!text) return;
        setSavingEdit(true);
        try {
            await commentApi.editComment(comment.commentId, user.channel_id, text);
            setComments((prev) =>
                prev.map((c) => (c.key === comment.key ? { ...c, text, edited: true } : c))
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
            await commentApi.deleteComment(comment.commentId, user.channel_id);
            setComments((prev) => prev.filter((c) => c.key !== comment.key));
            if (toast) toast.showToast("Comment deleted.", "success");
        } catch (error) {
            console.error("Error deleting comment:", error.message);
            if (toast) toast.showToast(error.message || "Failed to delete comment.", "error");
        }
    };

    return (
        <div className="comments-section">
            <h3 className="comments-heading">
                Comments {comments.length ? `(${comments.length})` : ""}
            </h3>

            {!isGuest ? (
                <div className="comment-composer">
                    <img className="comment-avatar" src={user.channel_icon || defaultAvatar} alt="" />
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
                <>
                    <div className="comments-list">
                        {comments.map((comment) => (
                            <div className="comment-item" key={comment.key}>
                                <img
                                    className="comment-avatar"
                                    src={comment.avatar || defaultAvatar}
                                    alt=""
                                />
                                <div className="comment-body">
                                    <div className="comment-meta">
                                        <span className="comment-author">{comment.author}</span>
                                        <span className="comment-time">
                                            {getDateDifference(new Date(), new Date(comment.time))}
                                            {comment.edited ? " (edited)" : ""}
                                        </span>
                                    </div>
                                    {editingKey === comment.key ? (
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
                                        <>
                                            <p className="comment-text">{comment.text}</p>
                                            {comment.likeCount ? (
                                                <span className="comment-likes">
                                                    👍 {formatCount(comment.likeCount)}
                                                </span>
                                            ) : null}
                                        </>
                                    )}
                                </div>
                                {!isGuest &&
                                comment.source === "native" &&
                                user.channel_id === comment.userId &&
                                editingKey !== comment.key ? (
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
                    {ytNextPageToken ? (
                        <button
                            className="comments-load-more"
                            onClick={loadMoreYoutube}
                            disabled={loadingMore}
                        >
                            {loadingMore ? "Loading…" : "Load more"}
                        </button>
                    ) : null}
                </>
            )}
        </div>
    );
};

export default Comments;
