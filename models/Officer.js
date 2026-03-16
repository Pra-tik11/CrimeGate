const mongoose = require('mongoose');

const officerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  badgeId: {           // ✅ field name used in login
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    default: '',
    trim: true
  },
  phone: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    required: true
  },
  rank: {
    type: String,
    enum: ['Constable', 'Head Constable', 'ASI', 'SI', 'Inspector'],
    default: 'Constable'
  },
  station: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',         // ✅ matches Station model name
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    default: 'officer'
  }
}, { timestamps: true });

module.exports = mongoose.model('Officer', officerSchema);