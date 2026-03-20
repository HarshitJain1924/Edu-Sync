import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import pdf from "pdf-parse";

const app = express();

// Allow JSON bodies and CORS for API calls (e.g. resume PDF parsing)
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "5mb" }));

// PDF resume parsing endpoint used by the Resume Builder
app.post("/api/parse-resume-pdf", async (req, res) => {
  try {
    const { data } = req.body || {};
    if (!data || typeof data !== "string") {
      return res.status(400).json({ error: "Missing PDF data" });
    }

    const buffer = Buffer.from(data, "base64");
    const parsed = await pdf(buffer);
    const text = parsed?.text || "";

    return res.json({ text });
  } catch (err) {
    console.error("PDF parse error", err);
    return res.status(500).json({ error: "Failed to parse PDF" });
  }
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", socket => {
  socket.on("join-room", ({ roomId, name, userId }) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
      name,
      userId
    });
  });

  socket.on("signal", (payload) => {
    io.to(payload.to).emit("signal", {
      ...payload,
      from: socket.id
    });
  });

  socket.on("update-metadata", ({ roomId, name, userId }) => {
    socket.to(roomId).emit("metadata-updated", {
      socketId: socket.id,
      name,
      userId
    });
  });

  socket.on("leave-room", ({ roomId }) => {
    socket.to(roomId).emit("user-left", {
      socketId: socket.id
    });
  });

  socket.on("disconnecting", () => {
    // Notify all rooms this socket was in that it's leaving
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit("user-left", { socketId: socket.id });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`WebRTC signaling server running on port ${PORT}`);
});
