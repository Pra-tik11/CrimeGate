require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const path      = require('path');
const bcrypt    = require('bcryptjs');

const app = express();

// ═══════════════════════════════════════════
//  MIDDLEWARE
// ═══════════════════════════════════════════
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ═══════════════════════════════════════════
//  MONGODB CONNECTION
// ═══════════════════════════════════════════
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully!'))
  .catch(err => console.log('❌ Connection Error:', err));

// ═══════════════════════════════════════════
//  MODELS
// ═══════════════════════════════════════════
const User      = require('./models/User');
const Officer   = require('./models/Officer');
const Complaint = require('./models/Complaint');
const Station   = require('./models/Station');

// ═══════════════════════════════════════════
//  AUTH MIDDLEWARE
// ═══════════════════════════════════════════
const auth = require('./middleware/auth');

// ═══════════════════════════════════════════
//  COMPLAINT INLINE ROUTES
// ═══════════════════════════════════════════
app.get('/api/complaints/my', auth, async (req, res) => {
  try {
    const complaints = await Complaint.find({ userId: req.user.id })
      .populate('assignedStation', 'name phone')
      .populate('assignedOfficer', 'name phone')
      .sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    console.error('GET /api/complaints/my error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/complaints/track/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('assignedStation', 'name phone address')
      .populate('assignedOfficer', 'name phone badgeNumber');

    if (!complaint)
      return res.status(404).json({ message: 'Complaint not found' });

    // ✅ Fixed: use userId consistently
    if (complaint.userId.toString() !== req.user.id)
      return res.status(403).json({ message: 'Access denied' });

    res.json(complaint);
  } catch (err) {
    if (err.name === 'CastError')
      return res.status(404).json({ message: 'Invalid Complaint ID' });
    console.error('GET /api/complaints/track error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════
app.use('/api/users',      require('./routes/userRoutes'));
app.use('/api/officers',   require('./routes/officerRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/stations',   require('./routes/stationRoutes'));
app.use('/api/admin',      require('./routes/adminRoutes'));
app.use('/api/hq',         require('./routes/hqRoutes'));

// ═══════════════════════════════════════════
//  USER PROFILE ROUTES
// ═══════════════════════════════════════════
app.get('/api/users/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('GET /api/users/profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/users/profile', auth, async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    if (!name || !email)
      return res.status(400).json({ message: 'Name and email are required' });

    const existing = await User.findOne({ email, _id: { $ne: req.user.id } });
    if (existing)
      return res.status(400).json({ message: 'Email already in use' });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email, phone, address },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    console.error('PUT /api/users/profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/users/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'All fields are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const user    = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: 'Incorrect current password' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('PUT /api/users/change-password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/users/delete', auth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    // ✅ Fixed: was 'user', now 'userId' to match Complaint model
    await Complaint.deleteMany({ userId: req.user.id });
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('DELETE /api/users/delete error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════
//  PAGE ROUTES (HTML serving)
// ═══════════════════════════════════════════
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Citizen ──
app.get('/userlogin',              (req, res) => res.sendFile(path.join(__dirname, 'public/user/login.html')));
app.get('/userregister',           (req, res) => res.sendFile(path.join(__dirname, 'public/user/register.html')));
app.get('/user/dashboard',         (req, res) => res.sendFile(path.join(__dirname, 'public/user/dashboard.html')));
app.get('/user/file-complaint',    (req, res) => res.sendFile(path.join(__dirname, 'public/user/file-complaint.html')));
app.get('/user/complaint-history', (req, res) => res.sendFile(path.join(__dirname, 'public/user/complaint-history.html')));
app.get('/user/track-status',      (req, res) => res.sendFile(path.join(__dirname, 'public/user/track-status.html')));
app.get('/user/profile',           (req, res) => res.sendFile(path.join(__dirname, 'public/user/profile.html')));

// ── Officer ──
app.get('/officer/officer-login.html', (req, res) => res.sendFile(path.join(__dirname, 'public/officer/officer-login.html')));
app.get('/officer/dashboard',          (req, res) => res.sendFile(path.join(__dirname, 'public/officer/officer-dashboard.html')));
app.get('/officer/profile',            (req, res) => res.sendFile(path.join(__dirname, 'public/officer/officer-profile.html')));

// ── Station ──
app.get('/stationincharge-login.html', (req, res) => res.sendFile(path.join(__dirname, 'public/station/incharge-login.html')));
app.get('/station/dashboard',          (req, res) => res.sendFile(path.join(__dirname, 'public/station/incharge-dashboard.html')));

// ── Admin ──
app.get('/admin/admin-login.html', (req, res) => res.sendFile(path.join(__dirname, 'public/admin/admin-login.html')));
app.get('/admin/dashboard',        (req, res) => res.sendFile(path.join(__dirname, 'public/admin/admin-dashboard.html')));

// ── HQ ──
app.get('/hq/hq-login.html',     (req, res) => res.sendFile(path.join(__dirname, 'public/hq/hq-login.html')));
app.get('/hq/hq-dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'public/hq/hq-dashboard.html')));

// ═══════════════════════════════════════════
//  404 FALLBACK
// ═══════════════════════════════════════════
app.use((req, res) => {
  res.status(404).json({ message: '404 — Route not found' });
});

// ═══════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at  → http://localhost:${PORT}`);
  console.log(`🗄️  MongoDB URI        → ${process.env.MONGO_URI ? '✅ Set' : '❌ Not Set'}`);
  console.log(`🔑 JWT Secret         → ${process.env.JWT_SECRET ? '✅ Set' : '❌ Not Set'}`);
});
