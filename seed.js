// seedAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const Admin    = require('./models/Admin');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const existing = await Admin.findOne({ email: 'admin@crimegate.com' });
  if (existing) {
    console.log('⚠️  Admin already exists — skipping');
    process.exit(0);
  }

  const hashed = await bcrypt.hash('Admin@1234', 12);
  await Admin.create({
    name:     'CrimeGate Admin',
    email:    'admin@crimegate.com',
    password: hashed,
    role:     'admin'
  });

  console.log('✅ Admin created!');
  console.log('   Email:    admin@crimegate.com');
  console.log('   Password: Admin@1234');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
