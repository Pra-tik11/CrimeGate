const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const Officer  = require('../models/Officer');
const Complaint = require('../models/Complaint');
const auth     = require('../middleware/auth');

// ── POST /api/officers/login ──
router.post('/login', async (req, res) => {
  try {
    const { badgeId, password } = req.body;

    if (!badgeId || !password)
      return res.status(400).json({ message: 'Badge ID and password are required' });

    // ✅ FIXED: was badgeNumber, now badgeId
    const officer = await Officer.findOne({ badgeId })
      .populate('station', 'name address phone');

    if (!officer)
      return res.status(401).json({ message: 'Invalid Badge ID or password' });

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
        id:      officer._id,
        name:    officer.name,
        badgeId: officer.badgeId,       // ✅ FIXED: was badgeNumber
        rank:    officer.rank,
        station: officer.station?.name || 'Unassigned',
        stationId: officer.station?._id || null,
        email:   officer.email
      }
    });

  } catch (err) {
    console.error('Officer login error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/officers/my-complaints ──
router.get('/my-complaints', auth, async (req, res) => {
  try {
    const complaints = await Complaint.find({ assignedOfficer: req.user.id })
      .populate('userId',          'name email phone')
      .populate('assignedStation', 'name address')
      .sort({ createdAt: -1 });

    res.json({ success: true, complaints });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/officers/update-status/:id ──
router.put('/update-status/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Submitted','FIR Filed','Criminal Identified','Criminal Caught','Case Closed'];

    if (!allowed.includes(status))
      return res.status(400).json({ message: 'Invalid status value' });

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!complaint)
      return res.status(404).json({ message: 'Complaint not found' });

    res.json({ success: true, message: 'Status updated', complaint });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/officers/profile ──
router.get('/profile', auth, async (req, res) => {
  try {
    const officer = await Officer.findById(req.user.id)
      .select('-password')
      .populate('station', 'name address phone');

    if (!officer)
      return res.status(404).json({ message: 'Officer not found' });

    res.json({ success: true, officer });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
