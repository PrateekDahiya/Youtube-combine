export interface ResponseWrapper<T> {
    success: boolean;
    data: T | null;
    message: string;
    statusCode?: number;
}

export interface Video {
    video_id: string;
    title: string;
    views: number;
    likes: number;
    dislikes: number;
    link: string;
    upload_time: string;
    channel_id: string;
    thumbnail_link: string;
    video_description: string;
    duration: number;
    tags: string;
    category: string;
    isShort: number;
    channel_name?: string;
    channel_icon?: string;
    subscribers?: number;
    short_desc?: string;
}

export interface Channel {
    channel_id: string;
    channel_name: string;
    short_desc: string;
    custom_url: string;
    location: string;
    subscribers: number;
    channel_icon: string;
    channel_banner: string;
    video_count: number;
    total_views: number;
    date_created: string;
    keywords: string;
}

export interface User {
    user_id: string;
    username: string;
    email: string;
    DOB: string;
    channel_id: string;
    channel_name?: string;
    channel_icon?: string;
}

export interface Subscription {
    user_id: string;
    channel_id: string;
    sub_time: string;
    channel_name?: string;
    channel_icon?: string;
}

export interface LikedVideo {
    user_id: string;
    video_id: string;
    liked_time: string;
    title?: string;
    thumbnail_link?: string;
    channel_name?: string;
    views?: number;
    upload_time?: string;
}

export interface HistoryEntry {
    user_id: string;
    video_id: string;
    watched_time: string;
    title?: string;
    thumbnail_link?: string;
    channel_name?: string;
    views?: number;
    upload_time?: string;
}

export interface WatchLaterEntry {
    user_id: string;
    video_id: string;
    added_time: string;
    title?: string;
    thumbnail_link?: string;
    channel_name?: string;
    views?: number;
    upload_time?: string;
}

export interface PaginatedResponse<T> {
    page: string;
    videos: T[];
}

export interface SearchResponse {
    page: string;
    videos: Video[];
    channels: Channel[];
    query: string;
}