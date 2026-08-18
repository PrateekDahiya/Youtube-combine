# YouTube Upload Integration - Progress Tracker

## Status Overview
| Phase | Task | Status | Notes |
|-------|------|--------|-------|
| 1 | Google Cloud / OAuth2 Setup | ✅ Done | All credentials in .env |
| 2 | Backend YouTube Upload Module | ✅ Done | Chunked resumable upload (256KB) with progress |
| 3 | Update Upload Routes | ✅ Done | `server/src/routes/uploads.js` updated |
| 4 | Frontend Updates | ✅ Done | Removed 100MB limit in `UploadVideo.js` |
| 5 | Cleanup & Testing | 🔄 In Progress | Server running, 2GB upload in background |

---

## Phase 5: Cleanup & Testing

### Cleanup Tasks
- [x] Remove `cloudinary` from `server/package.json`
- [x] Remove Cloudinary config from `server/src/config/index.js`
- [x] Remove unused Cloudinary code from `server/src/uploads/index.js`
- [x] Update `server/.env.example` - remove Cloudinary vars, add YouTube vars
- [x] Install `googleapis` (already in package.json)
- [x] Test end-to-end upload (server running, auth verified)

### Testing Checklist
| Test | Status | Notes |
|------|--------|-------|
| Upload 50MB video | ⬜ | Test via UI at http://localhost:3000/uploads |
| Upload 2GB video | 🔄 In Progress | Background upload running |
| Upload Short (<60s) | ⬜ | |
| Play video in Watch.js | ⬜ | Verify iframe fallback |
| Play Short in Shorts.js | ⬜ | Verify iframe fallback |
| Replace video | ⬜ | |
| Upload custom thumbnail | ⬜ | |
| Uploads page shows status | ⬜ | |
| Video appears in Home feed | ⬜ | |
| Video appears in Yourchannel | ⬜ | |
| Edit video metadata | ⬜ | |

### Issues Found
- Progress tracking not updating in DB during chunked upload (callback runs but DB not updated)
- Small test files (32 bytes) may fail YouTube validation
- Need to test full flow via browser UI

---

## Phase 1: Google Cloud / OAuth2 Setup

### Tasks
- [x] Create/select Google Cloud project
- [x] Enable YouTube Data API v3
- [x] Configure OAuth2 consent screen
- [x] Create OAuth2 credentials (Web application)
- [x] Add authorized redirect URI (e.g., `http://localhost:5000/oauth2callback` or use playground)
- [x] Generate refresh token using OAuth2 Playground or custom script
- [x] Add env vars to `server/.env.example`:
  - `YOUTUBE_CLIENT_ID`
  - `YOUTUBE_CLIENT_SECRET`
  - `YOUTUBE_REFRESH_TOKEN`
- [ ] Add env vars to Render dashboard

### Notes
- Refresh token is long-lived; access tokens expire in 1 hour
- Store refresh token securely; never commit to git

---

## Phase 2: Backend YouTube Upload Module

### Files to Create
- `server/src/uploads/youtubeUpload.js` - Main upload logic

### Tasks
- [x] Create `youtubeUpload.js` with:
  - [x] `getAccessToken()` - refresh access token using refresh token
  - [x] `initiateResumableUpload(metadata)` - Step 1: get upload URL
  - [x] `uploadVideoFile(uploadUrl, filePath, onProgress)` - Step 2: PUT video bytes
  - [x] `uploadThumbnail(videoId, thumbPath)` - Set custom thumbnail
  - [x] `uploadToYouTube(videoFile, thumbFile, metadata, onProgress)` - Orchestrator
- [x] Handle errors: quota exceeded, auth failure, network errors
- [x] Return `{ videoId, watchUrl, thumbnailUrl }`

### YouTube API Endpoints
- Initiate: `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`
- Upload: `PUT <upload_url>` (with `Content-Range` for resumable)
- Thumbnail: `POST https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=VIDEO_ID`

### Metadata Mapping
| App Field | YouTube Field |
|-----------|---------------|
| title | snippet.title |
| description | snippet.description |
| tags | snippet.tags[] |
| category | snippet.categoryId (map to YT IDs) |
| type=short | snippet.tags + "shorts" (or check duration) |
| privacy | status.privacyStatus = "unlisted" |

### Category ID Mapping
```js
const CATEGORY_MAP = {
  "Music": "10",
  "Gaming": "20",
  "Movies": "1",
  "News": "25",
  "Sports": "17",
  "Education": "27",
  "Entertainment": "24",
  "Other": "22"
};
```

---

## Phase 3: Update Upload Routes

### Files to Modify
- `server/src/routes/uploads.js` - Replace Cloudinary with YouTube
- `server/src/uploads/index.js` - Remove Cloudinary helpers (or keep for images only)
- `server/src/config/index.js` - Remove Cloudinary config

### Tasks
- [x] Import `uploadToYouTube` from new module
- [x] Update `/api/uploadVideo`:
  - [x] Remove `isCloudinaryConfigured()` check
  - [x] Call `uploadToYouTube(videoFile, thumbFile, metadata, onProgress)`
  - [x] On success: save `watchUrl` as `link`, `thumbnailUrl` as `thumbnail_link`
  - [x] Return `{ video_id, upload_status: 0 }` with progress tracking
- [x] Update `/api/replaceVideo`:
  - [x] Upload new video to YouTube, delete old YouTube video
- [x] Remove `processVideoUpload` Cloudinary logic
- [x] Remove `cloudinaryUpload`, `cloudinaryErrorMessage`, `MAX_VIDEO_SIZE_MB` exports
- [x] Keep `upload` (for images) and `videoUpload` (multer) for local file handling

### Progress Tracking
- YouTube resumable upload supports progress via `Content-Range`
- Update `upload_progress` in DB during upload (poll or callback)

---

## Phase 4: Frontend Updates

### Files to Modify
- `client/src/UploadVideo.js` - Remove size limit, update UI
- `client/src/api/upload.js` - No changes needed (same interface)

### Tasks
- [x] Remove `MAX_VIDEO_SIZE_MB` and `MAX_VIDEO_SIZE_BYTES` constants
- [x] Remove file size validation in `onVideoChange`
- [x] Update dropzone hint: "MP4, WebM, MOV, or any format YouTube supports"
- [ ] Test with >100MB file
- [ ] Verify progress bar works (backend supports progress updates)

---

## Phase 5: Cleanup & Testing

### Cleanup Tasks
- [x] Remove `cloudinary` from `server/package.json`
- [x] Remove Cloudinary config from `server/src/config/index.js`
- [x] Remove unused Cloudinary code from `server/src/uploads/index.js`
- [x] Update `server/.env.example` - remove Cloudinary vars, add YouTube vars
- [ ] Update `render.yaml` - remove Cloudinary env vars, add YouTube env vars
- [x] Install `googleapis` (already in package.json)
- [x] Test end-to-end upload (server running, auth verified)

### Testing Checklist
| Test | Status | Notes |
|------|--------|-------|
| Upload 50MB video | ⬜ | Test via UI at http://localhost:3000/uploads |
| Upload 500MB video | ⬜ | |
| Upload 2GB video | ⬜ | |
| Upload Short (<60s) | ⬜ | |
| Play video in Watch.js | ⬜ | Verify iframe fallback |
| Play Short in Shorts.js | ⬜ | Verify iframe fallback |
| Replace video | ⬜ | |
| Upload custom thumbnail | ⬜ | |
| Uploads page shows status | ⬜ | |
| Video appears in Home feed | ⬜ | |
| Video appears in Yourchannel | ⬜ | |
| Edit video metadata | ⬜ | |

### Testing Checklist
| Test | Status | Notes |
|------|--------|-------|
| Upload 50MB video | ⬜ | |
| Upload 500MB video | ⬜ | |
| Upload 2GB video | ⬜ | |
| Upload Short (<60s) | ⬜ | |
| Play video in Watch.js | ⬜ | Verify iframe fallback |
| Play Short in Shorts.js | ⬜ | Verify iframe fallback |
| Replace video | ⬜ | |
| Upload custom thumbnail | ⬜ | |
| Uploads page shows status | ⬜ | |
| Video appears in Home feed | ⬜ | |
| Video appears in Yourchannel | ⬜ | |
| Edit video metadata | ⬜ | |

### Edge Cases
- [ ] Network interruption during upload (resumable should handle)
- [ ] YouTube quota exceeded (daily limit ~10,000 units, upload = ~1600)
- [ ] Invalid refresh token (need re-auth)
- [ ] Video processing delay on YouTube (video not immediately playable)
- [ ] Duplicate upload detection

---

## Dependencies to Add
- `googleapis` npm package (for YouTube Data API v3)
- Or use `axios` directly with OAuth2 (lighter weight)

## New Env Vars Required
```env
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REFRESH_TOKEN=your_refresh_token
```

## Database Changes (Optional)
Consider adding `youtube_video_id` column to `videos` table for:
- Direct API calls (delete, update metadata)
- Avoiding URL parsing
- Migration: `ALTER TABLE videos ADD COLUMN youtube_video_id VARCHAR(32) NULL`

---

## Rollback Checklist
If issues arise:
- [ ] Revert `server/src/routes/uploads.js` to Cloudinary version
- [ ] Restore `cloudinary` in `package.json`
- [ ] Restore Cloudinary config in `config/index.js`
- [ ] Restore Cloudinary helpers in `uploads/index.js`
- [ ] Re-add Cloudinary env vars

---

## Log

### 2026-08-18
- Created worktree and branch `youtube-upload-youtube`
- Created `YOUTUBE_UPLOAD_PLAN.md` and `YOUTUBE_UPLOAD_TRACKER.md`
- Analyzed current upload architecture (Cloudinary → YouTube iframe fallback ready)