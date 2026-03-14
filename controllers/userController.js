const User     = require('../models/User');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

// ──────────────────────────────────────────
// REGISTER
// ──────────────────────────────────────────
exports.registerUser = async (req, res) => {
  try {
    const { name, aadhar, email, password, phone, address } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { aadhar }] });
    if (existingUser) {
      return res.status(400).json({ msg: '❌ Email or Aadhar already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    const user = new User({ name, aadhar, email, password: hashedPassword, phone, address });
    await user.save();

    res.status(201).json({ msg: '✅ Registration successful! Please login.' });

  } catch (err) {
    res.status(500).json({ msg: '❌ Server error.', error: err.message });
  }
};

// ──────────────────────────────────────────
// LOGIN
// ──────────────────────────────────────────
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: '❌ User not found.' });

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: '❌ Incorrect password.' });

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      msg: '✅ Login successful!',
      token,
      user: {
        id:      user._id,
        name:    user.name,
        email:   user.email,
        phone:   user.phone,
        address: user.address
      }
    });

  } catch (err) {
    res.status(500).json({ msg: '❌ Server error.', error: err.message });
  }
};

// ──────────────────────────────────────────
// GET USER PROFILE (Protected Route)
// ──────────────────────────────────────────
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: '❌ User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: '❌ Server error.', error: err.message });
  }
};
