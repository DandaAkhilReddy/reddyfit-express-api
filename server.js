// ============================================
// ReddyFit Express.js API Server
// ============================================
require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================
// Database Configuration
// ============================================
const dbConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

// Initialize database connection pool
async function initializeDatabase() {
  try {
    console.log('🔄 Connecting to Azure SQL Database...');
    pool = await sql.connect(dbConfig);
    console.log('✅ Database connected successfully!');
    return pool;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    throw err;
  }
}

// Get or create database connection
async function getDbPool() {
  if (!pool || !pool.connected) {
    pool = await initializeDatabase();
  }
  return pool;
}

// ============================================
// Middleware Setup
// ============================================
app.use(helmet()); // Security headers
app.use(compression()); // Response compression
app.use(morgan('combined')); // HTTP request logging

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// JWT Authentication Middleware
// ============================================
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Bearer TOKEN

    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = user;
      next();
    });
  } else {
    // For now, allow unauthenticated access (Firebase handles auth in frontend)
    next();
  }
}

// ============================================
// Health Check Route
// ============================================
app.get('/api/health', async (req, res) => {
  try {
    const dbPool = await getDbPool();
    const result = await dbPool.request().query('SELECT 1 AS health');

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: result.recordset.length > 0 ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// User Routes
// ============================================

// GET /api/users/all - Get all users (Admin)
app.get('/api/users/all', async (req, res) => {
  try {
    console.log('📥 GET /api/users/all');
    const dbPool = await getDbPool();

    const result = await dbPool.request().query(`
      SELECT
        up.*,
        orr.fitness_goal,
        orr.current_fitness_level,
        orr.workout_frequency,
        orr.diet_preference,
        orr.motivation,
        orr.biggest_challenge,
        orr.how_found_us,
        orr.feature_interest,
        orr.willing_to_pay,
        orr.price_range
      FROM user_profiles up
      LEFT JOIN onboarding_responses orr ON up.id = orr.user_id
      ORDER BY up.created_at DESC
    `);

    console.log(`✅ Retrieved ${result.recordset.length} users`);
    res.json(result.recordset);
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// GET /api/users/profile - Get user profile by email or firebase_uid
app.get('/api/users/profile', async (req, res) => {
  try {
    const { email, firebase_uid } = req.query;
    console.log(`📥 GET /api/users/profile - email: ${email}, firebase_uid: ${firebase_uid}`);

    if (!email && !firebase_uid) {
      return res.status(400).json({ error: 'Email or firebase_uid required' });
    }

    const dbPool = await getDbPool();
    const result = await dbPool.request()
      .input('email', sql.NVarChar, email)
      .input('firebase_uid', sql.NVarChar, firebase_uid)
      .query(`
        SELECT * FROM user_profiles
        WHERE email = @email OR firebase_uid = @firebase_uid
      `);

    if (result.recordset.length === 0) {
      console.log('⚠️ User not found');
      return res.json(null);
    }

    console.log('✅ User profile retrieved');
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('❌ Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
});

// POST /api/users/profile - Create or update user profile
app.post('/api/users/profile', async (req, res) => {
  try {
    const { email, firebase_uid, full_name, gender, avatar_url } = req.body;
    console.log(`📥 POST /api/users/profile - email: ${email}`);

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const dbPool = await getDbPool();

    // Check if user exists
    const existingUser = await dbPool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM user_profiles WHERE email = @email');

    if (existingUser.recordset.length > 0) {
      // Update existing user
      console.log('🔄 Updating existing user');
      await dbPool.request()
        .input('email', sql.NVarChar, email)
        .input('firebase_uid', sql.NVarChar, firebase_uid)
        .input('full_name', sql.NVarChar, full_name)
        .input('gender', sql.NVarChar, gender)
        .input('avatar_url', sql.NVarChar, avatar_url)
        .query(`
          UPDATE user_profiles
          SET firebase_uid = @firebase_uid,
              full_name = @full_name,
              gender = @gender,
              avatar_url = @avatar_url,
              updated_at = GETUTCDATE()
          WHERE email = @email
        `);

      console.log('✅ User profile updated');
      res.json({ message: 'Profile updated', id: existingUser.recordset[0].id });
    } else {
      // Insert new user
      console.log('➕ Creating new user');
      const result = await dbPool.request()
        .input('email', sql.NVarChar, email)
        .input('firebase_uid', sql.NVarChar, firebase_uid)
        .input('full_name', sql.NVarChar, full_name)
        .input('gender', sql.NVarChar, gender)
        .input('avatar_url', sql.NVarChar, avatar_url)
        .query(`
          INSERT INTO user_profiles (email, firebase_uid, full_name, gender, avatar_url)
          OUTPUT INSERTED.id
          VALUES (@email, @firebase_uid, @full_name, @gender, @avatar_url)
        `);

      console.log('✅ User profile created');
      res.status(201).json({ message: 'Profile created', id: result.recordset[0].id });
    }
  } catch (err) {
    console.error('❌ Error upserting profile:', err);
    res.status(500).json({ error: 'Failed to save profile', details: err.message });
  }
});

// PUT /api/users/onboarding-status - Update onboarding status
app.put('/api/users/onboarding-status', async (req, res) => {
  try {
    const { email, completed } = req.body;
    console.log(`📥 PUT /api/users/onboarding-status - email: ${email}, completed: ${completed}`);

    const dbPool = await getDbPool();
    await dbPool.request()
      .input('email', sql.NVarChar, email)
      .input('completed', sql.Bit, completed ? 1 : 0)
      .query(`
        UPDATE user_profiles
        SET onboarding_completed = @completed,
            updated_at = GETUTCDATE()
        WHERE email = @email
      `);

    console.log('✅ Onboarding status updated');
    res.json({ message: 'Onboarding status updated' });
  } catch (err) {
    console.error('❌ Error updating onboarding status:', err);
    res.status(500).json({ error: 'Failed to update status', details: err.message });
  }
});

// ============================================
// Onboarding Routes
// ============================================

// POST /api/onboarding - Submit onboarding responses
app.post('/api/onboarding', async (req, res) => {
  try {
    const {
      email,
      fitness_goal,
      current_fitness_level,
      workout_frequency,
      diet_preference,
      motivation,
      biggest_challenge,
      how_found_us,
      feature_interest,
      willing_to_pay,
      price_range,
    } = req.body;

    console.log(`📥 POST /api/onboarding - email: ${email}`);

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const dbPool = await getDbPool();

    // Get user ID
    const userResult = await dbPool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM user_profiles WHERE email = @email');

    if (userResult.recordset.length === 0) {
      console.log('⚠️ User not found');
      return res.status(404).json({ error: 'User not found. Please sign in first.' });
    }

    const userId = userResult.recordset[0].id;

    // Check if onboarding already exists
    const existingOnboarding = await dbPool.request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .query('SELECT id FROM onboarding_responses WHERE user_id = @user_id');

    if (existingOnboarding.recordset.length > 0) {
      // Update existing onboarding
      console.log('🔄 Updating existing onboarding');
      await dbPool.request()
        .input('user_id', sql.UniqueIdentifier, userId)
        .input('fitness_goal', sql.NVarChar, fitness_goal)
        .input('current_fitness_level', sql.NVarChar, current_fitness_level)
        .input('workout_frequency', sql.NVarChar, workout_frequency)
        .input('diet_preference', sql.NVarChar, diet_preference)
        .input('motivation', sql.NVarChar, motivation)
        .input('biggest_challenge', sql.NVarChar, biggest_challenge)
        .input('how_found_us', sql.NVarChar, how_found_us)
        .input('feature_interest', sql.NVarChar, JSON.stringify(feature_interest || []))
        .input('willing_to_pay', sql.NVarChar, willing_to_pay)
        .input('price_range', sql.NVarChar, price_range)
        .query(`
          UPDATE onboarding_responses
          SET fitness_goal = @fitness_goal,
              current_fitness_level = @current_fitness_level,
              workout_frequency = @workout_frequency,
              diet_preference = @diet_preference,
              motivation = @motivation,
              biggest_challenge = @biggest_challenge,
              how_found_us = @how_found_us,
              feature_interest = @feature_interest,
              willing_to_pay = @willing_to_pay,
              price_range = @price_range
          WHERE user_id = @user_id
        `);
    } else {
      // Insert new onboarding
      console.log('➕ Creating new onboarding');
      await dbPool.request()
        .input('user_id', sql.UniqueIdentifier, userId)
        .input('fitness_goal', sql.NVarChar, fitness_goal)
        .input('current_fitness_level', sql.NVarChar, current_fitness_level)
        .input('workout_frequency', sql.NVarChar, workout_frequency)
        .input('diet_preference', sql.NVarChar, diet_preference)
        .input('motivation', sql.NVarChar, motivation)
        .input('biggest_challenge', sql.NVarChar, biggest_challenge)
        .input('how_found_us', sql.NVarChar, how_found_us)
        .input('feature_interest', sql.NVarChar, JSON.stringify(feature_interest || []))
        .input('willing_to_pay', sql.NVarChar, willing_to_pay)
        .input('price_range', sql.NVarChar, price_range)
        .query(`
          INSERT INTO onboarding_responses (
            user_id, fitness_goal, current_fitness_level, workout_frequency,
            diet_preference, motivation, biggest_challenge, how_found_us,
            feature_interest, willing_to_pay, price_range
          )
          VALUES (
            @user_id, @fitness_goal, @current_fitness_level, @workout_frequency,
            @diet_preference, @motivation, @biggest_challenge, @how_found_us,
            @feature_interest, @willing_to_pay, @price_range
          )
        `);
    }

    // Mark onboarding as completed
    await dbPool.request()
      .input('user_id', sql.UniqueIdentifier, userId)
      .query(`
        UPDATE user_profiles
        SET onboarding_completed = 1, updated_at = GETUTCDATE()
        WHERE id = @user_id
      `);

    console.log('✅ Onboarding saved successfully');
    res.json({ message: 'Onboarding saved successfully', success: true });
  } catch (err) {
    console.error('❌ Error saving onboarding:', err);
    res.status(500).json({
      error: 'Failed to save onboarding response',
      details: err.message,
      success: false
    });
  }
});

// ============================================
// Admin Routes
// ============================================

// DELETE /api/admin/users/:id - Delete a user (Admin only)
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 DELETE /api/admin/users/${id}`);

    const dbPool = await getDbPool();

    // First delete onboarding responses (foreign key constraint)
    await dbPool.request()
      .input('user_id', sql.UniqueIdentifier, id)
      .query('DELETE FROM onboarding_responses WHERE user_id = @user_id');

    // Then delete user profile
    const result = await dbPool.request()
      .input('id', sql.UniqueIdentifier, id)
      .query('DELETE FROM user_profiles WHERE id = @id');

    if (result.rowsAffected[0] === 0) {
      console.log('⚠️ User not found');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ User deleted successfully');
    res.json({ message: 'User deleted successfully', success: true });
  } catch (err) {
    console.error('❌ Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
});

// GET /api/admin/stats - Get admin statistics
app.get('/api/admin/stats', async (req, res) => {
  try {
    console.log('📥 GET /api/admin/stats');
    const dbPool = await getDbPool();

    // Get various statistics
    const stats = await dbPool.request().query(`
      SELECT
        COUNT(*) as total_users,
        SUM(CASE WHEN onboarding_completed = 1 THEN 1 ELSE 0 END) as completed_onboarding,
        SUM(CASE WHEN created_at >= DATEADD(day, -7, GETUTCDATE()) THEN 1 ELSE 0 END) as new_this_week,
        SUM(CASE WHEN created_at >= DATEADD(day, -30, GETUTCDATE()) THEN 1 ELSE 0 END) as new_this_month
      FROM user_profiles
    `);

    // Get fitness goals distribution
    const goalsDistribution = await dbPool.request().query(`
      SELECT fitness_goal, COUNT(*) as count
      FROM onboarding_responses
      WHERE fitness_goal IS NOT NULL
      GROUP BY fitness_goal
      ORDER BY count DESC
    `);

    // Get diet preferences distribution
    const dietDistribution = await dbPool.request().query(`
      SELECT diet_preference, COUNT(*) as count
      FROM onboarding_responses
      WHERE diet_preference IS NOT NULL
      GROUP BY diet_preference
      ORDER BY count DESC
    `);

    // Get fitness levels distribution
    const levelsDistribution = await dbPool.request().query(`
      SELECT current_fitness_level, COUNT(*) as count
      FROM onboarding_responses
      WHERE current_fitness_level IS NOT NULL
      GROUP BY current_fitness_level
      ORDER BY count DESC
    `);

    // Get payment willingness
    const paymentWillingness = await dbPool.request().query(`
      SELECT willing_to_pay, COUNT(*) as count
      FROM onboarding_responses
      WHERE willing_to_pay IS NOT NULL
      GROUP BY willing_to_pay
      ORDER BY count DESC
    `);

    // Get how users found us
    const sources = await dbPool.request().query(`
      SELECT how_found_us, COUNT(*) as count
      FROM onboarding_responses
      WHERE how_found_us IS NOT NULL
      GROUP BY how_found_us
      ORDER BY count DESC
    `);

    console.log('✅ Stats retrieved successfully');
    res.json({
      overview: stats.recordset[0],
      fitnessGoals: goalsDistribution.recordset,
      dietPreferences: dietDistribution.recordset,
      fitnessLevels: levelsDistribution.recordset,
      paymentWillingness: paymentWillingness.recordset,
      sources: sources.recordset
    });
  } catch (err) {
    console.error('❌ Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics', details: err.message });
  }
});

// ============================================
// Error Handling Middleware
// ============================================
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============================================
// Server Startup
// ============================================
async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();

    // Start Express server
    app.listen(PORT, () => {
      console.log('');
      console.log('🚀 ========================================');
      console.log(`🚀  ReddyFit API Server is running!`);
      console.log(`🚀  Port: ${PORT}`);
      console.log(`🚀  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🚀  Health Check: http://localhost:${PORT}/api/health`);
      console.log('🚀 ========================================');
      console.log('');
    });
  } catch (err) {
    console.error('💥 Failed to start server:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, closing database connection...');
  if (pool) {
    await pool.close();
  }
  process.exit(0);
});

// Start the server
startServer();
