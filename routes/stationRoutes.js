// routes/stationRoutes.js
const express   = require('express');
const router    = express.Router();
const Station   = require('../models/Station');
const Officer   = require('../models/Officer');
const Complaint = require('../models/Complaint');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// ══════════════════════════════════════════════════
//  GET ALL STATIONS  (Public)
// ══════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const stations = await Station.find().sort({ name: 1 });
    res.json({ success: true, stations });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════
//  GET SINGLE STATION BY ID
// ══════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const station = await Station.findById(req.params.id);
    if (!station) return res.status(404).json({ success: false, message: 'Station not found' });
    res.json({ success: true, station });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════
//  GET STATION OFFICERS  (Admin only)
// ══════════════════════════════════════════════════
router.get('/:id/officers', verifyToken, isAdmin, async (req, res) => {
  try {
    const officers = await Officer.find({ station: req.params.id })
      .select('-password')
      .sort({ name: 1 });
    res.json({ success: true, officers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════
//  GET STATION COMPLAINTS  (Admin only)
// ══════════════════════════════════════════════════
router.get('/:id/complaints', verifyToken, isAdmin, async (req, res) => {
  try {
    const complaints = await Complaint.find({ station: req.params.id })
      .populate('user',    'name email phone')
      .populate('officer', 'name badgeId')
      .sort({ createdAt: -1 });
    res.json({ success: true, complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════
//  GET STATION STATS  (Admin only)
// ══════════════════════════════════════════════════
router.get('/:id/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const stationId = req.params.id;

    const [
      totalComplaints,
      submitted,
      firFiled,
      identified,
      caught,
      closed,
      totalOfficers
    ] = await Promise.all([
      Complaint.countDocuments({ station: stationId }),
      Complaint.countDocuments({ station: stationId, status: 'submitted'  }),
      Complaint.countDocuments({ station: stationId, status: 'fir_filed'  }),
      Complaint.countDocuments({ station: stationId, status: 'identified' }),
      Complaint.countDocuments({ station: stationId, status: 'caught'     }),
      Complaint.countDocuments({ station: stationId, status: 'closed'     }),
      Officer.countDocuments(  { station: stationId                       })
    ]);

    const resolutionRate = totalComplaints
      ? Math.round((closed / totalComplaints) * 100)
      : 0;

    res.json({
      success: true,
      stats: {
        totalComplaints,
        submitted,
        firFiled,
        identified,
        caught,
        closed,
        totalOfficers,
        resolutionRate
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════
//  CREATE STATION  (Admin only)
// ══════════════════════════════════════════════════
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, address, city, phone, email, inCharge } = req.body;

    if (!name || !address || !city) {
      return res.status(400).json({
        success: false,
        message: 'Name, address and city are required'
      });
    }

    const existing = await Station.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Station already exists' });
    }

    const station = await Station.create({
      name:     name.trim(),
      address:  address.trim(),
      city:     city.trim(),
      phone:    phone    || '',
      email:    email    || '',
      inCharge: inCharge || ''
    });

    res.status(201).json({
      success: true,
      message: 'Station created successfully',
      station
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════
//  UPDATE STATION  (Admin only)
// ══════════════════════════════════════════════════
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, address, city, phone, email, inCharge } = req.body;

    const station = await Station.findByIdAndUpdate(
      req.params.id,
      { name, address, city, phone, email, inCharge },
      { new: true, runValidators: true }
    );

    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }

    res.json({ success: true, message: 'Station updated successfully', station });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════
//  DELETE STATION  (Admin only)
// ══════════════════════════════════════════════════
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const officerCount   = await Officer.countDocuments({ station: req.params.id });
    const complaintCount = await Complaint.countDocuments({ station: req.params.id });

    if (officerCount > 0 || complaintCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — station has ${officerCount} officer(s) and ${complaintCount} complaint(s) linked`
      });
    }

    const station = await Station.findByIdAndDelete(req.params.id);
    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }

    res.json({ success: true, message: 'Station deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
