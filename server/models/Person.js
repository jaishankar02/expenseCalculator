const mongoose = require('mongoose');

const PersonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  upiId: { type: String, required: true, unique: true, sparse: true, trim: true, lowercase: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }],
  timestamp: { type: Number, default: Date.now }
});

module.exports = mongoose.model('Person', PersonSchema);
