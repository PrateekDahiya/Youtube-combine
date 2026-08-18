# YouTube Upload Integration Plan

## Overview
Replace Cloudinary video uploads with direct YouTube Data API v3 uploads to the app's YouTube channel as **unlisted** videos. The app will store only the YouTube video URL (e.g., `https://www.youtube.com/watch?v=VIDEO_ID`) and use the existing YouTube iframe fallback for playback.

## Current Architecture
- **Upload Flow**: Client → `/api/uploadVideo` (multipart) → Cloudinary → DB stores Cloudinary URL
- **Playback**: `Watch.js` / `Shortbox.js` detect Cloudinary/local URLs → use custom `VideoPlayer`; else use YouTube stream resolver → fallback to YouTube iframe
- **100MB Limit**: Enforced by Cloudinary free tier and `MAX_VIDEO_SIZE_MB = 100` in config

## Target Architecture
- **Upload Flow**: Client → `/api/uploadVideo` → Server uploads to YouTube via Data API v3 (OAuth2) → DB stores YouTube URL (`https://www.youtube.com/watch?v=VIDEO_ID`)
- **Playback**: Existing logic already handles YouTube URLs via iframe fallback (`isUploadedLink` check)
- **No Size Limit**: YouTube allows up to 256GB / 12 hours per video

## Key Changes

### 1. Backend (server/)
- **New OAuth2 flow**: Add Google OAuth2 for YouTube upload scope (`https://www.googleapis.com/auth/youtube.upload`)
- **New upload module**: `server/src/uploads/youtubeUpload.js` - handles resumable upload to YouTube
- **Update routes**: `server/src/routes/uploads.js` - replace Cloudinary logic with YouTube upload
- **Remove Cloudinary**: Delete `cloudinary` dependency, config, and upload helpers
- **Update DB schema**: `link` column already stores URL; no schema change needed
- **Env vars**: Add `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`

### 2. Frontend (client/)
- **Remove 100MB limit**: Delete `MAX_VIDEO_SIZE_MB` constant in `UploadVideo.js`
- **Update upload API**: `client/src/api/upload.js` - keep same interface, backend handles YouTube
- **Progress tracking**: YouTube resumable upload supports progress; update UI if needed

### 3. Database
- No schema changes required - `videos.link` stores the YouTube watch URL
- `thumbnail_link` can store YouTube thumbnail URL (`https://i.ytimg.com/vi/VIDEO_ID/maxresdefault.jpg`)

## Implementation Steps

### Phase 1: YouTube OAuth2 Setup
- [ ] Create Google Cloud project / use existing
- [ ] Enable YouTube Data API v3
- [ ] Create OAuth2 credentials (Web application)
- [ ] Get refresh token via OAuth2 playground or script
- [ ] Add env vars to `.env.example` and Render

### Phase 2: Backend Upload Module
- [ ] Create `server/src/uploads/youtubeUpload.js` with resumable upload
- [ ] Implement token refresh logic (access tokens expire in 1 hour)
- [ ] Handle video metadata (title, description, tags, category, privacyStatus=unlisted)
- [ ] Handle thumbnail upload via `thumbnails.set` API
- [ ] Return YouTube video ID and watch URL

### Phase 3: Update Upload Routes
- [ ] Modify `/api/uploadVideo` in `server/src/routes/uploads.js`
- [ ] Replace Cloudinary `processVideoUpload` with YouTube upload
- [ ] Remove `isCloudinaryConfigured` checks
- [ ] Update `/api/replaceVideo` similarly
- [ ] Remove Cloudinary dependencies from `package.json`

### Phase 4: Frontend Updates
- [ ] Remove `MAX_VIDEO_SIZE_MB` constant in `UploadVideo.js`
- [ ] Remove size validation in `onVideoChange`
- [ ] Update dropzone hint text (remove "MP4, WebM or MOV" size reference)
- [ ] Test large file uploads (>100MB)

### Phase 5: Cleanup & Testing
- [ ] Remove `cloudinary` from `server/package.json`
- [ ] Remove Cloudinary config from `server/src/config/index.js`
- [ ] Remove Cloudinary upload helpers from `server/src/uploads/index.js`
- [ ] Test end-to-end: upload → DB → playback via iframe
- [ ] Test Shorts upload (type=short)
- [ ] Test video replacement
- [ ] Test thumbnail upload

## YouTube Data API v3 Upload Details

### Resumable Upload Protocol
1. **Initiate**: `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`
   - Body: JSON with snippet (title, description, tags, categoryId) and status (privacyStatus: "unlisted")
   - Returns: `Location` header with upload URL
2. **Upload**: `PUT <upload_url>` with video file bytes
   - Supports chunked upload with `Content-Range` header
   - Returns video resource on completion
3. **Thumbnail**: `POST https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=VIDEO_ID`
   - Multipart upload for thumbnail image

### Required Scopes
- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube` (for thumbnail)

### Category Mapping
Map existing categories to YouTube category IDs:
- Music → 10
- Gaming → 20
- Movies → 1
- News → 25
- Sports → 17
- Education → 27
- Entertainment → 24
- Other → 22 (People & Blogs)

## Risk Mitigation
- **Token expiry**: Implement automatic refresh using refresh token
- **Upload failures**: Resumable protocol handles network interruptions
- **Quota limits**: YouTube Data API has daily quota (10,000 units default); upload = ~1600 units
- **Authentication**: Server-side only; client never sees OAuth tokens

## Testing Checklist
- [ ] Upload 50MB video → verify YouTube unlisted URL in DB
- [ ] Upload 500MB video → verify no size limit error
- [ ] Upload Short (<60s) → verify `isShort=1` in DB
- [ ] Play uploaded video in `Watch.js` → verify iframe loads
- [ ] Play uploaded Short in `Shorts.js` → verify iframe loads
- [ ] Replace video → verify old YouTube video deleted (optional) / new uploaded
- [ ] Upload thumbnail → verify YouTube thumbnail set
- [ ] Check `Uploads.js` page shows correct status

## Rollback Plan
- Keep Cloudinary code in git history
- Feature flag: `USE_YOUTUBE_UPLOAD` env var to toggle
- If issues: revert `uploads.js` and restore Cloudinary config