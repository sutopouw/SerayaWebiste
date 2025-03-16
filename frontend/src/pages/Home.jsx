import { Gift, Trophy, ArrowRight, Clock, Info, Copy, Award, Users, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function Home() {
  const [winnerCount, setWinnerCount] = useState(0);
  const [recentWinners, setRecentWinners] = useState([]);
  const [eventCountdown, setEventCountdown] = useState('Memuat...');
  const [eventLink, setEventLink] = useState(''); // State untuk menyimpan link event
  const [eventStarted, setEventStarted] = useState(false); // State untuk menentukan apakah event sudah dimulai
  const [stats, setStats] = useState({
    total_events: 0,
    total_roles: 0,
    average_speed: 0
  });

  // Ambil data pemenang dan hitung jumlah
  useEffect(() => {
    const fetchWinners = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/public/winners`);
        setWinnerCount(data.length);
        setRecentWinners(data.slice(0, 3));
      } catch (error) {
        console.error('Error fetching winners:', error);
      }
    };
    fetchWinners();
  }, []);

  // Ambil statistik
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/public/stats`);
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    fetchStats();
  }, []);

  // Hitungan mundur dan link untuk event berikutnya
  useEffect(() => {
    let countdownInterval;
  
    const updateCountdown = (eventDate) => {
      const now = new Date();
      const targetDate = new Date(eventDate);

      // Debug logs
      console.log('Countdown update:');
      console.log('Now UTC:', now.toISOString());
      console.log('Target UTC:', targetDate.toISOString());
      console.log('Now WIB:', new Date(now.getTime() + (7 * 60 * 60 * 1000)).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }));
      console.log('Target WIB:', new Date(targetDate.getTime() + (7 * 60 * 60 * 1000)).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }));
      
      const diff = targetDate.getTime() - now.getTime();
      console.log('Time difference (ms):', diff);

      if (diff <= 0) {
        setEventStarted(true);
        setEventCountdown('Event Dimulai!');
        return true; // Event has started
      }

      setEventStarted(false);
      
      // Hitung interval dalam menit dan detik jika kurang dari 1 jam
      if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setEventCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } 
      // Hitung dalam jam dan menit jika kurang dari 24 jam
      else if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setEventCountdown(`${hours}j ${minutes.toString().padStart(2, '0')}m`);
      }
      // Hitung dalam hari dan jam jika lebih dari 24 jam
      else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        setEventCountdown(`${days}h ${hours}j`);
      }
      
      return false; // Event hasn't started
    };

    const fetchNextEvent = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/public/next-event`);
        console.log('Next event data:', data);

        if (!data.event_date) {
          setEventCountdown('Tidak ada event');
          setEventLink('');
          setEventStarted(false);
          return;
        }

        // Clear existing interval if any
        if (countdownInterval) {
          clearInterval(countdownInterval);
        }

        // Initial update
        const hasStarted = updateCountdown(data.event_date);

        // If event has started and we have a link ID
        if (hasStarted && data.link_id) {
          setEventLink(`${window.location.origin}/submit/${data.link_id}`);
          setEventStarted(true);
        } else {
          setEventLink(''); // Clear link if event hasn't started
          setEventStarted(false);
        }

        // Set up new interval for countdown
        countdownInterval = setInterval(() => {
          const hasStarted = updateCountdown(data.event_date);
          if (hasStarted && data.link_id) {
            setEventLink(`${window.location.origin}/submit/${data.link_id}`);
            setEventStarted(true);
          }
        }, 1000);

      } catch (error) {
        console.error('Error fetching next event:', error);
        if (error.response?.status === 404) {
          setEventCountdown('Tidak ada event');
        } else {
          setEventCountdown('Error memuat event');
        }
        setEventLink('');
        setEventStarted(false);
      }
    };

    // Initial fetch
    fetchNextEvent();
    
    // Poll for updates every 5 seconds
    const pollingInterval = setInterval(fetchNextEvent, 5000);

    // Cleanup
    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, []); // Empty dependency array since we don't need to track any dependencies

  const copyToClipboard = () => {
    if (eventLink) {
      navigator.clipboard.writeText(eventLink);
      toast.success('Link disalin ke clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex flex-col">
      {/* Hero Section dengan Countdown Event dan Link */}
      <motion.section
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="flex-1 flex flex-col items-center justify-center text-center py-20 px-4"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-6"
        >
          <Gift className="w-24 h-24 text-blue-500" />
        </motion.div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-800 mb-4">
          Selamat Datang di <span className="text-blue-600">Seraya</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mb-6">
          Disini kecepatan tangamu di uji, dapatkan role, dan nikmati hadiah-hadiah menarik!
        </p>
        <div className="flex items-center bg-blue-100 text-blue-700 px-4 py-2 rounded-full mb-4">
          <Clock className="w-5 h-5 mr-2" />
          <span className="font-semibold">Kaget Berikutnya: {eventCountdown}</span>
        </div>
        {eventStarted && eventLink && (
          <div className="flex items-center space-x-2 mb-8">
            <input
              type="text"
              value={eventLink}
              readOnly
              className="p-2 border rounded-lg bg-gray-50 text-gray-700"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={copyToClipboard}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
            >
              <Copy className="w-5 h-5" />
            </motion.button>
          </div>
        )}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-300"
          onClick={() => window.open('https://discord.gg/your-server', '_blank')}
        >
          Gabung Discord <ArrowRight className="w-5 h-5 ml-2" />
        </motion.button>
      </motion.section>

      {/* Statistics Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="py-16 bg-white"
      >
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Statistik Seraya</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md text-center"
            >
              <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{stats.total_events}</h3>
              <p className="text-gray-600">Total Event</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-md text-center"
            >
              <div className="w-12 h-12 bg-purple-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{stats.total_roles}</h3>
              <p className="text-gray-600">Role Dibagikan</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-md text-center"
            >
              <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{stats.average_speed}s</h3>
              <p className="text-gray-600">Rata-rata Kecepatan</p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Recent Winners Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="py-16"
      >
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Pemenang Terakhir</h2>
          <div className="max-w-4xl mx-auto">
            {recentWinners.length === 0 ? (
              <p className="text-center text-gray-500">Belum ada pemenang</p>
            ) : (
              <div className="space-y-4">
                {recentWinners.map((winner, index) => (
                  <motion.div
                    key={winner.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="p-4 bg-white rounded-lg shadow-md flex items-center space-x-4"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center">
                        <Trophy className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{winner.winner_username}</h3>
                      <p className="text-sm text-gray-500">
                        Role: <span className="text-blue-600">{winner.role_reward}</span>
                      </p>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {new Date(winner.created_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* How to Play Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="py-16 bg-white"
      >
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Cara Bermain Kaget</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="p-6 bg-white rounded-lg shadow-md text-center"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Dapatkan Link</h3>
              <p className="text-gray-600">Menunggu link kaget dari admin di server Discord kami.</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="p-6 bg-white rounded-lg shadow-md text-center"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Submit Cepat</h3>
              <p className="text-gray-600">Masukkan username dan Discord ID secepat mungkin.</p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="p-6 bg-white rounded-lg shadow-md text-center"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Menang Role</h3>
              <p className="text-gray-600">Dapatkan role eksklusif secara acak jika kamu tercepat!</p>
            </motion.div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

export default Home;