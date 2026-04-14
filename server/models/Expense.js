const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  payerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  beneficiaryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }],
  date: { type: String },
  groupId: { type: String }, // for grouping expenses per user/group
  timestamp: { type: Number, default: Date.now }
});

module.exports = mongoose.model('Expense', ExpenseSchema);
