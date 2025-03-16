const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateSchema() {
  try {
    console.log('Starting schema update...');

    // Update links table with all required columns
    console.log('Updating links table...');
    
    // First try to add winner_username column
    const { error: usernameError } = await supabase
      .from('links')
      .update({ winner_username: null })
      .eq('id', 'dummy-id');
    
    if (usernameError && !usernameError.message.includes('does not exist')) {
      console.error('Error checking winner_username column:', usernameError);
      return;
    }

    // Try to add discord_id column
    const { error: discordError } = await supabase
      .from('links')
      .update({ discord_id: null })
      .eq('id', 'dummy-id');
    
    if (discordError && !discordError.message.includes('does not exist')) {
      console.error('Error checking discord_id column:', discordError);
      return;
    }

    // Try to add role_reward column
    const { error: roleError } = await supabase
      .from('links')
      .update({ role_reward: null })
      .eq('id', 'dummy-id');
    
    if (roleError && !roleError.message.includes('does not exist')) {
      console.error('Error checking role_reward column:', roleError);
      return;
    }

    console.log('Schema verification completed. If you see any "does not exist" errors above, please add the missing columns in the Supabase dashboard.');
    console.log('Required columns:');
    console.log('- winner_username (text)');
    console.log('- discord_id (text)');
    console.log('- role_reward (text)');
    
  } catch (error) {
    console.error('Error updating schema:', error);
  }
}

updateSchema(); 