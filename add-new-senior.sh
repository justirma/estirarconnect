#!/bin/bash

echo "Add a new senior to Estirar Connect"
echo "===================================="
echo ""
read -p "Phone number (format: +1234567890): " PHONE
read -p "Language (en or es): " LANG

# Validate inputs
if [ -z "$PHONE" ] || [ -z "$LANG" ]; then
  echo "Error: Phone number and language are required"
  exit 1
fi

if [ "$LANG" != "en" ] && [ "$LANG" != "es" ]; then
  echo "Error: Language must be 'en' or 'es'"
  exit 1
fi

cd /Users/irma/Desktop/slowbuild/estirarconnect/backend
/opt/homebrew/bin/node -e "
import('dotenv/config').then(() => {
  import('./src/config/supabase.js').then(async ({ supabase }) => {
    const { data, error } = await supabase
      .from('seniors')
      .upsert({
        phone_number: '$PHONE',
        language: '$LANG',
        active: true
      }, {
        onConflict: 'phone_number'
      })
      .select()
      .single();

    if (error) {
      console.error('Error:', error);
      process.exit(1);
    } else {
      console.log('\n✅ Senior added successfully!');
      console.log('Phone:', data.phone_number);
      console.log('Language:', data.language);
      console.log('ID:', data.id);
      process.exit(0);
    }
  });
});
"
