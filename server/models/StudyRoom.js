import mongoose from 'mongoose';

const StudyRoomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdBy: { type: String, required: true },
  members: { type: [String], default: [] },
}, { timestamps: true });

export const StudyRoom = mongoose.models.StudyRoom || mongoose.model('StudyRoom', StudyRoomSchema);
