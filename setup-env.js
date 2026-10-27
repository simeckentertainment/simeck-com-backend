const fs = require('fs');
const path = require('path');

const envContent = `NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/simeck-blog
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-${Date.now()}
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:3000`;

const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!');
  console.log('📝 Please update the JWT_SECRET and MONGODB_URI values as needed.');
} else {
  console.log('⚠️  .env file already exists. Skipping creation.');
}

console.log('\n🚀 Setup complete! You can now run:');
console.log('   npm run dev    # For development');
console.log('   npm start      # For production');
console.log('\n📚 API Documentation: http://localhost:3000/api-docs');
console.log('🔍 Health Check: http://localhost:3000/health');
