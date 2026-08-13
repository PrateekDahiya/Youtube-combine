import React, { useContext, useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { ThemeContext } from "./ThemeContext.js";
import { Link } from "react-router-dom";
import "./Header.css";
import "./themes.css";
import UploadVideo from "./UploadVideo";

const defaultAvatar = "https://cdn-icons-png.flaticon.com/128/1077/1077063.png";

const Header = (params) => {
    const locationHook = useLocation();
    const [query, setQuery] = useState("");
    const { theme, toggleTheme } = useContext(ThemeContext);
    const [page, setPage] = useState(locationHook.pathname);
    const user = params.user;
    const [isprofilemenu, setIsprofilemenu] = useState(false);
    const [profilemenuhover, setProfilemenuhover] = useState(false);
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const searchRef = useRef(null);
    const profileMenuRef = useRef(null);

    const toggleDropdown = () => {
        setIsprofilemenu(!isprofilemenu);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setIsprofilemenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const currentpage = locationHook.pathname;
        setPage(currentpage);
    }, [locationHook]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (query !== "") {
            window.location.href = "/search?query=" + query;
            setIsSearchVisible(false);
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
                        placeholder="Search"
                        className="search"
                    />
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
                            <img
                                className="create"
                                src="https://cdn-icons-png.flaticon.com/128/4189/4189286.png"
                                alt="Create"
                                title="Create"
                                onClick={() => setShowUpload(true)}
                            />
                            <img
                                className="notifications"
                                src="https://cdn-icons-png.flaticon.com/128/2645/2645890.png"
                                alt="Notifications"
                                title="Notifications"
                            />
                            <img
                                className="profilepic"
                                src={user.channel_icon || defaultAvatar}
                                title={user.username}
                                alt="Profile"
                                onClick={toggleDropdown}
                            />
                            <div
                                ref={profileMenuRef}
                                className={`dropdown-menu ${isprofilemenu ? 'show' : ''}`}
                                onMouseEnter={() => setProfilemenuhover(true)}
                                onMouseLeave={() => setProfilemenuhover(false)}
                            >
                                <div className="profile-box">
                                    <img
                                        className="profile-box-img"
                                        src={user.channel_icon || defaultAvatar}
                                        alt="profile"
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
