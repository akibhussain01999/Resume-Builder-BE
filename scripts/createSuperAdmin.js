require('dotenv').config();
const mongoose = require('mongoose');
const AdminUser = require('../src/modules/admin/auth/adminUser.model');

const EMAIL = 'admin@example.com';
const PASSWORD = 'Admin@1234';
const NAME = 'Super Admin';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const existing = await AdminUser.findOne({ email: EMAIL });
  if (existing) {
    console.log('Admin already exists:', existing.email, '[' + existing.role + ']');
    return;
  }

  const passwordHash = await AdminUser.hashPassword(PASSWORD);
  const admin = await AdminUser.create({
    name: NAME,
    email: EMAIL,
    passwordHash,
    role: 'superadmin',
    isActive: true
  });

  console.log('Superadmin created successfully!');
  console.log('Email   :', admin.email);
  console.log('Password:', PASSWORD);
  console.log('Role    :', admin.role);
}

main()
  .catch(console.error)
  .finally(() => mongoose.disconnect());
