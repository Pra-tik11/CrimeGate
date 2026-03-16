const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, unique: true },
  address:  { type: String, required: true, trim: true },
  city:     { type: String, required: true, trim: true },
  phone:    { type: String, default: '' },
  email:    { type: String, default: '' },
  inCharge: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Station', stationSchema);
