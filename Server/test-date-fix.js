const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

// Test data
const visitorData = {
  visitorName: 'Date Test Visitor',
  visitorEmail: 'datetest@example.com',
  residentName: 'Date Test Resident',
  residentEmail: 'dateresident@example.com',
  visitReason: 'Testing Date Fix',
  carNumber: 'DATE-123'
};

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

// Test date handling
const testDateHandling = async () => {
  try {
    console.log('\n🔍 STARTING DATE HANDLING TEST\n');
    
    let visitorId;
    let verificationCode;
    
    // 1. Create a new visitor
    try {
      console.log('1. Creating a new visitor...');
      const response = await axios.post(`${API_URL}/visitor-request`, visitorData);
      visitorId = response.data.id;
      verificationCode = response.data.verificationCode;
      logTest('Create Visitor', true, response.data);
    } catch (error) {
      logTest('Create Visitor', false, null, error);
      return;
    }
    
    // 2. Update visitor status to approved
    try {
      console.log('\n2. Approving visitor...');
      const response = await axios.put(`${API_URL}/visitor-status/${visitorId}`, { status: 'approved' });
      logTest('Approve Visitor', true, response.data);
    } catch (error) {
      logTest('Approve Visitor', false, null, error);
      return;
    }
    
    // 3. Check in visitor (guard verification)
    try {
      console.log('\n3. Checking in visitor...');
      const response = await axios.post(`${API_URL}/guard-verify`, { 
        visitorId, 
        code: verificationCode 
      });
      
      // Check if inDate and inTime are set correctly
      const inDate = response.data.inDate;
      const inTime = response.data.inTime;
      
      console.log('Check-in Date:', inDate);
      console.log('Check-in Time:', inTime);
      
      // Verify the date is today
      const today = new Date().toISOString().split('T')[0];
      const dateMatches = inDate && inDate.includes(today);
      
      logTest('Check In Visitor', dateMatches, response.data);
      
      if (!dateMatches) {
        console.log('❌ Date mismatch!');
        console.log(`Expected date to include: ${today}`);
        console.log(`Actual date: ${inDate}`);
      }
    } catch (error) {
      logTest('Check In Visitor', false, null, error);
      return;
    }
    
    // 4. Check out visitor
    try {
      console.log('\n4. Checking out visitor...');
      const response = await axios.put(`${API_URL}/visitor-exit/${visitorId}`);
      
      // Check if outDate and outTime are set correctly
      const outDate = response.data.outDate;
      const outTime = response.data.outTime;
      
      console.log('Check-out Date:', outDate);
      console.log('Check-out Time:', outTime);
      
      // Verify the date is today
      const today = new Date().toISOString().split('T')[0];
      const dateMatches = outDate && outDate.includes(today);
      
      logTest('Check Out Visitor', dateMatches, response.data);
      
      if (!dateMatches) {
        console.log('❌ Date mismatch!');
        console.log(`Expected date to include: ${today}`);
        console.log(`Actual date: ${outDate}`);
      }
    } catch (error) {
      logTest('Check Out Visitor', false, null, error);
    }
    
    console.log('\n🏁 DATE HANDLING TEST COMPLETED\n');
    
  } catch (error) {
    console.error('Test suite error:', error);
  }
};

// Run the test
testDateHandling();
