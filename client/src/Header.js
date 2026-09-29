import React, { useContext, useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { ThemeContext } from "./ThemeContext.js";
import { Link } from "react-router-dom";
import { feedApi, notificationApi } from "./api";
import "./Header.css";
import "./themes.css";
import UploadVideo from "./UploadVideo";
import NotificationPanel from "./NotificationPanel";
import { avatarFallback, thumbFallback, handleImgError } from "./imgFallback";

const Header = (params) => {
    const locationHook = useLocation();
    const [query, setQuery] = useState(
        () => new URLSearchParams(window.location.search).get("query") || ""
    );
    const { theme, toggleTheme } = useContext(ThemeContext);
    const [page, setPage] = useState(locationHook.pathname);
    const user = params.user;
    const [isprofilemenu, setIsprofilemenu] = useState(false);
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeSuggestion, setActiveSuggestion] = useState(-1);
    const suggestAbortRef = useRef(null);
    const suggestTimerRef = useRef(null);
    const searchRef = useRef(null);
    const profileMenuRef = useRef(null);
    const notificationBellRef = useRef(null);

    const toggleDropdown = () => {
        setIsprofilemenu(!isprofilemenu);
    };

    const toggleNotifications = () => {
        setNotificationsOpen(!notificationsOpen);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setIsprofilemenu(false);
            }
            if (notificationBellRef.current && !notificationBellRef.current.contains(event.target)) {
                setNotificationsOpen(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const currentpage = locationHook.pathname;
        setPage(currentpage);
        if (currentpage === "/search") {
            setQuery(new URLSearchParams(locationHook.search).get("query") || "");
        }
    }, [locationHook]);

    useEffect(() => {
        if (user !== "Guest") {
            const fetchUnreadCount = async () => {
                try {
                    const response = await notificationApi.getUnreadCount(user.channel_id);
                    setUnreadCount(response.count || 0);
                } catch (error) {
                    console.error("Error fetching unread count:", error);
                }
            };
            fetchUnreadCount();
            const interval = setInterval(fetchUnreadCount, 60000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (query !== "") {
            window.location.href = "/search?query=" + encodeURIComponent(query);
            setIsSearchVisible(false);
            setShowSuggestions(false);
        }
    };

    const goToSuggestion = (item) => {
        setShowSuggestions(false);
        setIsSearchVisible(false);
        if (item.kind === "channel" && item.ref_id) {
            window.location.href = `/channel?channel_id=${item.ref_id}`;
        } else if (item.kind === "video" && item.ref_id) {
            window.location.href = item.isShort === 1
                ? `/shorts?video_id=${item.ref_id}`
                : `/watch?video_id=${item.ref_id}`;
        } else {
            window.location.href = "/search?query=" + encodeURIComponent(item.term);
        }
    };

    useEffect(() => {
        if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
        if (suggestAbortRef.current) suggestAbortRef.current.abort();
        const term = query.trim();
        if (term.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            setActiveSuggestion(-1);
            return;
        }
        const controller = new AbortController();
        suggestAbortRef.current = controller;
        suggestTimerRef.current = setTimeout(async () => {
            try {
                const response = await feedApi.getSuggestions(term, controller.signal);
                if (!controller.signal.aborted) {
                    setSuggestions(response.suggestions || []);
                    setShowSuggestions(true);
                    setActiveSuggestion(-1);
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.log("Error fetching suggestions:", error.message);
                }
            }
        }, 250);
        return () => {
            clearTimeout(suggestTimerRef.current);
            controller.abort();
        };
    }, [query]);

    const handleSearchKeyDown = (e) => {
        if (!showSuggestions || suggestions.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveSuggestion((prev) => (prev + 1) % suggestions.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveSuggestion((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === "Enter" && activeSuggestion >= 0) {
            e.preventDefault();
            goToSuggestion(suggestions[activeSuggestion]);
        } else if (e.key === "Escape") {
            setShowSuggestions(false);
            setActiveSuggestion(-1);
        }
    };

    useEffect(() => {
        document.body.className = theme;
    }, [theme]);

    return (
        <div className="head">
            <div className="iconntitle">
                <button
                    className="toggle-menu"
                    onClick={() => {
                        params.onClick(
                            page === "/login" || page === "/watch"
                                ? "toggle2"
                                : "toggle1"
                        );
                    }}
                >
                    <img
                        src="https://cdn-icons-png.flaticon.com/128/1828/1828859.png"
                        alt="toggle-menu"
                        title="Toggle Menu"
                    />
                </button>
                <Link to="/" className="youtube-btn">
                    <img
                        src="https://cdn-icons-png.flaticon.com/128/1384/1384060.png"
                        alt="youtube"
                    />
                    <p>VidVault</p>
                </Link>
            </div>

            <div className="search-container" ref={searchRef}>
                <form
                    onSubmit={handleSearch}
                    className={`search-form ${isSearchVisible ? 'show' : ''}`}
                >
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        onFocus={() => {
                            if (suggestions.length > 0 && query.trim().length >= 2) {
                                setShowSuggestions(true);
                            }
                        }}
                        placeholder="Search"
                        className="search"
                        autoComplete="off"
                    />
                    {showSuggestions && suggestions.length > 0 ? (
                        <div className="suggest-dropdown">
                            {suggestions.map((item, index) => (
                                <div
                                    key={`${item.kind}-${item.term}-${index}`}
                                    className={"suggest-item suggest-" + item.kind + (index === activeSuggestion ? " active" : "")}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        goToSuggestion(item);
                                    }}
                                    onMouseEnter={() => setActiveSuggestion(index)}
                                >
                                    {item.kind === "channel" ? (
                                        <img
                                            className="suggest-avatar"
                                            src={item.channel_icon || avatarFallback()}
                                            alt=""
                                            onError={handleImgError(avatarFallback)}
                                        />
                                    ) : item.kind === "video" ? (
                                        <img
                                            className="suggest-thumb"
                                            src={item.thumbnail_link || thumbFallback()}
                                            alt=""
                                            onError={handleImgError(thumbFallback)}
                                        />
                                    ) : (
                                        <span className="suggest-search-icon">
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                                <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
                                            </svg>
                                        </span>
                                    )}
                                    <span className="suggest-term">
                                        <b>{item.term.substring(0, query.trim().length)}</b>
                                        {item.term.substring(query.trim().length)}
                                    </span>
                                    <span className="suggest-kind-label">
                                        {item.kind === "channel"
                                            ? "Channel"
                                            : item.kind === "video"
                                                ? (item.isShort === 1 ? "Short" : "Video")
                                                : "Search"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                    <button type="submit" className="searchbutton">
                        <img
                            src="https://cdn-icons-png.flaticon.com/128/2811/2811806.png"
                            alt="search"
                            title="Search"
                        />
                    </button>
                </form>
                <button 
                    className="mobile-search-toggle"
                    onClick={() => setIsSearchVisible(!isSearchVisible)}
                >
                    <img
                        src="https://cdn-icons-png.flaticon.com/128/2811/2811806.png"
                        alt="search"
                        title="Search"
                    />
                </button>
            </div>

            <div className="profile">
                <div className="login-profile">
                    {params.user !== "Guest" ? (
                        <>
                            <button
                                className="create-pill"
                                title="Create"
                                onClick={() => setShowUpload(true)}
                            >
                                <span className="create-plus">+</span>
                                <span className="create-label">Create</span>
                            </button>
                            <div className="notification-bell-wrapper" ref={notificationBellRef}>
                                <button
                                    className="notification-bell"
                                    onClick={toggleNotifications}
                                    aria-label="Notifications"
                                >
                                    <img
                                        src="https://cdn-icons-png.flaticon.com/128/2645/2645890.png"
                                        alt="Notifications"
                                    />
                                    {unreadCount > 0 && (
                                        <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                                    )}
                                </button>
                                <NotificationPanel
                                    user={user}
                                    isOpen={notificationsOpen}
                                    onClose={() => setNotificationsOpen(false)}
                                />
                            </div>
                            <img
                                className="profilepic"
                                src={user.channel_icon || avatarFallback()}
                                title={user.username}
                                alt="Profile"
                                onClick={toggleDropdown}
                                onError={handleImgError(avatarFallback)}
                            />
                            <div
                                ref={profileMenuRef}
                                className={`dropdown-menu ${isprofilemenu ? 'show' : ''}`}
                            >
                                <div className="profile-box">
                                    <img
                                        className="profile-box-img"
                                        src={user.channel_icon || avatarFallback()}
                                        alt="profile"
                                        onError={handleImgError(avatarFallback)}
                                    ></img>
                                    <div>
                                        <p className="profile-box-text">
                                            {user.username}
                                        </p>
                                        <p className="profile-box-text">
                                            {user.custom_url}
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    to="/me"
                                    style={{ textDecoration: "none" }}
                                >
                                    <div className="dropdown-menu-item">
                                        <img
                                            className="dropdown-menu-item-img"
                                            src="https://cdn-icons-png.flaticon.com/128/456/456212.png"
                                            alt="Logout"
                                        />
                                        <p className="dropdown-menu-item-text">
                                            View profile
                                        </p>
                                    </div>
                                </Link>
                                <Link
                                    to="/yourchannel"
                                    style={{ textDecoration: "none" }}
                                >
                                    <div className="dropdown-menu-item">
                                        <img
                                            className="dropdown-menu-item-img"
                                            src="https://cdn-icons-png.flaticon.com/128/2989/2989849.png"
                                            alt="YourChannel"
                                        />
                                        <p className="dropdown-menu-item-text">
                                            Your channel
                                        </p>
                                    </div>
                                </Link>
                                <div
                                    className="dropdown-menu-item"
                                    onClick={toggleTheme}
                                >
                                    <img
                                        className="dropdown-menu-item-img"
                                        src="https://cdn-icons-png.flaticon.com/128/12377/12377255.png"
                                        alt="Toogle Theme"
                                    />
                                    <p className="dropdown-menu-item-text">
                                        Appearance:{" "}
                                        {theme === "light"
                                            ? "Light"
                                            : "Dark"}
                                    </p>
                                </div>
                                <div className="dropdown-menu-item">
                                    <img
                                        className="dropdown-menu-item-img"
                                        src="https://cdn-icons-png.flaticon.com/128/2838/2838912.png"
                                        alt="Location"
                                    />
                                    <p className="dropdown-menu-item-text">
                                        Location: {user.location}
                                    </p>
                                </div>
                                <Link
                                    to="/settings"
                                    style={{ textDecoration: "none" }}
                                >
                                    <div className="dropdown-menu-item">
                                        <img
                                            className="dropdown-menu-item-img"
                                            src="https://cdn-icons-png.flaticon.com/128/2040/2040504.png"
                                            alt="Settings"
                                        />
                                        <p className="dropdown-menu-item-text">
                                            Settings
                                        </p>
                                    </div>
                                </Link>
                                <Link
                                    to="/login?type=logout"
                                    style={{ textDecoration: "none" }}
                                >
                                    <div className="dropdown-menu-item">
                                        <img
                                            className="dropdown-menu-item-img"
                                            src="https://cdn-icons-png.flaticon.com/128/12377/12377255.png"
                                            alt="Logout"
                                        />
                                        <p className="dropdown-menu-item-text">
                                            Logout
                                        </p>
                                    </div>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <div className="header-guest-menu">
                            <img
                                className="toogle-theme"
                                src="https://cdn-icons-png.flaticon.com/128/12377/12377255.png"
                                alt="Toogle Theme"
                                title="Toogle Theme"
                                onClick={toggleTheme}
                            />
                            <Link
                                to="/login"
                                style={{ textDecoration: "none" }}
                            >
                                <button className="sign_in">
                                    <img
                                        src="https://cdn-icons-png.flaticon.com/128/1077/1077063.png"
                                        alt="user"
                                        title="Sign In"
                                    />
                                    Sign In
                                </button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
            {showUpload ? (
                <UploadVideo
                    user={user}
                    onClose={() => setShowUpload(false)}
                />
            ) : null}
        </div>
    );
};

export default Header;
