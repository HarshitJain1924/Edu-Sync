import express from 'express';
import { v4 as uuid } from 'uuid';
import { StudyRoom } from '../models/StudyRoom.js';

const router = express.Router();

// Create a Study Room
router.post('/study-rooms', async (req, res) => {
  try {
    const { name, createdBy, members = [] } = req.body || {};
    if (!name || !createdBy) return res.status(400).json({ error: 'name and createdBy required' });
    let room;
    if (process.env.MONGO_URL) {
      room = await StudyRoom.create({ name, createdBy, members });
    } else {
      room = { _id: uuid(), name, createdBy, members };
    }
    res.json({ room });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Join a Study Room
router.post('/study-rooms/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (process.env.MONGO_URL) {
      await StudyRoom.findByIdAndUpdate(id, { $addToSet: { members: userId } }, { new: true });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get Study Room
router.get('/study-rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (process.env.MONGO_URL) {
      const room = await StudyRoom.findById(id);
      if (!room) return res.status(404).json({ error: 'Not found' });
      res.json({ room });
    } else {
      res.status(200).json({ room: { _id: id } });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get video token/room id
router.get('/study-rooms/:id/video-token', async (req, res) => {
  try {
    const { id } = req.params;
    const participantId = uuid();
    res.json({ roomId: id, participantId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
