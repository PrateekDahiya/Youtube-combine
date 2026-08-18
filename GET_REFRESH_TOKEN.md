# Getting YouTube Refresh Token

## Option 1: Google OAuth2 Playground (Easiest)

1. Go to https://developers.google.com/oauthplayground
2. Click the gear icon (⚙️) in top right
3. Check "Use your own OAuth credentials"
4. Enter your `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`
5. Close the settings dialog
6. In "Step 1 - Select & authorize APIs":
   - Search for "YouTube Data API v3"
   - Select `https://www.googleapis.com/auth/youtube.upload`
   - Select `https://www.googleapis.com/auth/youtube` (for thumbnails)
   - Click "Authorize APIs"
7. Sign in with the Google account that owns the YouTube channel
8. Grant permissions
9. In "Step 2 - Exchange authorization code for tokens":
   - Click "Exchange authorization code for tokens"
10. Copy the **Refresh token** (not the access token)
11. Add to your `.env`:
    ```
    YOUTUBE_REFRESH_TOKEN=your_refresh_token_here
    ```

## Option 2: Node.js Script (Run Once)

Create a file `get-refresh-token.js` in the server folder:

```javascript
const { google } = require("googleapis");
const readline = require("readline");

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "urn:ietf:wg:oauth:2.0:oob"  // For installed apps
);

const scopes = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube"
];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent"
});

console.log("Open this URL in your browser:\n", authUrl);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("\nPaste the authorization code here: ", async (code) => {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log("\n=== YOUR REFRESH TOKEN ===");
        console.log(tokens.refresh_token);
        console.log("\nAdd this to your .env as YOUTUBE_REFRESH_TOKEN");
    } catch (error) {
        console.error("Error:", error.message);
    }
    rl.close();
});
```

Run it:
```bash
cd server
node get-refresh-token.js
```

## Important Notes

- **`access_type: "offline"`** and **`prompt: "consent"`** are required to get a refresh token
- The refresh token is **long-lived** (doesn't expire unless revoked)
- If you lose it, re-run the flow
- Never commit the refresh token to git
- The access token expires in 1 hour; the module auto-refreshes it

## Verify It Works

After adding to `.env`, test:
```bash
cd server
node -e "
const { google } = require('googleapis');
const auth = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
auth.getAccessToken().then(t => console.log('Access token:', t.token?.substring(0, 20) + '...'));
"
```