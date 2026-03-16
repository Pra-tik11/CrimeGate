const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title:       { type: String, required: true },
  description: { type: String, required: true },
  location:    { type: String, required: true },
  coordinates: {
    latitude:  { type: Number, default: null },
    longitude: { type: Number, default: null }
  },
  evidenceFile: { type: String, default: null },
  assignedStation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station'       // ✅ FIXED: was 'PoliceStation'
  },
  assignedOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Officer'       // ✅ correct
  },
  status: {
    type: String,
    enum: ['Submitted', 'FIR Filed', 'Criminal Identified', 'Criminal Caught', 'Case Closed'],
    default: 'Submitted'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', ComplaintSchema);
