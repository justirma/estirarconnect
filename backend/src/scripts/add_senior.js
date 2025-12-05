import { supabase } from '../config/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

async function addSenior() {
  const phoneNumber = '+13055629885';
  const language = 'es';

  try {
    const { data, error } = await supabase
      .from('seniors')
      .upsert({
        phone_number: phoneNumber,
        language: language,
        active: true
      }, {
        onConflict: 'phone_number'
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding senior:', error);
      process.exit(1);
    }

    console.log('✅ Senior added successfully!');
    console.log('Phone:', data.phone_number);
    console.log('Language:', data.language);
    console.log('ID:', data.id);
    process.exit(0);
  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
}

addSenior();
