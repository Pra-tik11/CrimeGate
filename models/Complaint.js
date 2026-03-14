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
    latitude:  Number,
    longitude: Number
  },
  evidenceFile: { type: String, default: null },  // file path
  assignedStation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PoliceStation'
  },
  assignedOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Officer'
  },
  status: {
    type: String,
    enum: ['Submitted', 'FIR Filed', 'Criminal Identified', 'Criminal Caught', 'Case Closed'],
    default: 'Submitted'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', ComplaintSchema);
