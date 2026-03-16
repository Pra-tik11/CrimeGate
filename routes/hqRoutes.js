const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const Admin      = require('../models/Admin');
const Complaint  = require('../models/Complaint');
const verifyToken = require('../middleware/auth');

// POST /api/hq/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, name: admin.name, role: admin.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/hq/complaints (recent)
router.get('/complaints', verifyToken, async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name')
      .populate('assignedStation', 'name')
      .populate('assignedOfficer', 'name');
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/hq/stats
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const total    = await Complaint.countDocuments();
    const pending  = await Complaint.countDocuments({ status: 'Pending' });
    const resolved = await Complaint.countDocuments({ status: 'Resolved' });
    res.json({ total, pending, resolved });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
