const express   = require('express');
const router    = express.Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const Officer   = require('../models/Officer');
const Complaint = require('../models/Complaint');

// ── Officer Auth Middleware ──
const officerAuth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token)
    return res.status(401).json({ message: 'Access denied. No token.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'officer')
      return res.status(403).json({ message: 'Officer access only.' });
    req.officer = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

// ── POST /api/officers/login ──
router.post('/login', async (req, res) => {
  try {
    const { badgeId, password } = req.body;

    if (!badgeId || !password)
      return res.status(400).json({ message: 'Badge ID and password are required' });

    // ✅ FIXED: search by badgeId field
    const officer = await Officer.findOne({ badgeId })
      .populate('station', 'name phone address');

    if (!officer)
      return res.status(401).json({ message: 'Invalid Badge ID or password' });

    if (officer.isActive === false)
      return res.status(403).json({
        message: 'Your account is inactive. Contact your Station In-Charge.'
      });

    const isMatch = await bcrypt.compare(password, officer.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid Badge ID or password' });

    const token = jwt.sign(
      { id: officer._id, role: 'officer', stationId: officer.station?._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      officer: {
        id:           officer._id,
        name:         officer.name,
        badgeId:      officer.badgeId,
        rank:         officer.rank         || 'Constable',
        email:        officer.email        || '',
        phone:        officer.phone        || '',
        station:      officer.station?.name  || 'Unassigned',
        stationId:    officer.station?._id   || null,
        stationPhone: officer.station?.phone || ''
      }
    });

  } catch (err) {
    console.error('Officer Login Error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/officers/profile ──
router.get('/profile', officerAuth, async (req, res) => {
  try {
    const officer = await Officer.findById(req.officer.id)
      .select('-password')
      .populate('station', 'name phone address');

    if (!officer)
      return res.status(404).json({ message: 'Officer not found' });

    res.json({ success: true, officer });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/officers/profile ──
router.put('/profile', officerAuth, async (req, res) => {
  try {
    const { name, email, phone, rank } = req.body;

    if (!name)
      return res.status(400).json({ message: 'Name is required' });

    const allowedRanks = ['Constable','Head Constable','ASI','SI','Inspector'];
    if (rank && !allowedRanks.includes(rank))
      return res.status(400).json({ message: 'Invalid rank value' });

    const officer = await Officer.findByIdAndUpdate(
      req.officer.id,
      { name, email, phone, rank },
      { new: true }
    ).select('-password').populate('station', 'name phone address');

    if (!officer)
      return res.status(404).json({ message: 'Officer not found' });

    res.json({ success: true, officer });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/officers/change-password ──
router.put('/change-password', officerAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'All fields are required' });

    if (newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const officer = await Officer.findById(req.officer.id);
    const isMatch = await bcrypt.compare(currentPassword, officer.password);

    if (!isMatch)
      return res.status(400).json({ message: 'Incorrect current password' });

    officer.password = await bcrypt.hash(newPassword, 10);
    await officer.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/officers/stats ──
router.get('/stats', officerAuth, async (req, res) => {
  try {
    const all = await Complaint.find({ assignedOfficer: req.officer.id });

    res.json({
      success: true,
      total:      all.length,
      submitted:  all.filter(c => c.status === 'Submitted').length,
      firFiled:   all.filter(c => c.status === 'FIR Filed').length,
      identified: all.filter(c => c.status === 'Criminal Identified').length,
      caught:     all.filter(c => c.status === 'Criminal Caught').length,
      closed:     all.filter(c => c.status === 'Case Closed').length,
      active:     all.filter(c =>
        ['FIR Filed','Criminal Identified','Criminal Caught'].includes(c.status)
      ).length
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/officers/complaints ──
router.get('/complaints', officerAuth, async (req, res) => {
  try {
    const complaints = await Complaint.find({ assignedOfficer: req.officer.id })
      .populate('userId',          'name email phone')  // ✅ FIXED: was 'user'
      .populate('assignedStation', 'name phone address')
      .sort({ createdAt: -1 });

    res.json({ success: true, complaints });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/officers/complaints/:id ──
router.get('/complaints/:id', officerAuth, async (req, res) => {
  try {
    const complaint = await Complaint.findOne({
      _id:             req.params.id,
      assignedOfficer: req.officer.id
    })
      .populate('userId',          'name email phone')  // ✅ FIXED: was 'user'
      .populate('assignedStation', 'name phone address');

    if (!complaint)
      return res.status(404).json({ message: 'Complaint not found or not assigned to you' });

    res.json({ success: true, complaint });
  } catch (err) {
    if (err.name === 'CastError')
      return res.status(404).json({ message: 'Invalid complaint ID' });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/officers/complaints/:id/status ──
router.put('/complaints/:id/status', officerAuth, async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const allowedStatuses = [
      'Submitted','FIR Filed','Criminal Identified','Criminal Caught','Case Closed'
    ];

    if (!status || !allowedStatuses.includes(status))
      return res.status(400).json({ message: 'Invalid status value' });

    const complaint = await Complaint.findOne({
      _id:             req.params.id,
      assignedOfficer: req.officer.id
    });

    if (!complaint)
      return res.status(404).json({ message: 'Complaint not found or not assigned to you' });

    // Prevent backward status change
    const currentIndex = allowedStatuses.indexOf(complaint.status);
    const newIndex     = allowedStatuses.indexOf(status);
    if (newIndex < currentIndex)
      return res.status(400).json({ message: 'Cannot revert to a previous status' });

    complaint.status = status;
    if (remarks) complaint.remarks = remarks;
    await complaint.save();

    res.json({
      success: true,
      message: 'Status updated successfully',
      complaint: { id: complaint._id, status: complaint.status }
    });

  } catch (err) {
    if (err.name === 'CastError')
      return res.status(404).json({ message: 'Invalid complaint ID' });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router; // ✅ ONLY ONE — at the very end
