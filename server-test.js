// backend/server-test.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// YOUR ACTUAL LOCATION (from your logs)
const YOUR_LATITUDE = -1.101004;
const YOUR_LONGITUDE = 37.016502;

// Create test classes with different scenarios
let classes = [
  {
    _id: '1',
    className: 'TEST 1: At Your Location (Should Work)',
    course: 'Computer Science',
    instructor: 'Dr. Test',
    location: { 
      latitude: YOUR_LATITUDE,      // Exactly your location
      longitude: YOUR_LONGITUDE,
      radius: 50                    // 50 meters radius
    },
    building: 'Your Location',
    room: 'Test Room',
    description: 'This class is set to your exact GPS coordinates. You should be able to mark attendance!'
  },
  {
    _id: '2',
    className: 'TEST 2: 100m Away (Should Work if within 100m)',
    course: 'Mathematics',
    instructor: 'Dr. Distance',
    location: { 
      latitude: YOUR_LATITUDE + 0.0009,  // About 100 meters north
      longitude: YOUR_LONGITUDE,
      radius: 100                         // 100 meters radius
    },
    building: '100m North',
    room: 'Test Room',
    description: 'This class is about 100 meters north of you. You should be able to mark attendance if you are within 100m.'
  },
  {
    _id: '3',
    className: 'TEST 3: 500m Away (Should Fail)',
    course: 'Physics',
    instructor: 'Dr. Far',
    location: { 
      latitude: YOUR_LATITUDE + 0.0045,  // About 500 meters north
      longitude: YOUR_LONGITUDE,
      radius: 50                         // Only 50 meters radius
    },
    building: '500m North',
    room: 'Test Room',
    description: 'This class is about 500 meters away with only 50m radius. You should NOT be able to mark attendance.'
  },
  {
    _id: '4',
    className: 'TEST 4: 1km Away (Should Fail)',
    course: 'Chemistry',
    instructor: 'Dr. Very Far',
    location: { 
      latitude: YOUR_LATITUDE + 0.009,   // About 1 km north
      longitude: YOUR_LONGITUDE,
      radius: 50
    },
    building: '1km North',
    room: 'Test Room',
    description: 'This class is 1km away. You should NOT be able to mark attendance.'
  },
  {
    _id: '5',
    className: 'TEST 5: Custom Coordinates',
    course: 'Custom',
    instructor: 'Dr. Custom',
    location: { 
      latitude: -1.2921,    // Example: Nairobi city center
      longitude: 36.8219,
      radius: 50
    },
    building: 'Nairobi CBD',
    room: 'Test Room',
    description: 'This class is set to Nairobi CBD. If you are in Nairobi, you might be within range.'
  }
];

// In-memory database
let users = [];
let attendance = [];

// Create test users
users.push({
  _id: '1',
  studentId: 'scm-211-0738/2022',
  name: 'Lovender Kweyu',
  email: 'lovender.kweyu@scm.edu',
  password: bcrypt.hashSync('password123', 10),
  course: 'Computer Science'
});

// Helper function to calculate distance (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2 - lat1) * Math.PI/180;
  const Δλ = (lon2 - lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const user = jwt.verify(token, 'attendance-secret-key');
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Attendance System Test Server',
    status: 'online',
    yourLocation: {
      latitude: YOUR_LATITUDE,
      longitude: YOUR_LONGITUDE
    },
    testCases: classes.map(c => ({
      id: c._id,
      name: c.className,
      location: c.location,
      description: c.description
    }))
  });
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { studentId, password } = req.body;
    
    const user = users.find(u => u.studentId === studentId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user._id, studentId: user.studentId, name: user.name, email: user.email },
      'attendance-secret-key',
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        studentId: user.studentId,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { studentId, name, email, password, course } = req.body;
    
    const existingUser = users.find(u => u.studentId === studentId || u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const newUser = {
      _id: (users.length + 1).toString(),
      studentId,
      name,
      email,
      password: bcrypt.hashSync(password, 10),
      course: course || 'Computer Science'
    };
    
    users.push(newUser);
    
    res.json({
      message: 'User created successfully!',
      user: {
        id: newUser._id,
        studentId: newUser.studentId,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get classes
app.get('/api/classes/my-classes', authenticateToken, (req, res) => {
  res.json(classes);
});

// Mark attendance with detailed distance calculation
app.post('/api/attendance/mark', authenticateToken, (req, res) => {
  try {
    const { classId, location } = req.body;
    const studentId = req.user.userId;
    
    console.log('\n========================================');
    console.log('📱 Attendance Marking Attempt');
    console.log('========================================');
    console.log(`Student: ${req.user.studentId}`);
    console.log(`Your Location: ${location.latitude}, ${location.longitude}`);
    
    const classInfo = classes.find(c => c._id === classId);
    if (!classInfo) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    console.log(`Class: ${classInfo.className}`);
    console.log(`Class Location: ${classInfo.location.latitude}, ${classInfo.location.longitude}`);
    console.log(`Allowed Radius: ${classInfo.location.radius} meters`);
    
    // Calculate distance
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      classInfo.location.latitude,
      classInfo.location.longitude
    );
    
    console.log(`📏 Calculated Distance: ${Math.round(distance)} meters`);
    
    // Check if within radius
    if (distance > classInfo.location.radius) {
      console.log(`❌ FAILED: ${Math.round(distance)}m > ${classInfo.location.radius}m`);
      return res.status(403).json({
        error: 'You must be within the classroom to mark attendance',
        distance: Math.round(distance),
        requiredRadius: classInfo.location.radius,
        message: `You are ${Math.round(distance)} meters away. You need to be within ${classInfo.location.radius} meters.`,
        classLocation: classInfo.location,
        yourLocation: location,
        isWithinRange: false
      });
    }
    
    console.log(`✅ SUCCESS: Within range!`);
    
    // Check if already marked today
    const today = new Date().toDateString();
    const alreadyMarked = attendance.find(a =>
      a.studentId === studentId &&
      a.classId === classId &&
      new Date(a.timestamp).toDateString() === today
    );
    
    if (alreadyMarked) {
      console.log(`⚠️ Already marked attendance today`);
      return res.status(400).json({ error: 'Attendance already marked for today' });
    }
    
    // Mark attendance
    const attendanceRecord = {
      _id: (attendance.length + 1).toString(),
      studentId,
      classId,
      timestamp: new Date(),
      location,
      distanceFromClass: Math.round(distance),
      status: distance < 10 ? 'present' : 'late'
    };
    
    attendance.push(attendanceRecord);
    
    console.log(`✅ Attendance marked successfully!`);
    console.log('========================================\n');
    
    res.json({
      message: 'Attendance marked successfully!',
      attendance: {
        id: attendanceRecord._id,
        timestamp: attendanceRecord.timestamp,
        distance: Math.round(distance),
        status: attendanceRecord.status,
        isWithinRange: true
      }
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get report
app.get('/api/reports/attendance', authenticateToken, (req, res) => {
  try {
    const studentId = req.user.userId;
    
    const userAttendance = attendance.filter(a => a.studentId === studentId);
    const enrichedAttendance = userAttendance.map(a => ({
      ...a,
      classId: classes.find(c => c._id === a.classId)
    }));
    
    const summary = {
      totalClasses: userAttendance.length,
      present: userAttendance.filter(a => a.status === 'present').length,
      late: userAttendance.filter(a => a.status === 'late').length,
      attendanceRate: userAttendance.length > 0 
        ? ((userAttendance.filter(a => a.status === 'present').length / userAttendance.length) * 100).toFixed(2)
        : 0
    };
    
    res.json({
      attendances: enrichedAttendance,
      summary,
      generatedAt: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get your current location info
app.get('/api/location/info', authenticateToken, (req, res) => {
  res.json({
    yourLocation: {
      latitude: YOUR_LATITUDE,
      longitude: YOUR_LONGITUDE
    },
    message: "This is the location we're using for testing. Your actual GPS location will be used in the app."
  });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     🧪 ATTENDANCE SYSTEM TEST SERVER - READY 🧪           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n📡 Server: http://localhost:${PORT}`);
  console.log(`📍 Your Test Location: ${YOUR_LATITUDE}, ${YOUR_LONGITUDE}`);
  
  console.log('\n📋 TEST CASES:');
  classes.forEach(c => {
    console.log(`\n${c._id}. ${c.className}`);
    console.log(`   Location: ${c.location.latitude}, ${c.location.longitude}`);
    console.log(`   Radius: ${c.location.radius}m`);
    console.log(`   Expected: ${c.location.latitude === YOUR_LATITUDE && c.location.longitude === YOUR_LONGITUDE ? '✅ SHOULD WORK' : '❌ SHOULD FAIL'}`);
    console.log(`   ${c.description}`);
  });
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📱 TEST CREDENTIALS:');
  console.log('   Student ID: scm-211-0738/2022');
  console.log('   Password: password123');
  console.log('\n🧪 HOW TO TEST:');
  console.log('   1. Login with the credentials above');
  console.log('   2. Try marking attendance for TEST 1 (should work)');
  console.log('   3. Try marking attendance for TEST 3 (should fail)');
  console.log('   4. Check the console for detailed distance calculations');
  console.log('\n📊 To see your actual GPS location in the app:');
  console.log('   The app will show "Your location" at the bottom');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});