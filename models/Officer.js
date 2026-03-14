const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const Officer  = require('../models/Officer');

// POST /api/officers/login
router.post('/login', async (req, res) => {
  try {
    const { badgeId, password } = req.body;

    if (!badgeId || !password)
      return res.status(400).json({ message: 'Badge ID and password are required' });

    // Find officer by badge number
    const officer = await Officer.findOne({ badgeNumber: badgeId })
      .populate('station', 'name');

    if (!officer)
      return res.status(401).json({ message: 'Invalid Badge ID or password' });

    const isMatch = await bcrypt.compare(password, officer.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid Badge ID or password' });

    // Generate token
    const token = jwt.sign(
      { id: officer._id, role: 'officer' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      officer: {
        id:          officer._id,
        name:        officer.name,
        badgeNumber: officer.badgeNumber,
        rank:        officer.rank,
        station:     officer.station?.name || 'Unassigned',
        email:       officer.email
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
