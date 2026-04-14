const mongoose = require('mongoose');

const ExpenseDeleteRequestSchema = new mongoose.Schema({
  expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', required: true },
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedAt: { type: Number },
  rejectedAt: { type: Number },
  timestamp: { type: Number, default: Date.now }
});

module.exports = mongoose.model('ExpenseDeleteRequest', ExpenseDeleteRequestSchema);
