const router    = require('express').Router();
const multer    = require('multer');
const path      = require('path');
const auth      = require('../middleware/auth');
const Complaint = require('../models/Complaint');
const PoliceStation = require('../models/PoliceStation');
const Officer   = require('../models/Officer');

// ── File Upload Setup ─────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|mp4|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    ext ? cb(null, true) : cb(new Error('Only images, videos and PDFs allowed'));
  }
});

// ── File Complaint ────────────────────────────────
router.post('/file', auth, upload.single('evidence'), async (req, res) => {
  try {
    const { title, description, location, latitude, longitude } = req.body;

    if (!title || !description || !location) {
      return res.status(400).json({ msg: '❌ Title, description and location are required.' });
    }

    // Find nearest police station
    let assignedStation = null;
    let assignedOfficer = null;

    if (latitude && longitude) {
      assignedStation = await PoliceStation.findOne({
        location: {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            $maxDistance: 100000 // 100km
          }
        }
      });
    }

    // If no station found by location, assign first available
    if (!assignedStation) {
      assignedStation = await PoliceStation.findOne();
    }

    // Randomly assign an officer from that station
    if (assignedStation) {
      const officers = await Officer.find({
        station: assignedStation._id,
        role: 'officer'
      });
      if (officers.length > 0) {
        assignedOfficer = officers[Math.floor(Math.random() * officers.length)];
      }
    }

    const complaint = new Complaint({
      userId:          req.user.id,
      title,
      description,
      location,
      coordinates: {
        latitude:  parseFloat(latitude)  || null,
        longitude: parseFloat(longitude) || null
      },
      evidenceFile:    req.file ? req.file.path : null,
      assignedStation: assignedStation?._id || null,
      assignedOfficer: assignedOfficer?._id || null
    });

    await complaint.save();

    res.status(201).json({
      msg:         '✅ Complaint filed successfully!',
      complaintId: complaint._id,
      assignedTo:  assignedStation?.name || 'Will be assigned soon'
    });

  } catch (err) {
    res.status(500).json({ msg: '❌ Server error.', error: err.message });
  }
});

// ── Get My Complaints ─────────────────────────────
router.get('/my', auth, async (req, res) => {
  try {
    const complaints = await Complaint.find({ userId: req.user.id })
      .populate('assignedStation', 'name address phone')
      .populate('assignedOfficer', 'name badgeNumber')
      .sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ msg: '❌ Server error.', error: err.message });
  }
});

// ── Track Single Complaint ────────────────────────
router.get('/track/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('assignedStation', 'name address phone')
      .populate('assignedOfficer', 'name badgeNumber phone');

    if (!complaint) return res.status(404).json({ msg: '❌ Complaint not found.' });
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ msg: '❌ Server error.', error: err.message });
  }
});

// ── Update Status (Officer only) ──────────────────
router.patch('/update-status/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Submitted','FIR Filed','Criminal Identified','Criminal Caught','Case Closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: '❌ Invalid status value.' });
    }
    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json({ msg: '✅ Status updated.', complaint });
  } catch (err) {
    res.status(500).json({ msg: '❌ Server error.', error: err.message });
  }
});

module.exports = router;
