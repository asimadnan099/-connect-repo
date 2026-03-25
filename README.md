# 🎬 CinemaDate — Watch Together

Watch movies with your partner in real time, no matter the distance.

## Features

- 🔄 **Synchronized video** — play/pause/seek synced between both users
- 📂 **Upload video files** or stream from a URL
- 💬 **Real-time chat** alongside the movie
- 🎬 **Subtitle support** — upload `.srt` or `.vtt` files (great for Indonesian!)
- 🔐 **Private rooms** — unique 6-character codes, max 2 users
- ✅ **Ready button** — both must be ready before playback starts
- 😂 **Emoji reactions** — react live during the movie
- 🌙 **Dark cinematic UI** — built for the mood

---

## Quick Start (Local)

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
# http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

---

## How to Use

1. **Person A** opens the app → enters name → clicks **Create Room**
2. A 6-character room code appears (e.g. `A3F7K2`)
3. **Person A** copies the invite link and sends it to their partner
4. **Person B** opens the link → enters name → clicks **Join Room**
5. Both load the same video file (or URL)
6. Both click **Ready** → playback starts automatically in sync
7. Chat, react with emojis, and enjoy the movie together 🎬

### Subtitle Tips
- Upload `.srt` or `.vtt` subtitles using the **CC upload** button
- Subtitles are automatically shared to your partner
- Toggle subtitles on/off with the **CC** button
- Indonesian `.srt` files work perfectly

---

## Deployment

### Free Hosting (Recommended)

**Option 1 — Render (easiest, free)**
1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo
4. Build command: `npm install`
5. Start command: `npm start`
6. Done! Share the URL with your partner.

**Option 2 — Railway**
1. Go to [railway.app](https://railway.app) → New Project
2. Deploy from GitHub
3. Set start command: `node server.js`

**Option 3 — Fly.io**
```bash
npm install -g flyctl
fly launch
fly deploy
```

> **Note:** Vercel doesn't support WebSockets natively. Use Render, Railway, or Fly.io for this app.

---

## Folder Structure

```
cinemadate/
├── server.js           ← Express + Socket.io backend
├── package.json
├── README.md
└── public/
    ├── index.html      ← Main SPA
    ├── css/
    │   └── style.css   ← Cinematic dark styles
    └── js/
        └── app.js      ← All frontend logic
```

---

## Tech Stack

| Layer       | Tech                        |
|-------------|---------------------------  |
| Backend     | Node.js + Express           |
| Real-time   | Socket.io (WebSockets)      |
| Frontend    | Vanilla HTML/CSS/JS         |
| Fonts       | Cormorant Garamond + DM Sans|

---

## Notes

- For **local file sync**: both users need to load their own copy of the same video file (browsers can't transfer large video files via WebSocket efficiently).
- For **URL-based videos**: the URL is shared automatically — both users stream from the same source.
- Rooms are cleaned up automatically 10 minutes after both users leave.
- Max **2 users** per room (by design — this is a date app! 💕).
