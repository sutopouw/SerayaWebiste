const axios = require('axios');

// Fungsi untuk mendapatkan waktu 15 menit dari sekarang dalam format ISO
const getFifteenMinutesFromNow = () => {
  // Get current time in UTC
  const now = new Date();
  
  // Add 15 minutes directly to UTC time
  const eventTimeUTC = new Date(now.getTime() + (15 * 60 * 1000));
  
  // Debug logs
  console.log('\nTime calculations:');
  console.log('Current UTC:', now.toISOString());
  console.log('Current WIB:', formatToWIB(now));
  console.log('Event UTC:', eventTimeUTC.toISOString());
  console.log('Event WIB:', formatToWIB(eventTimeUTC));
  
  return eventTimeUTC.toISOString();
};

// Helper function untuk format tanggal ke WIB string
function formatToWIB(date) {
  const wibDate = new Date(date.getTime() + (7 * 60 * 60 * 1000));
  return wibDate.toLocaleString('id-ID', { 
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

// Fungsi untuk menambahkan event
const addEvent = async () => {
  try {
    const eventDate = getFifteenMinutesFromNow();
    console.log('\nAdding event for:');
    console.log('UTC:', eventDate);
    console.log('WIB:', formatToWIB(new Date(eventDate)));

    const response = await axios.post(
      'http://localhost:3001/api/admin/add-event',
      { eventDate },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzQyMTEwMzYzLCJleHAiOjE3NDIxMTM5NjN9.YRBNGWPyZUY_zxj1_kIWkyjBGaOMMaLe7V7hFX0uEFI'
        }
      }
    );
    console.log('\nEvent berhasil ditambahkan:', response.data);

    // Verify the event was added by checking next-event endpoint
    const nextEventResponse = await axios.get('http://localhost:3001/api/public/next-event');
    console.log('\nVerifying next event:');
    console.log(JSON.stringify(nextEventResponse.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('Error response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
};

// Jalankan fungsi
addEvent(); 