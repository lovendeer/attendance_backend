// backend/server-final.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const os = require('os');

const app = express();
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Get ALL local IP addresses
function getAllIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, ip: iface.address });
      }
    }
  }
  return ips;
}

// ============================================
// YOUR UNITS WITH LECTURERS
// ============================================
const UNITS = [
  {
    _id: '1',
    className: 'Mobile Computing',
    course: 'Mathematics and Computer Science',
    instructor: 'Mr. Oyugi',
    location: { 
      latitude: -1.1009621,
      longitude: 37.0167747, 
      radius: 100
    },
    building: 'Science Complex',
    room: 'PAM LAB B',
    schedule: {
      days: ['Monday'],
      time: '8:00 AM - 11:00 AM'
    }
  },
  {
    _id: '2',
    className: 'Cloud Computing',
    course: 'Mathematics and Computer Science',
    instructor: 'Mr. Oyugi',
    location: { 
      latitude: -1.101684,
      longitude: 37.015038,
      radius: 100
    },
    building: 'Science Complex',
    room: 'PAM LAB B',
    schedule: {
      days: ['Tuesday'],
      time: '11:00 AM - 2:00 PM'
    }
  },
  {
    _id: '3',
    className: 'Simulation and Modelling',
    course: 'Mathematics and Computer Science',
    instructor: 'Mr. Mwai',
    location: { 
      latitude: -1.101684,
      longitude: 37.015038,
      radius: 100
    },
    building: 'Science Complex',
    room: 'PAM LAB B',
    schedule: {
      days: ['Tuesday'],
      time: '8:00 AM - 11:00 AM'
    }
  }
];

// In-memory database
let users = [];
let attendance = [];

// ============================================
// LECTURER PORTAL - NEW FEATURE
// ============================================

// Lecturer accounts
let lecturers = [
  {
    _id: 'lec1',
    lecturerId: 'LEC001',
    name: 'Mr. Oyugi',
    email: 'oyugi@jkuat.ac.ke',
    password: bcrypt.hashSync('lecturer123', 10),
    units: ['Mobile Computing', 'Cloud Computing']
  },
  {
    _id: 'lec2',
    lecturerId: 'LEC002',
    name: 'Mr. Mwai',
    email: 'mwai@jkuat.ac.ke',
    password: bcrypt.hashSync('lecturer123', 10),
    units: ['Simulation and Modelling']
  }
];

// Student ID validation function
function isValidStudentId(studentId) {
  const pattern = /^[a-z]+-\d+-\d+\/\d+$/i;
  return pattern.test(studentId);
}

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
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

// ============================================
// API ROUTES
// ============================================

// Root endpoint
app.get('/', (req, res) => {
  const allIPs = getAllIPs();
  res.json({
    message: 'Attendance System Server - JKUAT University',
    status: 'online',
    units: UNITS.map(u => ({ name: u.className, instructor: u.instructor })),
    availableIPs: allIPs,
    useThisForPhone: allIPs.length > 0 ? `http://${allIPs[0].ip}:3000` : 'Check network connection'
  });
});

// ============================================
// STUDENT ROUTES
// ============================================

// Student Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { studentId, name, email, password } = req.body;
    
    console.log('📝 Student Registration attempt:', { studentId, name, email });
    
    if (!isValidStudentId(studentId)) {
      return res.status(400).json({ 
        error: 'Invalid Student ID format. Use format: scm-xxx-xxxx/yyyy (e.g., scm-211-0738/2022)' 
      });
    }
    
    const existingUser = users.find(u => u.studentId === studentId || u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'Student ID or email already exists' });
    }
    
    const newUser = {
      _id: (users.length + 1).toString(),
      studentId,
      name,
      email,
      password: bcrypt.hashSync(password, 10),
      course: 'Computer Science',
      registrationDate: new Date()
    };
    
    users.push(newUser);
    
    console.log('✅ Student created successfully:', studentId);
    
    res.json({
      message: 'Account created successfully! You can now login.',
      user: {
        id: newUser._id,
        studentId: newUser.studentId,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Student Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { studentId, password } = req.body;
    
    console.log('🔐 Student Login attempt:', studentId);
    
    const user = users.find(u => u.studentId === studentId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { 
        userId: user._id, 
        studentId: user.studentId, 
        name: user.name, 
        email: user.email,
        role: 'student'
      },
      'attendance-secret-key',
      { expiresIn: '24h' }
    );
    
    console.log('✅ Student login successful:', studentId);
    
    res.json({
      token,
      user: {
        id: user._id,
        studentId: user.studentId,
        name: user.name,
        email: user.email,
        role: 'student'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all units for student
app.get('/api/classes/my-classes', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Access denied. Student only.' });
  }
  console.log('📚 Sending units to student:', req.user.studentId);
  res.json(UNITS);
});

// Mark attendance for student
app.post('/api/attendance/mark', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Access denied. Student only.' });
    }
    
    const { classId, location } = req.body;
    const studentId = req.user.userId;
    
    console.log('\n========================================');
    console.log('📱 Attendance Marking Attempt');
    console.log('========================================');
    console.log(`Student: ${req.user.studentId}`);
    console.log(`Your Location: ${location.latitude}, ${location.longitude}`);
    
    const unit = UNITS.find(u => u._id === classId);
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    console.log(`Unit: ${unit.className}`);
    console.log(`Class Location: ${unit.location.latitude}, ${unit.location.longitude}`);
    console.log(`Allowed Radius: ${unit.location.radius} meters`);
    
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      unit.location.latitude,
      unit.location.longitude
    );
    
    console.log(`📏 Distance: ${Math.round(distance)} meters`);
    
    if (distance > unit.location.radius) {
      console.log(`❌ FAILED: Too far`);
      return res.status(403).json({
        error: 'You must be within the classroom to mark attendance',
        distance: Math.round(distance),
        requiredRadius: unit.location.radius,
        message: `You are ${Math.round(distance)} meters away. Need to be within ${unit.location.radius} meters.`
      });
    }
    
    console.log(`✅ SUCCESS: Within range!`);
    
    const today = new Date().toDateString();
    const alreadyMarked = attendance.find(a =>
      a.studentId === studentId &&
      a.classId === classId &&
      new Date(a.timestamp).toDateString() === today
    );
    
    if (alreadyMarked) {
      console.log(`⚠️ Already marked today`);
      return res.status(400).json({ 
        error: `You have already marked attendance for ${unit.className} today`
      });
    }
    
    const attendanceRecord = {
      _id: (attendance.length + 1).toString(),
      studentId,
      classId,
      unitName: unit.className,
      instructor: unit.instructor,
      timestamp: new Date(),
      location,
      distanceFromClass: Math.round(distance),
      status: 'present'
    };
    
    attendance.push(attendanceRecord);
    
    console.log(`✅ Attendance marked successfully!`);
    console.log('========================================\n');
    
    res.json({
      message: `Attendance marked successfully for ${unit.className}!`,
      attendance: {
        id: attendanceRecord._id,
        unit: unit.className,
        timestamp: attendanceRecord.timestamp,
        distance: Math.round(distance),
        status: 'present'
      }
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get student attendance report
app.get('/api/reports/attendance', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Access denied. Student only.' });
    }
    
    const studentId = req.user.userId;
    
    const userAttendance = attendance.filter(a => a.studentId === studentId);
    const enrichedAttendance = userAttendance.map(a => ({
      ...a,
      classId: UNITS.find(u => u._id === a.classId) || { className: a.unitName, instructor: a.instructor }
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
      generatedAt: new Date(),
      student: {
        name: req.user.name,
        studentId: req.user.studentId,
        email: req.user.email
      }
    });
  } catch (error) {
    console.error('Error getting report:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LECTURER ROUTES - NEW
// ============================================

// Lecturer Login
app.post('/api/lecturer/login', (req, res) => {
  try {
    const { lecturerId, password } = req.body;
    
    console.log('📚 Lecturer login attempt:', lecturerId);
    
    const lecturer = lecturers.find(l => l.lecturerId === lecturerId);
    if (!lecturer) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = bcrypt.compareSync(password, lecturer.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { 
        userId: lecturer._id, 
        lecturerId: lecturer.lecturerId, 
        name: lecturer.name,
        email: lecturer.email,
        role: 'lecturer',
        units: lecturer.units
      },
      'attendance-secret-key',
      { expiresIn: '24h' }
    );
    
    console.log('✅ Lecturer login successful:', lecturerId);
    
    res.json({
      token,
      user: {
        id: lecturer._id,
        lecturerId: lecturer.lecturerId,
        name: lecturer.name,
        email: lecturer.email,
        role: 'lecturer',
        units: lecturer.units
      }
    });
  } catch (error) {
    console.error('Lecturer login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get lecturer's dashboard summary
app.get('/api/lecturer/dashboard', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'lecturer') {
      return res.status(403).json({ error: 'Access denied. Lecturer only.' });
    }
    
    const lecturerUnits = req.user.units || [];
    const dashboardData = {};
    
    lecturerUnits.forEach(unitName => {
      const unitAttendance = attendance.filter(a => a.unitName === unitName);
      const uniqueStudents = [...new Set(unitAttendance.map(a => a.studentId))];
      
      dashboardData[unitName] = {
        totalAttendance: unitAttendance.length,
        uniqueStudents: uniqueStudents.length,
        presentCount: unitAttendance.filter(a => a.status === 'present').length,
        lateCount: unitAttendance.filter(a => a.status === 'late').length
      };
    });
    
    res.json({
      lecturer: req.user.name,
      totalUnits: lecturerUnits.length,
      totalAttendanceRecords: attendance.filter(a => lecturerUnits.includes(a.unitName)).length,
      unitStats: dashboardData,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Error getting lecturer dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get detailed lecturer reports for their units
app.get('/api/lecturer/reports', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'lecturer') {
      return res.status(403).json({ error: 'Access denied. Lecturer only.' });
    }
    
    const lecturerUnits = req.user.units || [];
    const unitReports = {};
    let allAttendance = [];
    
    lecturerUnits.forEach(unitName => {
      const unit = UNITS.find(u => u.className === unitName);
      const unitAttendance = attendance.filter(a => a.unitName === unitName);
      
      unitReports[unitName] = {
        unitId: unit?._id || 'N/A',
        instructor: unit?.instructor || req.user.name,
        totalStudents: unitAttendance.length,
        present: unitAttendance.filter(a => a.status === 'present').length,
        late: unitAttendance.filter(a => a.status === 'late').length,
        records: unitAttendance.map(a => {
          const student = users.find(u => u._id === a.studentId);
          return {
            studentName: student?.name || 'Unknown',
            studentId: student?.studentId || 'Unknown',
            timestamp: a.timestamp,
            status: a.status,
            distance: a.distanceFromClass,
            location: a.location
          };
        })
      };
      allAttendance = [...allAttendance, ...unitAttendance];
    });
    
    const summary = {
      totalUnits: lecturerUnits.length,
      totalAttendance: allAttendance.length,
      totalPresent: allAttendance.filter(a => a.status === 'present').length,
      totalLate: allAttendance.filter(a => a.status === 'late').length
    };
    
    res.json({
      lecturer: req.user.name,
      lecturerId: req.user.lecturerId,
      units: lecturerUnits,
      summary: summary,
      unitReports: unitReports,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Error getting lecturer reports:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get attendance for a specific unit (for lecturer)
app.get('/api/lecturer/unit/:unitName', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'lecturer') {
      return res.status(403).json({ error: 'Access denied. Lecturer only.' });
    }
    
    const unitName = decodeURIComponent(req.params.unitName);
    const lecturerUnits = req.user.units || [];
    
    if (!lecturerUnits.includes(unitName)) {
      return res.status(403).json({ error: 'You are not assigned to this unit.' });
    }
    
    const unit = UNITS.find(u => u.className === unitName);
    const unitAttendance = attendance.filter(a => a.unitName === unitName);
    
    const studentRecords = unitAttendance.map(a => {
      const student = users.find(u => u._id === a.studentId);
      return {
        studentName: student?.name || 'Unknown',
        studentId: student?.studentId || 'Unknown',
        timestamp: a.timestamp,
        status: a.status,
        distance: a.distanceFromClass,
        location: a.location
      };
    });
    
    res.json({
      unitName: unitName,
      instructor: unit?.instructor || req.user.name,
      totalRecords: studentRecords.length,
      presentCount: studentRecords.filter(r => r.status === 'present').length,
      lateCount: studentRecords.filter(r => r.status === 'late').length,
      records: studentRecords,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Error getting unit attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// UTILITY ENDPOINTS
// ============================================

// Get all registered students (admin/lecturer view)
app.get('/api/admin/students', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'lecturer') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    
    const studentList = users.map(u => ({
      studentId: u.studentId,
      name: u.name,
      email: u.email,
      registrationDate: u.registrationDate
    }));
    res.json(studentList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================

const PORT = 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  const allIPs = getAllIPs();
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     🎓 JKUAT UNIVERSITY ATTENDANCE SYSTEM - READY 🎓         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('\n📚 UNITS & LECTURERS:');
  UNITS.forEach(unit => {
    console.log(`   📖 ${unit.className} - ${unit.instructor}`);
  });
  console.log('\n🌐 AVAILABLE NETWORK ADDRESSES:');
  console.log('   Use the IP that matches your phone\'s WiFi network');
  console.log('   ─────────────────────────────────────────────');
  allIPs.forEach(({ name, ip }) => {
    console.log(`   📡 ${name}: http://${ip}:${PORT}`);
  });
  console.log('   ─────────────────────────────────────────────');
  console.log(`\n📱 ON YOUR PHONE:`);
  console.log(`   1. Connect to the SAME WiFi as your computer`);
  console.log(`   2. Open Chrome and try each URL above`);
  console.log(`   3. Use the IP that works in your App.js`);
  console.log('\n📝 STUDENT ID FORMAT:');
  console.log('   Must match pattern: scm-xxx-xxxx/yyyy');
  console.log('   Example: scm-211-0738/2022');
  console.log('\n👥 STUDENT TEST ACCOUNTS (Register first):');
  console.log('   Student ID: scm-211-0738/2022');
  console.log('   Password: password123');
  console.log('\n📚 LECTURER ACCOUNTS:');
  lecturers.forEach(lec => {
    console.log(`   👨‍🏫 ${lec.name} (${lec.lecturerId})`);
    console.log(`      Password: lecturer123`);
    console.log(`      Units: ${lec.units.join(', ')}`);
  });
  console.log('\n✅ Server is ready! Waiting for connections...\n');
});