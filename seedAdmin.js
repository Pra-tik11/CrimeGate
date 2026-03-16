require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const Admin    = require('./models/Admin');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const email         = process.env.ADMIN_EMAIL    || 'pratiklolge17@gmail.com';
    const plainPassword = process.env.ADMIN_PASSWORD || 'Pratik@123';

    const hashed = await bcrypt.hash(plainPassword, 12);

    await Admin.findOneAndUpdate(
      { email },
      { name: 'CrimeGate Admin', email, password: hashed, role: 'admin' },
      { upsert: true, new: true }
    );

    console.log('✅ Admin created/updated successfully!');
    console.log('   Email:    ' + email);
    console.log('   Password: ' + plainPassword);
    process.exit(0);
  } catch(err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seed();
