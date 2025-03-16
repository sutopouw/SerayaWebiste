const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// CORS configuration
app.use(cors({
  origin: '*', // Allow all origins temporarily for debugging
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: true,
  optionsSuccessStatus: 204
}));

// Handle OPTIONS preflight requests
app.options('*', cors());

app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Seraya Backend API is running',
    version: '1.0.0'
  });
});

// Rate limiter configurations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per windowMs
  message: { message: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.' }
});

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per windowMs
  message: { message: 'Terlalu banyak percobaan submit. Silakan coba lagi dalam 1 jam.' }
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { message: 'Terlalu banyak request. Silakan coba lagi dalam 1 menit.' }
});

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Helper function untuk konversi waktu ke WIB
function convertToWIB(date) {
  return new Date(date.getTime() + (7 * 60 * 60 * 1000));
}

// Helper function untuk mendapatkan waktu WIB saat ini
function getCurrentWIBDate() {
  const now = new Date();
  return convertToWIB(now);
}

// Helper function to format date to WIB
function formatToWIB(date) {
  return new Date(date).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// Inisialisasi database (tidak diperlukan untuk Supabase karena tabel dibuat melalui dashboard)
async function initDB() {
  try {
    // Verifikasi koneksi ke Supabase
    const { data, error } = await supabase
      .from('events')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    console.log('Database connection verified successfully');
  } catch (err) {
    console.error('Error connecting to Supabase:', err);
    throw err;
  }
}

// Seed data dummy untuk events
async function seedEvents() {
  try {
    const { data: events, error: countError } = await supabase
      .from('events')
      .select('*');

    if (countError) throw countError;

    if (!events || events.length === 0) {
      // Set waktu event 2 hari ke depan
      const nextEventDate = new Date();
      nextEventDate.setDate(nextEventDate.getDate() + 2);
      nextEventDate.setHours(15, 0, 0, 0); // Set ke jam 15:00:00 WIB
      
      // Insert event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert([{ event_date: nextEventDate.toISOString() }])
        .select()
        .single();

      if (eventError) throw eventError;

      // Generate and insert link for the event
      const linkId = uuidv4();
      const expiresAt = new Date(nextEventDate);
      expiresAt.setDate(expiresAt.getDate() + 1); // Expired 24 jam setelah event
      
      const { error: linkError } = await supabase
        .from('links')
        .insert([{
          id: linkId,
          event_id: eventData.id,
          expires_at: expiresAt.toISOString(),
          is_used: false,
          attempt_count: 0
        }]);

      if (linkError) throw linkError;
      console.log('Dummy event and link added successfully');
      console.log('Event time (WIB):', formatToWIB(nextEventDate));
    } else {
      console.log('Events already exist, skipping seed');
    }
  } catch (err) {
    console.error('Error seeding events:', err);
  }
}

// Jalankan inisialisasi dan seeding secara berurutan
async function initialize() {
  try {
    await initDB(); // Tunggu hingga tabel dibuat
    await seedEvents(); // Baru kemudian seed data
  } catch (err) {
    console.error('Failed to initialize application:', err);
    process.exit(1); // Keluar dari aplikasi jika gagal
  }
}

initialize(); // Panggil fungsi inisialisasi

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123';

// Daftar role untuk gacha
const ROLES = ['Alya', 'Amanda', 'Anindya', 'Aralie', 'Cathy', 'Chelsea', 'Christy', 'Cynthia', 'Daisy',
  'Danella', 'Delynn', 'Eli', 'Elin', 'Ella', 'Erine', 'Feni', 'Fiony', 'Freya', 'Fritzy', 'Gendis', 'Gita',
  'Gracia', 'Gracie', 'Greesel', 'Indah', 'Indira', 'Jessi', 'Kathrina', 'Kimmy', 'Lana', 'Levi', 'Lia', 'Lily',
  'Lulu', 'Lyn', 'Marsha', 'Michie', 'Moreen', 'Muthe', 'Nachia', 'Nala', 'Nayla', 'Oline', 'Olla', 'Oniel',
  'Raisha', 'Regie', 'Ribka', 'Trisha'];

// Fungsi gacha role
const getRandomRole = () => {
  const randomIndex = Math.floor(Math.random() * ROLES.length);
  return ROLES[randomIndex];
};

// Login admin with rate limiting
app.post('/api/admin/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Middleware autentikasi JWT
const authenticateAdmin = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid token' });
    req.user = decoded;
    next();
  });
};

// Generate link baru
app.post('/api/generate-link', authenticateAdmin, async (req, res) => {
  try {
    // Get the next upcoming event
    const now = new Date();
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, event_date')
      .gt('event_date', now.toISOString())
      .order('event_date', { ascending: true })
      .limit(1)
      .single();

    if (eventError) {
      if (eventError.code === 'PGRST116') {
        return res.status(400).json({ message: 'Tidak ada event yang akan datang. Silakan buat event terlebih dahulu.' });
      }
      throw eventError;
    }

    if (!event) {
      return res.status(400).json({ message: 'Tidak ada event yang akan datang. Silakan buat event terlebih dahulu.' });
    }

    const linkId = uuidv4();
    // Set expiration to 1 hour after event
    const expiresAt = new Date(event.event_date);
    expiresAt.setHours(expiresAt.getHours() + 1);

    const { error: insertError } = await supabase
      .from('links')
      .insert([{ 
        id: linkId,
        event_id: event.id,
        expires_at: expiresAt.toISOString(),
        is_used: false,
        attempt_count: 0
      }]);

    if (insertError) throw insertError;

    res.json({ 
      linkId,
      eventDate: formatToWIB(new Date(event.event_date)),
      expiresAt: formatToWIB(expiresAt)
    });
  } catch (err) {
    console.error('Error generating link:', err);
    res.status(500).json({ 
      message: 'Failed to generate link', 
      error: err.message,
      debug_info: {
        error_message: err.message,
        error_stack: err.stack
      }
    });
  }
});

// Submit form dengan rate limiting
app.post('/api/submit/:linkId', submitLimiter, async (req, res) => {
  const { linkId } = req.params;
  const { username, discordId } = req.body;

  try {
    // Get the link dengan informasi event dalam satu query
    const { data: link, error: fetchError } = await supabase
      .from('links')
      .select(`
        *,
        events!inner (
          event_date
        )
      `)
      .eq('id', linkId)
      .single();

    if (fetchError) {
      console.error('Error fetching link:', fetchError);
      return res.status(404).json({ 
        message: 'Link tidak valid atau event tidak ditemukan!',
        attempt_count: 0,
        debug_info: {
          error: fetchError.message,
          hint: fetchError.hint,
          details: fetchError.details
        }
      });
    }

    if (!link) {
      return res.status(404).json({ 
        message: 'Link tidak valid!',
        attempt_count: 0
      });
    }

    if (!link.events || !link.events.event_date) {
      return res.status(400).json({
        message: 'Event tidak ditemukan untuk link ini!',
        attempt_count: 0
      });
    }

    const now = new Date();
    const eventDate = new Date(link.events.event_date);
    const expiresAt = new Date(link.expires_at);

    console.log('Submit attempt:', {
      now: now.toISOString(),
      eventDate: eventDate.toISOString(),
      expiresAt: expiresAt.toISOString(),
      linkId,
      username,
      discordId,
      currentAttemptCount: link.attempt_count || 0
    });

    // Cek apakah link sudah digunakan
    if (link.is_used) {
      return res.status(400).json({ 
        message: `Link sudah digunakan oleh orang lain! (Ada ${link.attempt_count || 0} orang yang mencoba sebelum Anda)`,
        attempt_count: link.attempt_count || 0
      });
    }

    // Cek apakah sudah waktunya event
    if (now < eventDate) {
      // Update attempt count
      await supabase
        .from('links')
        .update({ attempt_count: (link.attempt_count || 0) + 1 })
        .eq('id', linkId);

      return res.status(400).json({ 
        message: 'Event belum dimulai!',
        event_date_formatted: formatToWIB(eventDate),
        attempt_count: (link.attempt_count || 0) + 1,
        debug_info: {
          current_time: formatToWIB(now),
          event_time: formatToWIB(eventDate)
        }
      });
    }

    // Cek apakah link sudah expired
    if (now > expiresAt) {
      // Update attempt count
      await supabase
        .from('links')
        .update({ attempt_count: (link.attempt_count || 0) + 1 })
        .eq('id', linkId);

      return res.status(400).json({ 
        message: 'Link telah kadaluarsa!',
        expired_at_formatted: formatToWIB(expiresAt),
        attempt_count: (link.attempt_count || 0) + 1,
        debug_info: {
          current_time: formatToWIB(now),
          expires_at: formatToWIB(expiresAt)
        }
      });
    }

    // Coba update link dengan optimistic locking
    const roleReward = getRandomRole();
    const { data: updatedLink, error: updateError } = await supabase
      .from('links')
      .update({ 
        is_used: true, 
        winner_username: username, 
        discord_id: discordId, 
        role_reward: roleReward,
        attempt_count: (link.attempt_count || 0) + 1
      })
      .eq('id', linkId)
      .eq('is_used', false) // Pastikan link belum digunakan
      .select()
      .single();

    if (updateError) {
      console.error('Error updating link:', updateError);
      return res.status(500).json({
        message: 'Gagal mengupdate link',
        attempt_count: (link.attempt_count || 0) + 1,
        debug_info: {
          error: updateError.message,
          hint: updateError.hint,
          details: updateError.details
        }
      });
    }

    if (!updatedLink) {
      // Ambil data terbaru untuk mendapatkan attempt_count yang benar
      const { data: currentLink } = await supabase
        .from('links')
        .select('attempt_count, winner_username')
        .eq('id', linkId)
        .single();

      return res.status(400).json({ 
        message: `Link sudah digunakan oleh ${currentLink?.winner_username || 'orang lain'}! (Ada ${currentLink?.attempt_count || 0} orang yang mencoba)`,
        attempt_count: currentLink?.attempt_count || 0
      });
    }

    // Kirim notifikasi ke Discord webhook
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await axios.post(webhookUrl, {
          embeds: [{
            title: '🏆 Pemenang Kaget Baru!',
            description: `🔥 **User tergercep!** 🚀\n\n🎉 **Selamat ya wak~:**`,
            color: 0xffd700,
            fields: [
              { name: '👤 Username', value: `\`${username}\``, inline: true },
              { name: '🆔 Discord ID', value: `\`${discordId}\``, inline: true },
              { name: '🏅 Role Dimenangkan', value: `\`${roleReward}\``, inline: false },
              { name: '🔗 Link ID', value: `\`${linkId}\``, inline: false },
              { name: '⏳ Waktu Kemenangan', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            ],
            timestamp: new Date().toISOString()
          }]
        });
      } catch (webhookError) {
        console.error('Gagal mengirim webhook:', webhookError.message);
      }
    }

    res.json({
      message: 'Selamat! Anda adalah pemenangnya. Role Discord akan segera diberikan.',
      expiresAt: formatToWIB(expiresAt),
      roleReward,
      attempt_count: updatedLink.attempt_count
    });
  } catch (error) {
    console.error('Error submitting link:', error);
    res.status(500).json({ 
      message: 'Terjadi kesalahan server!', 
      error: error.message,
      details: error.details || 'No additional details',
      debug_info: {
        error_message: error.message,
        error_stack: error.stack
      }
    });
  }
});

// Riwayat pemenang (admin)
app.get('/api/winners', authenticateAdmin, async (req, res) => {
  try {
    const { data: winners, error } = await supabase
      .from('links')
      .select('id, winner_username, discord_id, role_reward, created_at')
      .eq('is_used', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Format waktu ke WIB untuk setiap winner
    const formattedWinners = winners.map(winner => ({
      ...winner,
      created_at_formatted: formatToWIB(new Date(winner.created_at))
    }));
    
    res.json(formattedWinners);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch winners', error: err.message });
  }
});

// Pemenang publik
app.get('/api/public/winners', async (req, res) => {
  try {
    const { data: winners, error } = await supabase
      .from('links')
      .select(`
        id,
        winner_username,
        role_reward,
        created_at
      `)
      .eq('is_used', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    // Format waktu ke WIB untuk setiap winner
    const formattedWinners = winners.map(winner => ({
      ...winner,
      created_at_formatted: formatToWIB(new Date(winner.created_at))
    }));

    res.json(formattedWinners);
  } catch (err) {
    console.error('Error fetching public winners:', err);
    res.status(500).json({ 
      message: 'Failed to fetch winners', 
      error: err.message,
      debug_info: {
        error_message: err.message,
        error_stack: err.stack
      }
    });
  }
});

app.post('/api/admin/add-event', authenticateAdmin, async (req, res) => {
  try {
    const { eventDate } = req.body;
    
    // Parse event time from ISO string
    const eventTimeUTC = new Date(eventDate);
    
    console.log('Adding event:');
    console.log('Input UTC:', eventDate);
    console.log('Parsed UTC:', eventTimeUTC.toISOString());
    console.log('WIB:', formatToWIB(eventTimeUTC));

    // Insert event
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .insert([{ 
        event_date: eventTimeUTC.toISOString()
      }])
      .select()
      .single();

    if (eventError) throw eventError;
    
    // Create expiration time (1 hour after event)
    const expiresAt = new Date(eventTimeUTC.getTime() + (60 * 60 * 1000)); // 1 hour in milliseconds
    
    // Create link
    const linkId = uuidv4();
    const { error: linkError } = await supabase
      .from('links')
      .insert([{
        id: linkId,
        event_id: eventData.id,
        expires_at: expiresAt.toISOString()
      }]);

    if (linkError) throw linkError;

    res.json({
      message: 'Event dan link berhasil ditambahkan',
      linkId,
      eventId: eventData.id,
      eventDateFormatted: formatToWIB(eventTimeUTC),
      expiresAtFormatted: formatToWIB(expiresAt),
      debug_info: {
        event_date_utc: eventTimeUTC.toISOString(),
        event_date_wib: formatToWIB(eventTimeUTC),
        expires_at_utc: expiresAt.toISOString(),
        expires_at_wib: formatToWIB(expiresAt)
      }
    });
  } catch (error) {
    console.error('Error adding event:', error);
    res.status(500).json({
      error: 'Internal server error',
      debug_info: {
        error_message: error.message,
        error_stack: error.stack
      }
    });
  }
});

app.get('/api/public/next-event', async (req, res) => {
  try {
    const now = new Date();
    console.log('Checking for next event:');
    console.log('Current UTC:', now.toISOString());
    console.log('Current WIB:', formatToWIB(now));

    // First check if the events table exists and has the right structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('events')
      .select('count')
      .limit(1);

    if (tableError) {
      console.error('Error checking events table:', tableError);
      return res.json({
        message: 'Tidak ada event',
        current_time: formatToWIB(now),
        debug_info: {
          error: tableError.message,
          current_time_utc: now.toISOString(),
          current_time_wib: formatToWIB(now)
        }
      });
    }

    // Get next event
    const { data: events, error } = await supabase
      .from('events')
      .select(`
        event_date,
        id,
        links (
          id,
          expires_at
        )
      `)
      .gt('event_date', now.toISOString())
      .order('event_date', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code === 'PGRST116') {
      // No results found - this is normal when there are no future events
      return res.json({
        message: 'Tidak ada event',
        current_time: formatToWIB(now),
        debug_info: {
          current_time_utc: now.toISOString(),
          current_time_wib: formatToWIB(now)
        }
      });
    }

    if (error) {
      // Some other error occurred
      console.error('Error fetching next event:', error);
      return res.json({
        message: 'Tidak ada event',
        current_time: formatToWIB(now),
        debug_info: {
          error: error.message,
          current_time_utc: now.toISOString(),
          current_time_wib: formatToWIB(now)
        }
      });
    }

    if (!events) {
      return res.json({
        message: 'Tidak ada event',
        current_time: formatToWIB(now),
        debug_info: {
          current_time_utc: now.toISOString(),
          current_time_wib: formatToWIB(now)
        }
      });
    }

    const eventTime = new Date(events.event_date);
    const link = events.links?.[0];
    const expiresAt = link?.expires_at ? new Date(link.expires_at) : null;

    console.log('Found event:');
    console.log('Event UTC:', eventTime.toISOString());
    console.log('Event WIB:', formatToWIB(eventTime));

    res.json({
      event_date: eventTime.toISOString(),
      event_date_formatted: formatToWIB(eventTime),
      link_id: link?.id,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      expires_at_formatted: expiresAt ? formatToWIB(expiresAt) : null,
      message: 'Event ditemukan',
      current_time: formatToWIB(now),
      debug_info: {
        current_time_utc: now.toISOString(),
        current_time_wib: formatToWIB(now),
        event_time_utc: eventTime.toISOString(),
        event_time_wib: formatToWIB(eventTime)
      }
    });
  } catch (error) {
    console.error('Error in /api/public/next-event:', error);
    return res.json({
      message: 'Tidak ada event',
      current_time: formatToWIB(new Date()),
      debug_info: {
        error_message: error.message,
        error_stack: error.stack
      }
    });
  }
});

// Cek status link
app.get('/api/check-link/:linkId', async (req, res) => {
  const { linkId } = req.params;
  try {
    const { data: link, error } = await supabase
      .from('links')
      .select('is_used')
      .eq('id', linkId)
      .single();

    if (error) throw error;
    
    if (!link) {
      return res.status(404).json({ message: 'Link tidak ditemukan' });
    }
    
    res.json({ is_used: link.is_used });
  } catch (err) {
    res.status(500).json({ message: 'Gagal memeriksa status link', error: err.message });
  }
});

// Function to update schema
async function updateSchema() {
  try {
    // Create events table
    const { error: eventsError } = await supabase
      .from('events')
      .upsert([
        {
          id: -1, // Dummy row that will be replaced
          event_date: new Date().toISOString()
        }
      ], { onConflict: 'id' });

    if (eventsError) throw eventsError;

    // Create links table with all required columns
    const { error: linksError } = await supabase
      .from('links')
      .upsert([
        {
          id: '00000000-0000-0000-0000-000000000000',
          event_id: -1,
          expires_at: new Date().toISOString(),
          is_used: false,
          attempt_count: 0,
          winner_username: '',
          discord_id: '',
          role_reward: '',
          created_at: new Date().toISOString()
        }
      ], { onConflict: 'id' });

    if (linksError) {
      console.error('Error creating links table:', linksError);
      throw linksError;
    }

    // Clean up dummy data
    await supabase.from('links').delete().eq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('events').delete().eq('id', -1);

    console.log('Schema updated successfully');

  } catch (error) {
    console.error('Error updating schema:', error);
    throw error;
  }
}

// Update schema when server starts
updateSchema().then(() => {
  console.log('Schema update completed');
  // After schema update, verify the columns
  return supabase.from('links').select().limit(1);
}).then(({ data, error }) => {
  if (error) {
    console.error('Error verifying schema:', error);
  } else {
    console.log('Schema verification completed');
  }
}).catch(error => {
  console.error('Failed to update/verify schema:', error);
});

// Get public statistics
app.get('/api/public/stats', async (req, res) => {
  try {
    // Get total events and total roles given
    const { data: totalEventsData } = await supabase.from('events').select('count');
    const { data: totalRolesData } = await supabase.from('links').select('count').eq('is_used', true);
    
    // Get winners with their event dates and submission times
    const { data: winners } = await supabase
      .from('links')
      .select(`
        created_at,
        events (
          event_date
        )
      `)
      .eq('is_used', true)
      .order('created_at');

    console.log('Raw winners data:', JSON.stringify(winners, null, 2));
    
    let totalValidSubmits = 0;
    let totalSeconds = 0;
    const PRE_EVENT_WINDOW = 5 * 60; // 5 minutes in seconds
    const POST_EVENT_WINDOW = 60 * 60; // 1 hour in seconds

    winners.forEach(winner => {
      const submitTime = new Date(winner.created_at).getTime();
      const eventTime = new Date(winner.events.event_date).getTime();
      const diffInSeconds = (submitTime - eventTime) / 1000;
      
      console.log(`Submission time: ${winner.created_at}`);
      console.log(`Event time: ${winner.events.event_date}`);
      console.log(`Time difference: ${diffInSeconds} seconds`);

      // Count submissions that are:
      // 1. Within 5 minutes before the event OR
      // 2. After the event starts but within 1 hour
      if (diffInSeconds >= -PRE_EVENT_WINDOW && diffInSeconds <= POST_EVENT_WINDOW) {
        totalValidSubmits++;
        
        // For submissions before the event, use the absolute time difference
        // This better reflects how early they were
        totalSeconds += Math.abs(diffInSeconds);
        
        console.log('Valid submission counted with time:', Math.abs(diffInSeconds));
      } else {
        console.log('Invalid submission - outside time window');
      }
    });

    const averageSeconds = totalValidSubmits > 0 ? Math.round(totalSeconds / totalValidSubmits) : 0;
    
    console.log('Stats calculation:', {
      totalEvents: totalEventsData[0].count,
      totalRoles: totalRolesData[0].count,
      validSubmits: totalValidSubmits,
      totalSeconds,
      averageSeconds
    });

    res.json({
      total_events: totalEventsData[0].count,
      total_roles: totalRolesData[0].count,
      average_speed: averageSeconds
    });
  } catch (error) {
    console.error('Error calculating stats:', error);
    res.status(500).json({ error: 'Error calculating stats' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});