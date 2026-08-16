import React, { useEffect, useState, useContext, useRef } from "react";
import { Link } from "react-router-dom";
import { authApi, uploadApi } from "./api";
import { ThemeContext } from "./ThemeContext";

import "./Settings.css";

const defaultAvatar = "https://cdn-icons-png.flaticon.com/128/1077/1077063.png";

const Settings = (params) => {
    const user = params.user;
    const { theme, toggleTheme } = useContext(ThemeContext);
    const [activeTab, setActiveTab] = useState("account");
    const [editField, setEditField] = useState(null);
    const [editValue, setEditValue] = useState("");
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [iconPreview, setIconPreview] = useState("");
    const [bannerPreview, setBannerPreview] = useState("");
    const [iconDragging, setIconDragging] = useState(false);
    const [bannerDragging, setBannerDragging] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
    const [passwordError, setPasswordError] = useState("");
    const [saving, setSaving] = useState(false);
    const iconInputRef = useRef(null);
    const bannerInputRef = useRef(null);

    const tabs = [
        { id: "account", label: "Account", icon: "https://cdn-icons-png.flaticon.com/128/1077/1077012.png" },
        { id: "notifications", label: "Notifications", icon: "https://cdn-icons-png.flaticon.com/128/2645/2645890.png" },
        { id: "appearance", label: "Appearance", icon: "https://cdn-icons-png.flaticon.com/128/12377/12377255.png" },
        { id: "privacy", label: "Privacy", icon: "https://cdn-icons-png.flaticon.com/128/2040/2040504.png" },
        { id: "channel", label: "Channel", icon: "https://cdn-icons-png.flaticon.com/128/2989/2989849.png" },
        { id: "advanced", label: "Advanced", icon: "https://cdn-icons-png.flaticon.com/128/813/813419.png" },
    ];

    const userFields = [
        { key: "username", label: "Name", type: "text", placeholder: "Enter your name" },
        { key: "email", label: "Email", type: "email", placeholder: "Enter your email" },
        { key: "user_id", label: "Username", type: "text", placeholder: "Enter username", disabled: true },
        { key: "DOB", label: "Date of Birth", type: "date", placeholder: "Select date" },
    ];

    const channelFields = [
        { key: "channel_name", label: "Channel Name", type: "text", placeholder: "Enter channel name" },
        { key: "short_desc", label: "Description", type: "textarea", placeholder: "Tell viewers about your channel" },
        { key: "custom_url", label: "Custom URL", type: "text", placeholder: "Enter custom URL" },
        { key: "location", label: "Location", type: "text", placeholder: "Enter your location" },
        { key: "keywords", label: "Keywords", type: "text", placeholder: "Comma-separated keywords" },
    ];

    const readFileAsDataURL = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const uploadImage = async (file) => {
        const response = await uploadApi.uploadImage(file);
        return response.url;
    };

    const handleFileChange = async (e, type) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) {
            alert("Please choose a valid image file (PNG, JPG, GIF, or WEBP).");
            e.target.value = "";
            return;
        }
        try {
            const preview = await readFileAsDataURL(file);
            if (type === "icon") setIconPreview(preview);
            else setBannerPreview(preview);
            
            const url = await uploadImage(file);
            if (type === "icon") {
                await handleSubmit("Channel Icon", url);
            } else {
                await handleSubmit("Channel Banner", url);
            }
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Failed to upload the image. Please try again.");
        } finally {
            e.target.value = "";
        }
    };

    const handleDragOver = (e, setter) => {
        e.preventDefault();
        e.stopPropagation();
        setter(true);
    };

    const handleDragLeave = (e, setter) => {
        e.preventDefault();
        e.stopPropagation();
        setter(false);
    };

    const handleDrop = (e, type, setter) => {
        e.preventDefault();
        e.stopPropagation();
        setter(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            const dt = new DataTransfer();
            dt.items.add(file);
            e.target.files = dt.files;
            handleFileChange(e, type);
        }
    };

    const updateCookies = async () => {
        try {
            const response = await authApi.getUser(user.user_id);
            const updatedUser = response.user[0];
            params.setUser(updatedUser);
        } catch (error) {
            console.error("Error updating cookies:", error);
        }
    };

    const handleSubmit = async (label, value) => {
        const userLabels = { Name: "username", Email: "email", DOB: "DOB" };
        const channelLabels = {
            "Channel name": "channel_name",
            "Channel description": "short_desc",
            Location: "location",
            "Channel Icon": "channel_icon",
            "Channel Banner": "channel_banner",
            "Channel Keywords": "keywords",
        };

        const userField = userLabels[label];
        const channelField = channelLabels[label];

        setSaving(true);
        try {
            if (userField) {
                await authApi.updateUserDetail(userField, value, user.user_id);
            }
            if (channelField) {
                await authApi.updateChannelDetail(channelField, value, user.channel_id);
            }
            if (label === "Delete Channel" && value === "Delete Channel") {
                await authApi.deleteUser(user.user_id, user.channel_id);
                await updateCookies();
                window.location.href = "/";
                return;
            }
            setEditField(null);
            await updateCookies();
        } catch (error) {
            console.error("Error updating data:", error.message);
            alert("Failed to save changes. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordError("");
        
        if (passwordForm.new !== passwordForm.confirm) {
            setPasswordError("New passwords do not match");
            return;
        }
        if (passwordForm.new.length < 8) {
            setPasswordError("Password must be at least 8 characters");
            return;
        }

        setSaving(true);
        try {
            await authApi.updateUserDetail("pass", passwordForm.new, user.user_id);
            setShowPasswordModal(false);
            setPasswordForm({ current: "", new: "", confirm: "" });
            await updateCookies();
            alert("Password updated successfully");
        } catch (error) {
            console.error("Error changing password:", error);
            setPasswordError("Failed to change password. Please check your current password.");
        } finally {
            setSaving(false);
        }
    };

    const handleSettingToggle = (setting, value) => {
        params.handleSettings(setting, value);
    };

    const getFieldValue = (fields, key) => {
        const field = fields.find(f => f.key === key);
        return field ? user[field.key] : user[key];
    };

    const renderFieldInput = (field, section) => {
        const isEditing = editField === field.key;
        const value = getFieldValue(section === "user" ? userFields : channelFields, field.key) || "";
        const disabled = field.disabled || saving;

        if (isEditing) {
            return (
                <div className="settings-form-row">
                    <label htmlFor={field.key} className="settings-label">{field.label}</label>
                    <div className="settings-input-wrapper">
                        {field.type === "textarea" ? (
                            <textarea
                                id={field.key}
                                className="settings-input"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                placeholder={field.placeholder}
                                disabled={disabled}
                                rows={3}
                            />
                        ) : (
                            <input
                                id={field.key}
                                type={field.type}
                                className="settings-input"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                placeholder={field.placeholder}
                                disabled={disabled}
                            />
                        )}
                    </div>
                    <div className="settings-actions">
                        <button 
                            className="settings-btn settings-btn-primary" 
                            onClick={() => handleSubmit(field.label, editValue.trim())}
                            disabled={disabled || !editValue.trim()}
                        >
                            Save
                        </button>
                        <button 
                            className="settings-btn settings-btn-secondary" 
                            onClick={() => setEditField(null)}
                            disabled={disabled}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="settings-field-row">
                <label className="settings-label">{field.label}</label>
                <div className="settings-value-wrapper">
                    <span className="settings-value">{value || "—"}</span>
                    {!field.disabled && (
                        <button 
                            className="settings-btn settings-btn-icon" 
                            onClick={() => {
                                setEditValue(value);
                                setEditField(field.key);
                            }}
                            title="Edit"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderToggleSetting = (label, description, setting, value, onChange) => (
        <div className="settings-toggle-row">
            <div className="settings-toggle-info">
                <label className="settings-label">{label}</label>
                {description && <span className="settings-description">{description}</span>}
            </div>
            <button
                className={`settings-toggle ${value === "true" ? "on" : ""}`}
                onClick={() => onChange(setting, value === "true" ? "false" : "true")}
                aria-checked={value === "true"}
                role="switch"
                aria-label={label}
            >
                <span className="settings-toggle-thumb"></span>
            </button>
        </div>
    );

    useEffect(() => {
        document.body.className = theme;
    }, [theme]);

    if (user === "Guest") {
        return (
            <div className="settings-page">
                <div className="settings-guest">
                    <img src="https://cdn-icons-png.flaticon.com/128/1077/1077063.png" alt="Sign in" />
                    <h2>Sign in to access settings</h2>
                    <p>Create an account or sign in to customize your VidVault experience.</p>
                    <Link to="/login">
                        <button className="settings-btn settings-btn-primary">Sign In</button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-page">
            <nav className="settings-tabs" role="tablist" aria-label="Settings categories">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        aria-controls={`${tab.id}-panel`}
                        id={`${tab.id}-tab`}
                        className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <img src={tab.icon} alt="" className="settings-tab-icon" />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            <div className="settings-content">
                {activeTab === "account" && (
                    <div className="settings-panel" id="account-panel" role="tabpanel" aria-labelledby="account-tab">
                        <div className="settings-section">
                            <h3 className="settings-section-title">Your VidVault Channel</h3>
                            <p className="settings-section-description">
                                This is your public presence on VidVault. You need a channel to upload videos, 
                                comment, or create playlists.
                            </p>
                            <div className="settings-channel-preview">
                                <img 
                                    src={user.channel_icon || defaultAvatar} 
                                    alt={user.channel_name} 
                                    className="settings-channel-avatar"
                                />
                                <div>
                                    <h4>{user.channel_name || "Your Channel"}</h4>
                                    <p className="settings-channel-url">@{user.custom_url || user.user_id}</p>
                                </div>
                            </div>
                            <div className="settings-quick-links">
                                <Link to="/yourchannel" className="settings-link">Go to your channel</Link>
                                <Link to="/uploads" className="settings-link">Manage videos</Link>
                            </div>
                        </div>

                        <div className="settings-section">
                            <h3 className="settings-section-title">Account Information</h3>
                            {userFields.map((field) => renderFieldInput(field, "user"))}
                        </div>

                        <div className="settings-section">
                            <h3 className="settings-section-title">Password</h3>
                            <div className="settings-field-row">
                                <div className="settings-value-wrapper">
                                    <span className="settings-value">••••••••</span>
                                    <button 
                                        className="settings-btn settings-btn-secondary" 
                                        onClick={() => setShowPasswordModal(true)}
                                    >
                                        Change Password
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "notifications" && (
                    <div className="settings-panel" id="notifications-panel" role="tabpanel" aria-labelledby="notifications-tab">
                        <div className="settings-section">
                            <h3 className="settings-section-title">Email Notifications</h3>
                            <p className="settings-section-description">
                                Choose what email notifications you'd like to receive.
                            </p>
                            {renderToggleSetting(
                                "New videos from subscriptions",
                                "Get notified when channels you subscribe to upload new videos",
                                "email_new_videos",
                                "false",
                                handleSettingToggle
                            )}
                            {renderToggleSetting(
                                "New shorts from subscriptions",
                                "Get notified when channels you subscribe to post new Shorts",
                                "email_new_shorts",
                                "false",
                                handleSettingToggle
                            )}
                            {renderToggleSetting(
                                "Live streams",
                                "Get notified when channels you subscribe to go live",
                                "email_live_streams",
                                "false",
                                handleSettingToggle
                            )}
                            {renderToggleSetting(
                                "Comments & replies",
                                "Get notified when someone comments on your videos or replies to your comments",
                                "email_comments",
                                "false",
                                handleSettingToggle
                            )}
                            {renderToggleSetting(
                                "Weekly digest",
                                "Receive a weekly summary of activity from your subscriptions",
                                "email_weekly_digest",
                                "false",
                                handleSettingToggle
                            )}
                        </div>

                        <div className="settings-section">
                            <h3 className="settings-section-title">In-App Notifications</h3>
                            <p className="settings-section-description">
                                Control notifications that appear in the VidVault app.
                            </p>
                            {renderToggleSetting(
                                "Show notification badge",
                                "Display unread count on the notification bell",
                                "notif_badge",
                                "true",
                                handleSettingToggle
                            )}
                            {renderToggleSetting(
                                "Sound for new notifications",
                                "Play a sound when new notifications arrive",
                                "notif_sound",
                                "true",
                                handleSettingToggle
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "appearance" && (
                    <div className="settings-panel" id="appearance-panel" role="tabpanel" aria-labelledby="appearance-tab">
                        <div className="settings-section">
                            <h3 className="settings-section-title">Theme</h3>
                            <p className="settings-section-description">Choose your preferred color theme.</p>
                            <div className="settings-theme-options">
                                <button
                                    className={`settings-theme-option ${theme === "light" ? "active" : ""}`}
                                    onClick={() => theme !== "light" && toggleTheme()}
                                >
                                    <div className="theme-preview light"></div>
                                    <span>Light</span>
                                    {theme === "light" && (
                                        <svg className="theme-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="20 6 9 17 4 12"/>
                                        </svg>
                                    )}
                                </button>
                                <button
                                    className={`settings-theme-option ${theme === "dark" ? "active" : ""}`}
                                    onClick={() => theme !== "dark" && toggleTheme()}
                                >
                                    <div className="theme-preview dark"></div>
                                    <span>Dark</span>
                                    {theme === "dark" && (
                                        <svg className="theme-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="20 6 9 17 4 12"/>
                                        </svg>
                                    )}
                                </button>
                                <button
                                    className={`settings-theme-option ${theme === "system" ? "active" : ""}`}
                                    onClick={() => {}}
                                >
                                    <div className="theme-preview system"></div>
                                    <span>System</span>
                                    {theme === "system" && (
                                        <svg className="theme-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="20 6 9 17 4 12"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="settings-section">
                            <h3 className="settings-section-title">Shorts</h3>
                            <p className="settings-section-description">Enable or disable the Shorts feed.</p>
                            {renderToggleSetting(
                                "Show Shorts",
                                "Display Shorts in the navigation and home feed",
                                "shorts",
                                params.isShorts,
                                handleSettingToggle
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "privacy" && (
                    <div className="settings-panel" id="privacy-panel" role="tabpanel" aria-labelledby="privacy-tab">
                        <div className="settings-section">
                            <h3 className="settings-section-title">History & Activity</h3>
                            <p className="settings-section-description">Control what VidVault saves about your viewing activity.</p>
                            {renderToggleSetting(
                                "Watch History",
                                "Save videos you watch to your history",
                                "history",
                                params.ishistory,
                                handleSettingToggle
                            )}
                            {renderToggleSetting(
                                "Search History",
                                "Save your search queries for suggestions",
                                "search_history",
                                "true",
                                handleSettingToggle
                            )}
                            {renderToggleSetting(
                                "Watch Later",
                                "Allow adding videos to Watch Later",
                                "watchlater",
                                params.iswatchlater,
                                handleSettingToggle
                            )}
                        </div>

                        <div className="settings-section">
                            <h3 className="settings-section-title">Likes & Dislikes</h3>
                            <p className="settings-section-description">Control whether your likes and dislikes are saved and visible.</p>
                            {renderToggleSetting(
                                "Save Likes",
                                "Keep track of videos you've liked",
                                "likedvideos",
                                params.islikedvideos,
                                handleSettingToggle
                            )}
                            {renderToggleSetting(
                                "Show Liked Videos",
                                "Display your liked videos on your channel",
                                "show_liked_videos",
                                "true",
                                handleSettingToggle
                            )}
                        </div>

                        <div className="settings-section">
                            <h3 className="settings-section-title">Data Management</h3>
                            <div className="settings-field-row">
                                <div className="settings-value-wrapper">
                                    <button className="settings-btn settings-btn-secondary">
                                        Download Your Data
                                    </button>
                                    <button className="settings-btn settings-btn-secondary">
                                        Clear Watch History
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "channel" && (
                    <div className="settings-panel" id="channel-panel" role="tabpanel" aria-labelledby="channel-tab">
                        <div className="settings-section">
                            <h3 className="settings-section-title">Profile Photo</h3>
                            <p className="settings-section-description">
                                Used across VidVault as your public identity. Choose a PNG, JPG, GIF or WEBP image.
                            </p>
                            <div className="settings-upload-area">
                                <div 
                                    className={`settings-upload-zone ${iconDragging ? "dragging" : ""}`}
                                    onDragOver={(e) => handleDragOver(e, setIconDragging)}
                                    onDragLeave={(e) => handleDragLeave(e, setIconDragging)}
                                    onDrop={(e) => handleDrop(e, "icon", setIconDragging)}
                                    onClick={() => iconInputRef.current?.click()}
                                >
                                    {iconPreview || user.channel_icon ? (
                                        <img 
                                            src={iconPreview || user.channel_icon} 
                                            alt="Profile" 
                                            className="settings-upload-preview"
                                        />
                                    ) : (
                                        <>
                                            <svg className="settings-upload-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                <polyline points="17 8 12 3 7 8"/>
                                                <line x1="12" y1="3" x2="12" y2="15"/>
                                            </svg>
                                            <span>Click or drag to upload profile photo</span>
                                        </>
                                    )}
                                    <input
                                        ref={iconInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/gif,image/webp"
                                        onChange={(e) => handleFileChange(e, "icon")}
                                        hidden
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="settings-section">
                            <h3 className="settings-section-title">Channel Banner</h3>
                            <p className="settings-section-description">
                                Recommended size: 2560 x 1440 px. Safe area: 1546 x 423 px.
                            </p>
                            <div className="settings-upload-area">
                                <div 
                                    className={`settings-upload-zone ${bannerDragging ? "dragging" : ""}`}
                                    onDragOver={(e) => handleDragOver(e, setBannerDragging)}
                                    onDragLeave={(e) => handleDragLeave(e, setBannerDragging)}
                                    onDrop={(e) => handleDrop(e, "banner", setBannerDragging)}
                                    onClick={() => bannerInputRef.current?.click()}
                                >
                                    {bannerPreview || user.channel_banner ? (
                                        <img 
                                            src={bannerPreview || user.channel_banner} 
                                            alt="Channel banner" 
                                            className="settings-upload-preview settings-banner-preview"
                                        />
                                    ) : (
                                        <>
                                            <svg className="settings-upload-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                <polyline points="17 8 12 3 7 8"/>
                                                <line x1="12" y1="3" x2="12" y2="15"/>
                                            </svg>
                                            <span>Click or drag to upload channel banner</span>
                                        </>
                                    )}
                                    <input
                                        ref={bannerInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/gif,image/webp"
                                        onChange={(e) => handleFileChange(e, "banner")}
                                        hidden
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="settings-section">
                            <h3 className="settings-section-title">Channel Details</h3>
                            {channelFields.map((field) => renderFieldInput(field, "channel"))}
                        </div>
                    </div>
                )}

                {activeTab === "advanced" && (
                    <div className="settings-panel" id="advanced-panel" role="tabpanel" aria-labelledby="advanced-tab">
                        <div className="settings-section">
                            <h3 className="settings-section-title">Account IDs</h3>
                            <div className="settings-field-row">
                                <label className="settings-label">Channel ID</label>
                                <div className="settings-value-wrapper">
                                    <code className="settings-value code">{user.channel_id}</code>
                                    <button 
                                        className="settings-btn settings-btn-icon" 
                                        onClick={() => navigator.clipboard.writeText(user.channel_id)}
                                        title="Copy to clipboard"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="settings-field-row">
                                <label className="settings-label">User ID</label>
                                <div className="settings-value-wrapper">
                                    <code className="settings-value code">{user.user_id}</code>
                                    <button 
                                        className="settings-btn settings-btn-icon" 
                                        onClick={() => navigator.clipboard.writeText(user.user_id)}
                                        title="Copy to clipboard"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="settings-section settings-danger-zone">
                            <h3 className="settings-section-title">Danger Zone</h3>
                            <p className="settings-section-description">
                                Once you delete your account, there is no going back. All your data, videos, 
                                subscriptions, and history will be permanently removed.
                            </p>
                            {deleteConfirm ? (
                                <div className="settings-confirm-delete">
                                    <input
                                        type="text"
                                        className="settings-input"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        placeholder="Type 'Delete Channel' to confirm"
                                    />
                                    <div className="settings-actions">
                                        <button 
                                            className="settings-btn settings-btn-danger" 
                                            onClick={() => handleSubmit("Delete Channel", editValue)}
                                            disabled={editValue !== "Delete Channel" || saving}
                                        >
                                            {saving ? "Deleting..." : "Delete My Account"}
                                        </button>
                                        <button 
                                            className="settings-btn settings-btn-secondary" 
                                            onClick={() => { setDeleteConfirm(false); setEditValue(""); }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button 
                                    className="settings-btn settings-btn-danger" 
                                    onClick={() => setDeleteConfirm(true)}
                                >
                                    Delete Account
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {showPasswordModal && (
                    <div className="settings-modal-overlay" onClick={() => { setShowPasswordModal(false); setPasswordForm({ current: "", new: "", confirm: "" }); }}>
                        <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="settings-modal-header">
                                <h3>Change Password</h3>
                                <button className="settings-modal-close" onClick={() => { setShowPasswordModal(false); setPasswordForm({ current: "", new: "", confirm: "" }); }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"/>
                                        <line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handlePasswordChange} className="settings-modal-body">
                                <div className="settings-form-row">
                                    <label htmlFor="currentPass" className="settings-label">Current Password</label>
                                    <input
                                        id="currentPass"
                                        type="password"
                                        className="settings-input"
                                        value={passwordForm.current}
                                        onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                                        placeholder="Enter current password"
                                        autoComplete="current-password"
                                        required
                                    />
                                </div>
                                <div className="settings-form-row">
                                    <label htmlFor="newPass" className="settings-label">New Password</label>
                                    <input
                                        id="newPass"
                                        type="password"
                                        className="settings-input"
                                        value={passwordForm.new}
                                        onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                                        placeholder="Enter new password (min 8 chars)"
                                        autoComplete="new-password"
                                        required
                                    />
                                </div>
                                <div className="settings-form-row">
                                    <label htmlFor="confirmPass" className="settings-label">Confirm New Password</label>
                                    <input
                                        id="confirmPass"
                                        type="password"
                                        className="settings-input"
                                        value={passwordForm.confirm}
                                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                                        placeholder="Confirm new password"
                                        autoComplete="new-password"
                                        required
                                    />
                                </div>
                                {passwordError && <p className="settings-error">{passwordError}</p>}
                                <div className="settings-actions">
                                    <button type="button" className="settings-btn settings-btn-secondary" onClick={() => { setShowPasswordModal(false); setPasswordForm({ current: "", new: "", confirm: "" }); }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="settings-btn settings-btn-primary" disabled={saving}>
                                        {saving ? "Saving..." : "Update Password"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;