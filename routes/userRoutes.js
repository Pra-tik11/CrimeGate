const router         = require('express').Router();
const auth           = require('../middleware/auth');
const {
  registerUser,
  loginUser,
  getUserProfile
} = require('../controllers/userController');

// Public Routes
router.post('/register', registerUser);
router.post('/login',    loginUser);

// Protected Route (needs token)
router.get('/profile',   auth, getUserProfile);

module.exports = router;
