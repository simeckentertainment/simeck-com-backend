const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing Simeck Blog API...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.message);

    // Test root endpoint
    console.log('\n2. Testing root endpoint...');
    const rootResponse = await axios.get(`${BASE_URL}/`);
    console.log('✅ Root endpoint:', rootResponse.data.message);

    // Test user registration
    console.log('\n3. Testing user registration...');
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPass123',
      firstName: 'Test',
      lastName: 'User'
    };

    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, userData);
    console.log('✅ User registered:', registerResponse.data.message);
    const token = registerResponse.data.data.token;

    // Test user login
    console.log('\n4. Testing user login...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'TestPass123'
    });
    console.log('✅ User logged in:', loginResponse.data.message);

    // Test get user profile
    console.log('\n5. Testing get user profile...');
    const profileResponse = await axios.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Profile retrieved:', profileResponse.data.data.username);

    // Test create blog
    console.log('\n6. Testing create blog...');
    const blogData = {
      title: 'Test Blog Post',
      description: 'This is a test blog post description',
      content: 'This is the full content of the test blog post. It contains enough text to meet the minimum requirements for a blog post.',
      category: 'Technology',
      tags: ['test', 'blog', 'api'],
      isPublished: true
    };

    const blogResponse = await axios.post(`${BASE_URL}/api/blogs`, blogData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Blog created:', blogResponse.data.message);
    const blogId = blogResponse.data.data._id;

    // Test get all blogs
    console.log('\n7. Testing get all blogs...');
    const blogsResponse = await axios.get(`${BASE_URL}/api/blogs`);
    console.log('✅ Blogs retrieved:', blogsResponse.data.data.blogs.length, 'blogs found');

    // Test get single blog
    console.log('\n8. Testing get single blog...');
    const singleBlogResponse = await axios.get(`${BASE_URL}/api/blogs/${blogId}`);
    console.log('✅ Single blog retrieved:', singleBlogResponse.data.data.title);

    // Test like blog
    console.log('\n9. Testing like blog...');
    const likeResponse = await axios.post(`${BASE_URL}/api/blogs/${blogId}/like`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Blog liked:', likeResponse.data.message);

    // Test add comment
    console.log('\n10. Testing add comment...');
    const commentResponse = await axios.post(`${BASE_URL}/api/blogs/${blogId}/comments`, {
      content: 'This is a test comment on the blog post.'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Comment added:', commentResponse.data.message);

    console.log('\n🎉 All API tests passed successfully!');
    console.log('\n📚 API Documentation available at: http://localhost:3000/api-docs');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testAPI();
