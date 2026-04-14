const mongoose = require('mongoose');

const FriendRequestSchema = new mongoose.Schema({
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  timestamp: { type: Number, default: Date.now }
});

module.exports = mongoose.model('FriendRequest', FriendRequestSchema);
