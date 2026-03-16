// seedAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const Admin    = require('./models/Admin');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const email = 'pratiklolge17gmail.com';   // NEW EMAIL
  const plainPassword = 'Pratik@123';       // NEW PASSWORD

  // If admin with old email exists, update it; otherwise create new
  const hashed = await bcrypt.hash(plainPassword, 12);
  const admin = await Admin.findOneAndUpdate(
    { email },   // match by new email
    {
      name: 'CrimeGate Admin',
      email,
      password: hashed,
      role: 'admin'
    },
    { upsert: true, new: true }
  );

  console.log('✅ Admin created/updated!');
  console.log('   Email:    ' + admin.email);
  console.log('   Password: ' + plainPassword);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
