// backend/server-final.js - WITH MONGODB ATLAS (Permanent Storage)
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// ============================================
// MONGODB ATLAS CONNECTION
// ============================================
// REPLACE THIS WITH YOUR ACTUAL CONNECTION STRING FROM MONGODB ATLAS
const MONGODB_URI = 'mongodb+srv://attendance_admin:425254@attendancecluster.axmgyjz.mongodb.net/?appName=AttendanceCluster';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Atlas connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('💡 Make sure you have:');
    console.log('   1. Created a MongoDB Atlas account');
    console.log('   2. Created a cluster (M0 free tier)');
    console.log('   3. Added 0.0.0.0/0 to Network Access');
    console.log('   4. Created a database user');
    console.log('   5. Updated the connection string above');
    process.exit(1);
  });

// ============================================
// MONGODB SCHEMAS
// ============================================

// Student Schema
const studentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  course: { type: String, default: 'Computer Science' },
  registrationDate: { type: Date, default: Date.now }
});

// Lecturer Schema
const lecturerSchema = new mongoose.Schema({
  lecturerId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  units: [{ type: String }]
});

// Unit Schema
const unitSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  className: { type: String, required: true },
  course: { type: String, required: true },
  instructor: { type: String, required: true },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    radius: { type: Number, default: 100 }
  },
  building: String,
  room: String,
  schedule: {
    days: [String],
    time: String
  }
});

// Attendance Schema
const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  classId: { type: String, required: true },
  unitName: String,
  instructor: String,
  timestamp: { type: Date, default: Date.now },
  location: {
    latitude: Number,
    longitude: Number
  },
  distanceFromClass: Number,
  status: { type: String, enum: ['present', 'late'], default: 'present' }
});

// Create Models
const Student = mongoose.model('Student', studentSchema);
const Lecturer = mongoose.model('Lecturer', lecturerSchema);
const Unit = mongoose.model('Unit', unitSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);

// ============================================
// YOUR UNITS DATA
// ============================================
const UNITS_DATA = [
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
      latitude: -1.098603,
      longitude: 37.013061,
      radius: 1000
    },
    building: 'Science Complex',
    room: 'PAM LAB B',
    schedule: {
      days: ['Tuesday'],
      time: '8:00 AM - 11:00 AM'
    }
  }
];

// ============================================
// INITIALIZE DATABASE WITH SAMPLE DATA
// ============================================
async function initializeDatabase() {
  try {
    // Check and create units
    const unitCount = await Unit.countDocuments();
    if (unitCount === 0) {
      console.log('📚 Creating units...');
      await Unit.insertMany(UNITS_DATA);
      console.log('✅ Units created successfully');
    }

    // Check and create lecturers
    const lecturerCount = await Lecturer.countDocuments();
    if (lecturerCount === 0) {
      console.log('👨‍🏫 Creating lecturer accounts...');
      await Lecturer.insertMany([
        {
          lecturerId: 'LEC001',
          name: 'Mr. Oyugi',
          email: 'oyugi@jkuat.ac.ke',
          password: bcrypt.hashSync('lecturer123', 10),
          units: ['Mobile Computing', 'Cloud Computing']
        },
        {
          lecturerId: 'LEC002',
          name: 'Mr. Mwai',
          email: 'mwai@jkuat.ac.ke',
          password: bcrypt.hashSync('lecturer123', 10),
          units: ['Simulation and Modelling']
        }
      ]);
      console.log('✅ Lecturer accounts created');
    }

    console.log('✅ Database ready!');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function isValidStudentId(studentId) {
  const pattern = /^[a-z]+-\d+-\d+\/\d+$/i;
  return pattern.test(studentId);
}

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
  res.json({
    message: 'Attendance System Server - JKUAT University',
    status: 'online',
    units: UNITS_DATA.map(u => ({ name: u.className, instructor: u.instructor })),
    database: 'MongoDB Atlas - Permanent Storage'
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
    
    const existingUser = await Student.findOne({ $or: [{ studentId }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Student ID or email already exists' });
    }
    
    const newUser = new Student({
      studentId,
      name,
      email,
      password: bcrypt.hashSync(password, 10)
    });
    
    await newUser.save();
    
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
app.post('/api/auth/login', async (req, res) => {
  try {
    const { studentId, password } = req.body;
    
    console.log('🔐 Student Login attempt:', studentId);
    
    const user = await Student.findOne({ studentId });
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
app.get('/api/classes/my-classes', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Access denied. Student only.' });
  }
  console.log('📚 Sending units to student:', req.user.studentId);
  const units = await Unit.find();
  res.json(units);
});

// Mark attendance for student
app.post('/api/attendance/mark', authenticateToken, async (req, res) => {
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
    
    const unit = await Unit.findById(classId);
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
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const alreadyMarked = await Attendance.findOne({
      studentId,
      classId,
      timestamp: { $gte: today }
    });
    
    if (alreadyMarked) {
      console.log(`⚠️ Already marked today`);
      return res.status(400).json({ 
        error: `You have already marked attendance for ${unit.className} today`
      });
    }
    
    const attendanceRecord = new Attendance({
      studentId,
      classId,
      unitName: unit.className,
      instructor: unit.instructor,
      location,
      distanceFromClass: Math.round(distance),
      status: 'present'
    });
    
    await attendanceRecord.save();
    
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
app.get('/api/reports/attendance', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Access denied. Student only.' });
    }
    
    const studentId = req.user.userId;
    
    const userAttendance = await Attendance.find({ studentId }).sort({ timestamp: -1 });
    const enrichedAttendance = userAttendance.map(a => ({
      ...a.toObject(),
      classId: { className: a.unitName, instructor: a.instructor }
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
// LECTURER ROUTES
// ============================================

// Lecturer Login
app.post('/api/lecturer/login', async (req, res) => {
  try {
    const { lecturerId, password } = req.body;
    
    console.log('📚 Lecturer login attempt:', lecturerId);
    
    const lecturer = await Lecturer.findOne({ lecturerId });
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
app.get('/api/lecturer/dashboard', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'lecturer') {
      return res.status(403).json({ error: 'Access denied. Lecturer only.' });
    }
    
    const lecturerUnits = req.user.units || [];
    const dashboardData = {};
    
    for (const unitName of lecturerUnits) {
      const unit = await Unit.findOne({ className: unitName });
      if (unit) {
        const unitAttendance = await Attendance.find({ classId: unit._id });
        const uniqueStudents = [...new Set(unitAttendance.map(a => a.studentId.toString()))];
        
        dashboardData[unitName] = {
          totalAttendance: unitAttendance.length,
          uniqueStudents: uniqueStudents.length,
          presentCount: unitAttendance.filter(a => a.status === 'present').length,
          lateCount: unitAttendance.filter(a => a.status === 'late').length
        };
      }
    }
    
    const allAttendance = await Attendance.find({
      unitName: { $in: lecturerUnits }
    });
    
    res.json({
      lecturer: req.user.name,
      totalUnits: lecturerUnits.length,
      totalAttendanceRecords: allAttendance.length,
      unitStats: dashboardData,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Error getting lecturer dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get attendance for a specific unit (for lecturer)
app.get('/api/lecturer/unit/:unitName', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'lecturer') {
      return res.status(403).json({ error: 'Access denied. Lecturer only.' });
    }
    
    const unitName = decodeURIComponent(req.params.unitName);
    const lecturerUnits = req.user.units || [];
    
    if (!lecturerUnits.includes(unitName)) {
      return res.status(403).json({ error: 'You are not assigned to this unit.' });
    }
    
    const unit = await Unit.findOne({ className: unitName });
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    const unitAttendance = await Attendance.find({ classId: unit._id }).sort({ timestamp: -1 });
    
    const studentRecords = await Promise.all(unitAttendance.map(async (a) => {
      const student = await Student.findById(a.studentId);
      return {
        studentName: student?.name || 'Unknown',
        studentId: student?.studentId || 'Unknown',
        timestamp: a.timestamp,
        status: a.status,
        distance: a.distanceFromClass,
        location: a.location
      };
    }));
    
    res.json({
      unitName: unitName,
      instructor: unit.instructor,
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

// Get all registered students (lecturer view)
app.get('/api/admin/students', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'lecturer') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    
    const students = await Student.find({}, { password: 0 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║     🎓 JKUAT UNIVERSITY ATTENDANCE SYSTEM - READY 🎓         ║');
    console.log('║              📀 MongoDB Atlas - Permanent Storage            ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('\n📚 UNITS & LECTURERS:');
    UNITS_DATA.forEach(unit => {
      console.log(`   📖 ${unit.className} - ${unit.instructor}`);
    });
    console.log(`\n📱 ON YOUR PHONE:`);
    console.log(`   Update App.js API_URL to your cloud URL`);
    console.log(`   Example: https://attendance-backend.onrender.com`);
    console.log('\n📝 STUDENT ID FORMAT:');
    console.log('   scm-xxx-xxxx/yyyy (e.g., scm-211-0738/2022)');
    console.log('\n👥 STUDENT TEST ACCOUNTS (Register first):');
    console.log('   Student ID: scm-211-0738/2022');
    console.log('   Password: password123');
    console.log('\n📚 LECTURER ACCOUNTS:');
    console.log('   👨‍🏫 Mr. Oyugi (LEC001) - Password: lecturer123');
    console.log('   👨‍🏫 Mr. Mwai (LEC002) - Password: lecturer123');
    console.log('\n💾 DATABASE: MongoDB Atlas (Permanent Storage)');
    console.log('\n✅ Server is ready! Waiting for connections...\n');
  });
});