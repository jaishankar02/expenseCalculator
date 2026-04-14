const mongoose = require('mongoose');

const SettlementRequestSchema = new mongoose.Schema({
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  settlementExpenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },
  approvedAt: { type: Number },
  rejectedAt: { type: Number },
  timestamp: { type: Number, default: Date.now }
});

module.exports = mongoose.model('SettlementRequest', SettlementRequestSchema);
