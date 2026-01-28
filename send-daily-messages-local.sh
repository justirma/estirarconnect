#!/bin/bash

# Log file for debugging
LOG_FILE="/Users/irma/Desktop/slowbuild/estirarconnect/cron-log.txt"

# Add timestamp to log
echo "==================================" >> "$LOG_FILE"
echo "Running at: $(date)" >> "$LOG_FILE"

# Change to backend directory
cd /Users/irma/Desktop/slowbuild/estirarconnect/backend

# Load environment variables and run the send messages endpoint
/opt/homebrew/bin/node -e "
import('dotenv/config').then(() => {
  import('./src/controllers/messageController.js').then(({ sendDailyMessages }) => {
    // Mock req and res objects
    const req = {};
    const res = {
      json: (data) => {
        console.log('Response:', JSON.stringify(data, null, 2));
        process.exit(data.success ? 0 : 1);
      },
      status: (code) => ({
        json: (data) => {
          console.log('Status:', code);
          console.log('Response:', JSON.stringify(data, null, 2));
          process.exit(code === 200 ? 0 : 1);
        }
      })
    };
    sendDailyMessages(req, res);
  });
});
" >> "$LOG_FILE" 2>&1

echo "Completed at: $(date)" >> "$LOG_FILE"
