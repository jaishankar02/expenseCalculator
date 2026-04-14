const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Person = require('./models/Person');
const Expense = require('./models/Expense');
const SettlementRequest = require('./models/SettlementRequest');
const FriendRequest = require('./models/FriendRequest');
const ExpenseDeleteRequest = require('./models/ExpenseDeleteRequest');

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/$/, '');

const CLIENT_URLS = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map((url) => normalizeOrigin(url))
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);

  if (normalizedOrigin.includes('localhost') || normalizedOrigin.includes('127.0.0.1')) {
    return true;
  }

  if (CLIENT_URLS.length === 0) {
    return true;
  }

  return CLIENT_URLS.some((allowed) => {
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(1);
      return normalizedOrigin.endsWith(suffix);
    }
    return allowed === normalizedOrigin;
  });
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;

const normalizePhone = (phone) => {
  const digitsOnly = String(phone || '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  return digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
};

const normalizeUpiId = (upiId) => String(upiId || '').trim().toLowerCase();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Missing MONGO_URI environment variable');
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error('Missing JWT_SECRET environment variable');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch(err => console.error("MongoDB Connection Error:", err));

// Change Streams - Real-time sync
const watchChanges = () => {
  Person.watch().on('change', (change) => {
    io.emit('data_changed');
  });
  Expense.watch().on('change', (change) => {
    io.emit('data_changed');
  });
  SettlementRequest.watch().on('change', (change) => {
    io.emit('data_changed');
  });
  FriendRequest.watch().on('change', (change) => {
    io.emit('data_changed');
  });
  ExpenseDeleteRequest.watch().on('change', (change) => {
    io.emit('data_changed');
  });
};
watchChanges();

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'hishabchecker-server' });
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

// AUTH ROUTES

// Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, phone, upiId, email, password } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const normalizedUpiId = normalizeUpiId(upiId);
    
    if (!name || !phone || !password || !upiId) {
      return res.status(400).json({ error: 'Name, phone, upiId, and password are required' });
    }

    if (normalizedPhone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid phone number' });
    }

    if (!normalizedUpiId.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid UPI ID (example: name@upi)' });
    }

    // Check if phone already exists
    const existingUser = await Person.findOne({ phone: normalizedPhone });
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    const existingUpi = await Person.findOne({ upiId: normalizedUpiId });
    if (existingUpi) {
      return res.status(400).json({ error: 'UPI ID already registered' });
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    const person = new Person({
      name,
      phone: normalizedPhone,
      upiId: normalizedUpiId,
      email,
      password: hashedPassword,
      friends: []
    });

    await person.save();

    // Create JWT token
    const token = jwt.sign({ id: person._id, phone: person.phone }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: person._id, name: person.name, phone: person.phone, upiId: person.upiId, email: person.email, friends: person.friends }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }

    const person = await Person.findOne({
      $or: [
        { phone: normalizedPhone },
        { phone: String(phone).trim() }
      ]
    });
    if (!person) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    // Compare password
    let isPasswordValid = await bcryptjs.compare(password, person.password);

    // Backward compatibility: migrate legacy plain-text passwords to hashed passwords
    if (!isPasswordValid && person.password === password) {
      isPasswordValid = true;
      person.password = await bcryptjs.hash(password, 10);
      await person.save();
    }

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    // Create JWT token
    const token = jwt.sign({ id: person._id, phone: person.phone }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: person._id, name: person.name, phone: person.phone, upiId: person.upiId, email: person.email, friends: person.friends }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search user by phone
app.get('/api/users/search/:phone', verifyToken, async (req, res) => {
  try {
    const normalizedPhone = normalizePhone(req.params.phone);
    const user = await Person.findOne({
      $or: [
        { phone: normalizedPhone },
        { phone: String(req.params.phone).trim() }
      ]
    }).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const user = await Person.findById(req.userId).select('-password').populate('friends', '-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add friend
app.post('/api/users/add-friend', verifyToken, async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId) {
      return res.status(400).json({ error: 'friendId is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ error: 'Invalid friendId format' });
    }

    if (String(friendId) === String(req.userId)) {
      return res.status(400).json({ error: 'You cannot send friend request to yourself' });
    }

    const user = await Person.findById(req.userId);
    const targetUser = await Person.findById(friendId);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const alreadyFriends = user.friends.some((id) => String(id) === String(friendId));
    if (alreadyFriends) {
      return res.status(400).json({ error: 'Already friends' });
    }

    const existingPending = await FriendRequest.findOne({
      status: 'pending',
      $or: [
        { fromUserId: req.userId, toUserId: friendId },
        { fromUserId: friendId, toUserId: req.userId }
      ]
    });

    if (existingPending) {
      return res.status(400).json({ error: 'Friend request already pending' });
    }

    const request = new FriendRequest({
      fromUserId: req.userId,
      toUserId: friendId,
      status: 'pending',
      timestamp: Date.now()
    });
    await request.save();

    const populatedRequest = await FriendRequest.findById(request._id)
      .populate('fromUserId', '-password')
      .populate('toUserId', '-password');

    res.status(201).json({ message: 'Friend request sent', request: populatedRequest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/friend-requests', verifyToken, async (req, res) => {
  try {
    const type = req.query.type || 'incoming';
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    let filter = { status: 'pending' };

    if (type === 'outgoing') {
      filter.fromUserId = req.userId;
    } else {
      filter.toUserId = req.userId;
    }

    if (hasPagination) {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        FriendRequest.find(filter)
          .populate('fromUserId', '-password')
          .populate('toUserId', '-password')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit),
        FriendRequest.countDocuments(filter)
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));
      return res.json({ items, total, page, limit, totalPages });
    }

    const requests = await FriendRequest.find(filter)
      .populate('fromUserId', '-password')
      .populate('toUserId', '-password')
      .sort({ timestamp: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/friend-requests/:id/respond', verifyToken, async (req, res) => {
  try {
    const { action } = req.body;
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be accept or reject' });
    }

    const request = await FriendRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (String(request.toUserId) !== String(req.userId)) {
      return res.status(403).json({ error: 'Only receiver can respond to this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }

    if (action === 'accept') {
      const fromUser = await Person.findById(request.fromUserId);
      const toUser = await Person.findById(request.toUserId);

      if (!fromUser || !toUser) {
        return res.status(404).json({ error: 'One or both users not found' });
      }

      const fromHasTo = fromUser.friends.some((id) => String(id) === String(toUser._id));
      const toHasFrom = toUser.friends.some((id) => String(id) === String(fromUser._id));

      if (!fromHasTo) fromUser.friends.push(toUser._id);
      if (!toHasFrom) toUser.friends.push(fromUser._id);

      await fromUser.save();
      await toUser.save();

      request.status = 'accepted';
      await request.save();

      return res.json({ message: 'Friend request accepted' });
    }

    request.status = 'rejected';
    await request.save();
    return res.json({ message: 'Friend request rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API Routes (Updated for user-specific data)
app.get('/api/people', verifyToken, async (req, res) => {
  try {
    const currentUser = await Person.findById(req.userId).populate('friends', '-password');
    const friends = currentUser.friends;
    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/people', verifyToken, async (req, res) => {
  try {
    const person = new Person(req.body);
    await person.save();
    res.status(201).json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/people/:id', verifyToken, async (req, res) => {
  try {
    await Person.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settlements/received', verifyToken, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const filter = { toUserId: req.userId };
    if (status !== 'all') {
      filter.status = status;
    }

    if (hasPagination) {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        SettlementRequest.find(filter)
          .populate('fromUserId', '-password')
          .populate('toUserId', '-password')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit),
        SettlementRequest.countDocuments(filter)
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));
      return res.json({ items, total, page, limit, totalPages });
    }

    const requests = await SettlementRequest.find(filter)
      .populate('fromUserId', '-password')
      .populate('toUserId', '-password')
      .sort({ timestamp: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settlements/sent', verifyToken, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const filter = { fromUserId: req.userId };
    if (status !== 'all') {
      filter.status = status;
    }

    if (hasPagination) {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        SettlementRequest.find(filter)
          .populate('fromUserId', '-password')
          .populate('toUserId', '-password')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit),
        SettlementRequest.countDocuments(filter)
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));
      return res.json({ items, total, page, limit, totalPages });
    }

    const requests = await SettlementRequest.find(filter)
      .populate('fromUserId', '-password')
      .populate('toUserId', '-password')
      .sort({ timestamp: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settlements/request', verifyToken, async (req, res) => {
  try {
    const { toUserId, amount } = req.body;

    if (!toUserId || !amount) {
      return res.status(400).json({ error: 'toUserId and amount are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(toUserId)) {
      return res.status(400).json({ error: 'Invalid receiver ID format' });
    }

    if (String(toUserId) === String(req.userId)) {
      return res.status(400).json({ error: 'Cannot create settlement request for yourself' });
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const receiver = await Person.findById(toUserId).select('_id');
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver user not found' });
    }

    const settlementRequest = new SettlementRequest({
      fromUserId: req.userId,
      toUserId,
      amount: parseFloat(amount),
      status: 'pending',
      timestamp: Date.now()
    });

    await settlementRequest.save();

    const populatedRequest = await SettlementRequest.findById(settlementRequest._id)
      .populate('fromUserId', '-password')
      .populate('toUserId', '-password');

    res.status(201).json(populatedRequest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settlements/:id/respond', verifyToken, async (req, res) => {
  try {
    const { action } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approve or reject' });
    }

    const settlementRequest = await SettlementRequest.findById(req.params.id);
    if (!settlementRequest) {
      return res.status(404).json({ error: 'Settlement request not found' });
    }

    if (String(settlementRequest.toUserId) !== String(req.userId)) {
      return res.status(403).json({ error: 'Only receiver can approve/reject this request' });
    }

    if (settlementRequest.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${settlementRequest.status}` });
    }

    if (action === 'approve') {
      const payer = await Person.findById(settlementRequest.fromUserId).select('name');
      const receiver = await Person.findById(settlementRequest.toUserId).select('name');

      const expense = new Expense({
        description: `Settlement paid to ${receiver?.name || 'friend'}`,
        amount: settlementRequest.amount,
        payerId: settlementRequest.fromUserId,
        beneficiaryIds: [settlementRequest.toUserId],
        date: new Date().toLocaleDateString(),
        timestamp: Date.now()
      });
      await expense.save();

      settlementRequest.status = 'approved';
      settlementRequest.approvedAt = Date.now();
      settlementRequest.settlementExpenseId = expense._id;
      await settlementRequest.save();
    } else {
      settlementRequest.status = 'rejected';
      settlementRequest.rejectedAt = Date.now();
      await settlementRequest.save();
    }

    const updatedRequest = await SettlementRequest.findById(settlementRequest._id)
      .populate('fromUserId', '-password')
      .populate('toUserId', '-password')
      .populate('settlementExpenseId');

    res.json(updatedRequest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/expenses', verifyToken, async (req, res) => {
  try {
    const filter = { $or: [{ payerId: req.userId }, { beneficiaryIds: req.userId }] };
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;

    if (hasPagination) {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        Expense.find(filter)
          .populate('payerId', '-password')
          .populate('beneficiaryIds', '-password')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit),
        Expense.countDocuments(filter)
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return res.json({
        items,
        total,
        page,
        limit,
        totalPages
      });
    }

    const expenses = await Expense.find(filter)
      .populate('payerId', '-password')
      .populate('beneficiaryIds', '-password')
      .sort({ timestamp: -1 });

    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses', verifyToken, async (req, res) => {
  try {
    const { description, amount, payerId, beneficiaryIds, date } = req.body;

    console.log('Creating expense with data:', {
      description,
      amount,
      payerId,
      beneficiaryIds,
      date
    });

    // Validation
    if (!description || !amount || !payerId || !beneficiaryIds || beneficiaryIds.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: description, amount, payerId, beneficiaryIds' });
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    let resolvedPayerId = payerId;
    if (!mongoose.Types.ObjectId.isValid(resolvedPayerId)) {
      const payerUser = await Person.findOne({
        $or: [{ name: resolvedPayerId }, { phone: resolvedPayerId }]
      }).select('_id');
      if (!payerUser) {
        console.error('Invalid payer ID:', payerId);
        return res.status(400).json({ error: `Invalid payer ID format: "${payerId}"` });
      }
      resolvedPayerId = String(payerUser._id);
    }

    const resolvedBeneficiaryIds = [];
    for (let i = 0; i < beneficiaryIds.length; i++) {
      const beneficiary = beneficiaryIds[i];
      if (mongoose.Types.ObjectId.isValid(beneficiary)) {
        resolvedBeneficiaryIds.push(String(beneficiary));
        continue;
      }

      const beneficiaryUser = await Person.findOne({
        $or: [{ name: beneficiary }, { phone: beneficiary }]
      }).select('_id');

      if (!beneficiaryUser) {
        console.error('Invalid beneficiary ID at position', i, ':', beneficiary);
        return res.status(400).json({ error: `Invalid beneficiary ID format at position ${i}: "${beneficiary}"` });
      }

      resolvedBeneficiaryIds.push(String(beneficiaryUser._id));
    }

    // Create expense with proper ObjectIds (mongoose will handle conversion)
    const expense = new Expense({
      description,
      amount: parseFloat(amount),
      payerId: resolvedPayerId,
      beneficiaryIds: resolvedBeneficiaryIds,
      date: date || new Date().toLocaleDateString(),
      timestamp: Date.now()
    });

    await expense.save();

    // Populate the data before sending response
    const populatedExpense = await Expense.findById(expense._id)
      .populate('payerId', '-password')
      .populate('beneficiaryIds', '-password');

    console.log('Expense created successfully:', populatedExpense._id);
    res.status(201).json(populatedExpense);
  } catch (err) {
    console.error('Expense creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses/:id/delete-request', verifyToken, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const participantIds = new Set([
      String(expense.payerId),
      ...(expense.beneficiaryIds || []).map((id) => String(id))
    ]);

    if (!participantIds.has(String(req.userId))) {
      return res.status(403).json({ error: 'Only participants can request deletion' });
    }

    const otherParticipantIds = Array.from(participantIds).filter((id) => id !== String(req.userId));

    if (otherParticipantIds.length === 0) {
      await Expense.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Expense deleted (no approval needed)', deleted: true });
    }

    const approverId = otherParticipantIds[0];

    const existingPending = await ExpenseDeleteRequest.findOne({
      expenseId: expense._id,
      status: 'pending'
    });

    if (existingPending) {
      return res.status(400).json({ error: 'Delete request already pending for this transaction' });
    }

    const deleteRequest = new ExpenseDeleteRequest({
      expenseId: expense._id,
      requesterId: req.userId,
      approverId,
      status: 'pending',
      timestamp: Date.now()
    });

    await deleteRequest.save();

    const populated = await ExpenseDeleteRequest.findById(deleteRequest._id)
      .populate('requesterId', '-password')
      .populate('approverId', '-password')
      .populate('expenseId');

    return res.status(201).json({ message: 'Delete request sent for approval', request: populated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/expenses/delete-requests', verifyToken, async (req, res) => {
  try {
    const type = req.query.type || 'incoming';
    const status = req.query.status || 'pending';
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;

    const filter = {};
    if (type === 'outgoing') {
      filter.requesterId = req.userId;
    } else {
      filter.approverId = req.userId;
    }
    if (status !== 'all') {
      filter.status = status;
    }

    if (hasPagination) {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        ExpenseDeleteRequest.find(filter)
          .populate('requesterId', '-password')
          .populate('approverId', '-password')
          .populate('expenseId')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit),
        ExpenseDeleteRequest.countDocuments(filter)
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));
      return res.json({ items, total, page, limit, totalPages });
    }

    const requests = await ExpenseDeleteRequest.find(filter)
      .populate('requesterId', '-password')
      .populate('approverId', '-password')
      .populate('expenseId')
      .sort({ timestamp: -1 });

    return res.json(requests);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses/delete-requests/:id/respond', verifyToken, async (req, res) => {
  try {
    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approve or reject' });
    }

    const request = await ExpenseDeleteRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Delete request not found' });
    }

    if (String(request.approverId) !== String(req.userId)) {
      return res.status(403).json({ error: 'Only approver can respond to this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }

    if (action === 'approve') {
      await Expense.findByIdAndDelete(request.expenseId);
      request.status = 'approved';
      request.approvedAt = Date.now();
      await request.save();
      return res.json({ message: 'Delete approved. Transaction removed.' });
    }

    request.status = 'rejected';
    request.rejectedAt = Date.now();
    await request.save();
    return res.json({ message: 'Delete request rejected.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/expenses/:id', verifyToken, async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
