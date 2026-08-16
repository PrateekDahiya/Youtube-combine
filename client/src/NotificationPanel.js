import React, { useEffect, useState, useRef, useCallback } from "react";
import { notificationApi } from "./api";
import "./NotificationPanel.css";

const getDateDifference = (date1, date2) => {
    if (!date1 || !date2) return "";
    const differenceMs = Math.abs(new Date(date1) - new Date(date2));
    const millisecondsInSecond = 1000;
    const millisecondsInMinute = millisecondsInSecond * 60;
    const millisecondsInHour = millisecondsInMinute * 60;
    const millisecondsInDay = millisecondsInHour * 24;
    const millisecondsInWeek = millisecondsInDay * 7;
    const millisecondsInMonth = millisecondsInDay * 30;
    const millisecondsInYear = millisecondsInDay * 365;
    const years = Math.floor(differenceMs / millisecondsInYear);
    const months = Math.floor(differenceMs / millisecondsInMonth);
    const weeks = Math.floor(differenceMs / millisecondsInWeek);
    const days = Math.floor(differenceMs / millisecondsInDay);
    const hours = Math.floor(differenceMs / millisecondsInHour);
    const minutes = Math.floor(differenceMs / millisecondsInMinute);
    const seconds = Math.floor(differenceMs / millisecondsInSecond);
    let result = "";
    if (years > 0) result += years + (years === 1 ? " year" : " years");
    else if (months > 0) result += months + (months === 1 ? " month" : " months");
    else if (weeks > 0) result += weeks + (weeks === 1 ? " week" : " weeks");
    else if (days > 0) result += days + (days === 1 ? " day" : " days");
    else if (hours > 0) result += hours + (hours === 1 ? " hour" : " hours");
    else if (minutes > 0) result += minutes + (minutes === 1 ? " minute" : " minutes");
    else if (seconds > 0) result += seconds + (seconds === 1 ? " second" : " seconds");
    return result;
};

const NotificationPanel = (params) => {
    const { user, isOpen, onClose } = params;
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const panelRef = useRef(null);

    const fetchNotifications = useCallback(async () => {
        if (!user || user === "Guest") return;
        
        try {
            setLoading(true);
            const response = await notificationApi.getNotifications(user.channel_id, 20, page * 20);
            const newNotifications = response.notifications || [];
            
            if (page === 0) {
                setNotifications(newNotifications);
            } else {
                setNotifications(prev => [...prev, ...newNotifications]);
            }
            
            setHasMore(newNotifications.length === 20);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        } finally {
            setLoading(false);
        }
    }, [user, page]);

    const fetchUnreadCount = useCallback(async () => {
        if (!user || user === "Guest") return;
        
        try {
            const response = await notificationApi.getUnreadCount(user.channel_id);
            setUnreadCount(response.count || 0);
        } catch (error) {
            console.error("Error fetching unread count:", error);
        }
    }, [user]);

    useEffect(() => {
        if (isOpen && user !== "Guest") {
            fetchNotifications();
            fetchUnreadCount();
        }
    }, [isOpen, user, fetchNotifications, fetchUnreadCount]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (panelRef.current && !panelRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onClose]);

    const handleMarkAsRead = async (notificationId, index) => {
        try {
            await notificationApi.markAsRead(notificationId);
            setNotifications(prev => 
                prev.map((n, i) => i === index ? { ...n, is_read: 1 } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (!user || user === "Guest") return;
        
        try {
            await notificationApi.markAllAsRead(user.channel_id);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
            setUnreadCount(0);
        } catch (error) {
            console.error("Error marking all notifications as read:", error);
        }
    };

    const handleNotificationClick = (notification) => {
        if (!notification.is_read) {
            handleMarkAsRead(notification.notification_id, notifications.findIndex(n => n.notification_id === notification.notification_id));
        }
        
        const isShort = notification.type === "new_short";
        const targetUrl = isShort ? `/shorts?video_id=${notification.video_id}` : `/watch?video_id=${notification.video_id}`;
        window.location.href = targetUrl;
        onClose();
    };

    const loadMore = () => {
        setPage(prev => prev + 1);
        fetchNotifications();
    };

    if (!isOpen) return null;

    return (
        <div className="notification-panel-overlay" onClick={onClose}>
            <div 
                className="notification-panel" 
                ref={panelRef}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="notification-header">
                    <h3>Notifications</h3>
                    {unreadCount > 0 && (
                        <button className="mark-all-read" onClick={handleMarkAllAsRead}>
                            Mark all as read
                        </button>
                    )}
                </div>
                
                <div className="notification-list">
                    {loading && notifications.length === 0 ? (
                        <div className="notification-loading">
                            <div className="loading-spinner"></div>
                            <p>Loading notifications...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="notification-empty">
                            <img src="https://cdn-icons-png.flaticon.com/128/3545/3545699.png" alt="No notifications" />
                            <p>No notifications yet</p>
                            <span>When you subscribe to channels, their new videos will appear here</span>
                        </div>
                    ) : (
                        <>
                            {notifications.map((notification, index) => (
                                <div 
                                    key={notification.notification_id}
                                    className={`notification-item ${!notification.is_read ? "unread" : ""}`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="notification-avatar">
                                        <img 
                                            src={notification.channel_icon || "https://cdn-icons-png.flaticon.com/128/1077/1077063.png"} 
                                            alt={notification.channel_name}
                                        />
                                    </div>
                                    <div className="notification-content">
                                        <div className="notification-main">
                                            <div className="notification-title-row">
                                                <span className="notification-title">{notification.title}</span>
                                                {!notification.is_read && <span className="notification-dot"></span>}
                                            </div>
                                            <div className="notification-meta">
                                                <span className="notification-channel">{notification.channel_name}</span>
                                                <span className="notification-type">
                                                    {notification.type === "new_short" ? "Short" : "Video"}
                                                </span>
                                                <span className="notification-time">
                                                    {getDateDifference(notification.upload_time || notification.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="notification-thumbnail">
                                            <img 
                                                src={notification.thumbnail_link} 
                                                alt={notification.title}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {hasMore && (
                                <button className="load-more-btn" onClick={(e) => { e.stopPropagation(); loadMore(); }}>
                                    {loading ? "Loading..." : "Load more"}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationPanel;