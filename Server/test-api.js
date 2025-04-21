const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

// Test data
const visitorData = {
  visitorName: 'Test Visitor',
  visitorEmail: 'testvisitor@example.com',
  residentName: 'Test Resident',
  residentEmail: 'testresident@example.com',
  visitReason: 'API Testing',
  carNumber: 'TEST123'
};

// Store IDs for later tests
let visitorId;
let verificationCode;

// Helper function to log test results
const logTest = (testName, success, data = null, error = null) => {
  console.log(`\n----- ${testName} -----`);
  if (success) {
    console.log('✅ SUCCESS');
    if (data) console.log('Data:', JSON.stringify(data, null, 2));
  } else {
    console.log('❌ FAILED');
    if (error) console.log('Error:', error.message || error);
  }
};

// Test all API endpoints
const runTests = async () => {
  try {
    console.log('\n🔍 STARTING API TESTS\n');
    
    // 1. Test visitor request submission
    try {
      console.log('1. Testing visitor request submission...');
      const response = await axios.post(`${API_URL}/visitor-request`, visitorData);
      visitorId = response.data.id;
      verificationCode = response.data.verificationCode;
      logTest('Visitor Request Submission', true, response.data);
    } catch (error) {
      logTest('Visitor Request Submission', false, null, error);
    }
    
    // 2. Test get all visitors
    try {
      console.log('\n2. Testing get all visitors...');
      const response = await axios.get(`${API_URL}/visitors`);
      const found = response.data.some(visitor => visitor.id === visitorId);
      logTest('Get All Visitors', true, { 
        totalVisitors: response.data.length,
        containsNewVisitor: found
      });
    } catch (error) {
      logTest('Get All Visitors', false, null, error);
    }
    
    // 3. Test update visitor status (approve)
    try {
      console.log('\n3. Testing update visitor status (approve)...');
      const response = await axios.put(`${API_URL}/visitor-status/${visitorId}`, { status: 'approved' });
      logTest('Update Visitor Status (Approve)', true, response.data);
    } catch (error) {
      logTest('Update Visitor Status (Approve)', false, null, error);
    }
    
    // 4. Test guard verification
    try {
      console.log('\n4. Testing guard verification...');
      const response = await axios.post(`${API_URL}/guard-verify`, { 
        visitorId, 
        code: verificationCode 
      });
      logTest('Guard Verification', true, response.data);
    } catch (error) {
      logTest('Guard Verification', false, null, error);
    }
    
    // 5. Test mark visitor exit
    try {
      console.log('\n5. Testing mark visitor exit...');
      const response = await axios.put(`${API_URL}/visitor-exit/${visitorId}`);
      logTest('Mark Visitor Exit', true, response.data);
    } catch (error) {
      logTest('Mark Visitor Exit', false, null, error);
    }
    
    // 6. Test invalid verification code
    try {
      console.log('\n6. Testing invalid verification code...');
      await axios.post(`${API_URL}/guard-verify`, { 
        visitorId, 
        code: '0000' // Invalid code
      });
      logTest('Invalid Verification Code', false, null, 'Expected to fail but succeeded');
    } catch (error) {
      // This test is expected to fail
      const isCorrectError = error.response && error.response.status === 400;
      logTest('Invalid Verification Code', isCorrectError, null, 
        isCorrectError ? 'Correctly rejected invalid code' : error);
    }
    
    console.log('\n🏁 API TESTS COMPLETED\n');
    
  } catch (error) {
    console.error('Test suite error:', error);
  }
};

// Run the tests
runTests();
