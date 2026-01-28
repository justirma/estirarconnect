#!/bin/bash

echo "Sending daily exercise messages..."
curl -X POST https://estirarconnect-w6j7d37m3-justirmas-projects.vercel.app/messages/send
echo ""
echo "Done! Messages sent."
