const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e7,
});

app.use(express.static(path.join(__dirname, "public")));

// In-memory room store
// rooms[roomCode] = { users: Map<socketId, {name, ready}>, videoState: {...}, messages: [] }
const rooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoomPublicData(room) {
  return {
    users: Array.from(room.users.values()),
    videoState: room.videoState,
  };
}

io.on("connection", (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // ── Create Room ─────────────────────────────────────────────────
  socket.on("create-room", ({ name }, callback) => {
    const code = generateRoomCode();
    rooms.set(code, {
      users: new Map(),
      videoState: {
        src: null,
        srcType: null, // 'url' | 'file'
        playing: false,
        currentTime: 0,
        updatedAt: Date.now(),
        subtitleEnabled: true,
      },
      messages: [],
      reactions: [],
    });

    socket.join(code);
    const room = rooms.get(code);
    room.users.set(socket.id, { id: socket.id, name, ready: false });
    socket.data.roomCode = code;
    socket.data.name = name;

    console.log(`[Room] Created: ${code} by ${name}`);
    callback({ success: true, code, roomData: getRoomPublicData(room) });
  });

  // ── Join Room ────────────────────────────────────────────────────
  socket.on("join-room", ({ code, name }, callback) => {
    const room = rooms.get(code);
    if (!room) return callback({ success: false, error: "Room not found." });
    if (room.users.size >= 2) return callback({ success: false, error: "Room is full (max 2 people)." });

    socket.join(code);
    room.users.set(socket.id, { id: socket.id, name, ready: false });
    socket.data.roomCode = code;
    socket.data.name = name;

    // Notify the other person
    socket.to(code).emit("partner-joined", { name });

    console.log(`[Room] ${name} joined: ${code}`);
    callback({ success: true, code, roomData: getRoomPublicData(room) });
  });

  // ── Video Action (play/pause/seek/source) ────────────────────────
  socket.on("video-action", (data) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;

    const { type, currentTime, src, srcType } = data;

    // Update server-side state
    if (type === "play") {
      room.videoState.playing = true;
      room.videoState.currentTime = currentTime;
      room.videoState.updatedAt = Date.now();
    } else if (type === "pause") {
      room.videoState.playing = false;
      room.videoState.currentTime = currentTime;
      room.videoState.updatedAt = Date.now();
    } else if (type === "seek") {
      room.videoState.currentTime = currentTime;
      room.videoState.updatedAt = Date.now();
    } else if (type === "source") {
      room.videoState.src = src;
      room.videoState.srcType = srcType;
      room.videoState.playing = false;
      room.videoState.currentTime = 0;
      room.videoState.updatedAt = Date.now();
    }

    // Broadcast to the OTHER user in the room
    socket.to(code).emit("video-action", { ...data, from: socket.data.name });
  });

  // ── Subtitle file relay (base64 small .srt/.vtt) ─────────────────
  socket.on("subtitle-upload", (data) => {
    const code = socket.data.roomCode;
    socket.to(code).emit("subtitle-upload", data);
  });

  socket.on("subtitle-toggle", (data) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (room) room.videoState.subtitleEnabled = data.enabled;
    socket.to(code).emit("subtitle-toggle", data);
  });

  // ── Chat Message ─────────────────────────────────────────────────
  socket.on("chat-message", ({ text }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;

    const message = {
      id: uuidv4(),
      from: socket.data.name,
      fromId: socket.id,
      text,
      timestamp: Date.now(),
    };
    room.messages.push(message);
    if (room.messages.length > 200) room.messages.shift();

    io.to(code).emit("chat-message", message);
  });

  // ── Emoji Reaction ───────────────────────────────────────────────
  socket.on("emoji-reaction", ({ emoji }) => {
    const code = socket.data.roomCode;
    io.to(code).emit("emoji-reaction", {
      emoji,
      from: socket.data.name,
      fromId: socket.id,
    });
  });

  // ── Ready Status ─────────────────────────────────────────────────
  socket.on("ready-toggle", ({ ready }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;

    const user = room.users.get(socket.id);
    if (user) user.ready = ready;

    const allReady = Array.from(room.users.values()).every((u) => u.ready) && room.users.size === 2;

    io.to(code).emit("ready-update", {
      users: Array.from(room.users.values()),
      allReady,
    });

    if (allReady) {
      // Trigger synchronized play for both
      setTimeout(() => {
        const vs = room.videoState;
        io.to(code).emit("video-action", {
          type: "play",
          currentTime: vs.currentTime,
          from: "system",
        });
        vs.playing = true;
        vs.updatedAt = Date.now();
      }, 500);
    }
  });

  // ── Sync Request (new user wants current state) ──────────────────
  socket.on("request-sync", () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    socket.emit("sync-state", room.videoState);
  });

  // ── Disconnect ───────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const name = socket.data.name;
    room.users.delete(socket.id);
    socket.to(code).emit("partner-left", { name });
    console.log(`[-] ${name} left room ${code}`);

    // Clean up empty rooms after 10 min
    if (room.users.size === 0) {
      setTimeout(() => {
        if (rooms.get(code)?.users.size === 0) {
          rooms.delete(code);
          console.log(`[Room] Cleaned up: ${code}`);
        }
      }, 10 * 60 * 1000);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎬 CinemaDate running at http://localhost:${PORT}\n`);
});
