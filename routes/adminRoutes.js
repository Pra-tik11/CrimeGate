const express     = require('express');
const router      = express.Router();
const bcrypt      = require('bcryptjs');
const jwt         = require('jsonwebtoken');
const Admin       = require('../models/Admin');
const Officer     = require('../models/Officer');
const Complaint   = require('../models/Complaint');
const Station     = require('../models/Station');
const User        = require('../models/User');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// ── POST /api/admin/login ──
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: admin._id, role: 'admin', email: admin.email, name: admin.name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true, message: 'Login successful', token,
      admin: { id: admin._id, name: admin.name, email: admin.email }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ── GET /api/admin/stats ──
router.get('/stats', async (req, res) => {
  try {
    const [
      total, submitted, firFiled, identified, caught, closed,
      activeOfficers, stations, totalUsers
    ] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: 'Submitted'            }),  // ✅ FIXED
      Complaint.countDocuments({ status: 'FIR Filed'            }),  // ✅ FIXED
      Complaint.countDocuments({ status: 'Criminal Identified'  }),  // ✅ FIXED
      Complaint.countDocuments({ status: 'Criminal Caught'      }),  // ✅ FIXED
      Complaint.countDocuments({ status: 'Case Closed'          }),  // ✅ FIXED
      Officer.countDocuments({ isActive: true }),
      Station.countDocuments(),
      User.countDocuments()
    ]);

    const pending        = submitted + firFiled;
    const resolutionRate = total ? Math.round((closed / total) * 100) : 0;

    res.json({
      success: true,
      total, submitted, firFiled, identified, caught, closed,
      pending, activeOfficers, stations, totalUsers, resolutionRate
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ── GET /api/admin/profile ──
router.get('/profile', verifyToken, isAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password');
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    res.json({ success: true, admin });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ── GET /api/admin/complaints ──
router.get('/complaints', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status, station, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status)  filter.status          = status;
    if (station) filter.assignedStation = station;  // ✅ FIXED

    const complaints = await Complaint.find(filter)
      .populate('userId',          'name email phone')   // ✅ FIXED: was 'user'
      .populate('assignedOfficer', 'name badgeNumber')   // ✅ FIXED: was 'officer'
      .populate('assignedStation', 'name address phone') // ✅ FIXED: was 'station'
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Complaint.countDocuments(filter);

    res.json({ success: true, complaints, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ── GET /api/admin/complaints/:id ──
router.get('/complaints/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('userId',          'name email phone')    // ✅ FIXED
      .populate('assignedOfficer', 'name badgeNumber phone') // ✅ FIXED
      .populate('assignedStation', 'name address phone');    // ✅ FIXED

    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found' });

    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ── PUT /api/admin/complaints/:id/assign ──
router.put('/complaints/:id/assign', verifyToken, isAdmin, async (req, res) => {
  try {
    const { officerId } = req.body;
    if (!officerId)
      return res.status(400).json({ success: false, message: 'officerId is required' });

    const officer = await Officer.findById(officerId);
    if (!officer)
      return res.status(404).json({ success: false, message: 'Officer not found' });

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      {
        assignedOfficer: officerId,          // ✅ FIXED: was 'officer'
        assignedStation: officer.station,    // ✅ FIXED: was 'station'
        status:    'FIR Filed',              // ✅ FIXED: was 'fir_filed'
        assignedAt: Date.now()
      },
      { new: true }
    )
      .populate('userId',          'name email')
      .populate('assignedOfficer', 'name badgeNumber')
      .populate('assignedStation', 'name address');

    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found' });

    res.json({ success: true, message: 'Officer assigned successfully', complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ── PUT /api/admin/complaints/:id/status ──
router.put('/complaints/:id/status', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status, remarks } = req.body;
    // ✅ FIXED: status values now match Complaint.js enum
    const allowed = ['Submitted','FIR Filed','Criminal Identified','Criminal Caught','Case Closed'];

    if (!allowed.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status value' });

    const update = { status };
    if (remarks) update.remarks = remarks;

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found' });

    res.json({ success: true, message: 'Status updated', complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ── GET /api/admin/officers ──
router.get('/officers', verifyToken, isAdmin, async (req, res) => {
  try {
    const officers = await Officer.find()
      .select('-password')
      .populate('station', 'name')
      .sort({ name: 1 });
    res.json({ success: true, officers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ── POST /api/admin/officers ──
router.post('/officers', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, badgeId, email, phone, password, station, rank } = req.body;

    if (!name || !badgeId || !password || !station)
      return res.status(400).json({ success: false, message: 'name, badgeId, password and station are required' });

    const exists = await Officer.findOne({ $or: [{ badgeId }, { email }] });
    if (exists)
      return res.status(409).json({ success: false, message: 'Officer with this Badge ID or Email already exists' });

    const hashedPwd = await bcrypt.hash(password, 12);

    const officer = await Officer.create({
      name, badgeId, email: email || '', phone: phone || '',
      password: hashedPwd, station, rank: rank || 'Constable', isActive: true
    });

    const result = officer.toObject();
    delete result.password;

    res.status(201).json({ success: true, message: 'Officer created successfully', officer: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ── PUT /api/admin/officers/:id ──
router.put('/officers/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, email, phone, station, rank, isActive } = req.body;

    const officer = await Officer.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, station, rank, isActive },
      { new: true, runValidators: true }
    ).select('-password');

    if (!officer)
      return res.status(404).json({ success: false, message: 'Officer not found' });

    res.json({ success: true, message: 'Officer updated', officer });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ── DELETE /api/admin/officers/:id ──
router.delete('/officers/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const activeComplaints = await Complaint.countDocuments({
      assignedOfficer: req.params.id,              // ✅ FIXED: was 'officer'
      status: { $nin: ['Case Closed'] }            // ✅ FIXED: was 'closed'
    });

    if (activeComplaints > 0)
      return res.status(400).json({
        success: false,
        message: `Cannot delete — officer has ${activeComplaints} active complaint(s)`
      });

    const officer = await Officer.findByIdAndDelete(req.params.id);
    if (!officer)
      return res.status(404).json({ success: false, message: 'Officer not found' });

    res.json({ success: true, message: 'Officer deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ── GET /api/admin/users ──
router.get('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
