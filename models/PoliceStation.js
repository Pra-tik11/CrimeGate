const mongoose = require('mongoose');

const PoliceStationSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  address:      { type: String, required: true },
  phone:        { type: String, required: true },
  jurisdiction: { type: String, required: true },
  location: {
    type:        { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  createdAt: { type: Date, default: Date.now }
});

// This index is REQUIRED for nearest station search
PoliceStationSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('PoliceStation', PoliceStationSchema);
