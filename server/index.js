import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import pdf from 'pdf-parse';
import studyRoomsRouter from './routes/studyRooms.js';

const app = express();
app.use(cors({ origin: '*'}));
app.use(express.json({ limit: '5mb' }));

const httpServer = createServer(app);
const io = new IOServer(httpServer, { cors: { origin: '*' } });

// Socket.io signaling
io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId, name }) => {
    socket.data.name = name || 'Guest';
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', { socketId: socket.id, name: socket.data.name });
  });

  socket.on('signal', ({ to, data }) => {
    io.to(to).emit('signal', { from: socket.id, data });
  });

  socket.on('leave-room', ({ roomId }) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user-left', { socketId: socket.id });
  });

  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('user-left', { socketId: socket.id });
      }
    }
  });
});

// API routes
app.use('/api', studyRoomsRouter);

// PDF resume parsing endpoint
app.post('/api/parse-resume-pdf', async (req, res) => {
  try {
    const { data } = req.body || {};
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'Missing PDF data' });
    }

    const buffer = Buffer.from(data, 'base64');
    const parsed = await pdf(buffer);
    const text = parsed?.text || '';

    return res.json({ text });
  } catch (err) {
    console.error('PDF parse error', err);
    return res.status(500).json({ error: 'Failed to parse PDF' });
  }
});

const PORT = process.env.PORT || 4000;
const MONGO_URL = process.env.MONGO_URL || '';

async function start() {
  if (MONGO_URL) {
    await mongoose.connect(MONGO_URL);
    console.log('Mongo connected');
  } else {
    console.log('WARNING: No MONGO_URL provided. API will run without DB writes.');
  }
  httpServer.listen(PORT, () => console.log(`Server running on :${PORT}`));
}

start().catch((e) => console.error(e));
