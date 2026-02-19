import { getRecentLogsWithDetails } from '../services/database.js';

export async function getRecentLogs(req, res) {
  try {
    const logs = await getRecentLogsWithDetails(50);
    return res.json({ success: true, logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export function serveAdminDashboard(req, res) {
  const token = req.query.token || '';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Estirar Connect — Admin Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #1a1a1a; }
    .header { background: #075e54; color: white; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .header h1 { font-size: 20px; font-weight: 600; }
    .header .phone { font-size: 14px; opacity: 0.85; }
    .container { max-width: 1100px; margin: 24px auto; padding: 0 16px; }
    .actions { display: flex; gap: 12px; margin-bottom: 24px; align-items: center; }
    .btn { background: #25d366; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn:hover { background: #1da851; }
    .btn:disabled { background: #999; cursor: not-allowed; }
    .status-msg { font-size: 14px; padding: 8px 12px; border-radius: 6px; }
    .status-msg.success { background: #d4edda; color: #155724; }
    .status-msg.error { background: #f8d7da; color: #721c24; }
    .section-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #333; }
    .log-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .log-table th { background: #f8f9fa; text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #dee2e6; }
    .log-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #eee; vertical-align: top; }
    .log-table tr:hover { background: #f8f9fa; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge.sent { background: #cce5ff; color: #004085; }
    .badge.delivered { background: #d4edda; color: #155724; }
    .badge.read { background: #d1ecf1; color: #0c5460; }
    .badge.failed { background: #f8d7da; color: #721c24; }
    .badge.skipped { background: #fff3cd; color: #856404; }
    .badge.completed { background: #d4edda; color: #155724; }
    .reply-text { max-width: 200px; word-wrap: break-word; }
    .empty { text-align: center; padding: 40px; color: #999; }
    .refresh-note { font-size: 12px; color: #999; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Estirar Connect</h1>
      <div>Admin Dashboard — WhatsApp Chair Exercise Bot</div>
    </div>
    <div class="phone">WhatsApp Business Account</div>
  </div>

  <div class="container">
    <div class="actions">
      <button class="btn" id="sendTestBtn" onclick="sendTestMessage()">Send Test Message</button>
      <span id="statusMsg"></span>
    </div>

    <div class="section-title">Message Log</div>
    <div class="refresh-note">Auto-refreshes every 5 seconds</div>

    <table class="log-table">
      <thead>
        <tr>
          <th>Senior</th>
          <th>Video Sent</th>
          <th>Sent At</th>
          <th>Status</th>
          <th>Reply</th>
          <th>Replied At</th>
          <th>Completed</th>
        </tr>
      </thead>
      <tbody id="logBody">
        <tr><td colspan="7" class="empty">Loading...</td></tr>
      </tbody>
    </table>
  </div>

  <script>
    const TOKEN = '${token}';

    function apiHeaders() {
      return { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };
    }

    function formatDate(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    }

    async function fetchLogs() {
      try {
        const res = await fetch('/admin/api/logs', { headers: apiHeaders() });
        const data = await res.json();
        if (!data.success) return;

        const tbody = document.getElementById('logBody');
        if (!data.logs || data.logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="empty">No messages yet</td></tr>';
          return;
        }

        tbody.innerHTML = data.logs.map(log => {
          const senior = log.seniors || {};
          const video = log.videos || {};
          return '<tr>' +
            '<td><strong>' + (senior.phone_number || 'Unknown') + '</strong><br><small>' + (senior.language || '').toUpperCase() + '</small></td>' +
            '<td>' + (video.title || '—') + '</td>' +
            '<td>' + formatDate(log.sent_at) + '</td>' +
            '<td><span class="badge ' + (log.status || '') + '">' + (log.status || '—') + '</span></td>' +
            '<td class="reply-text">' + (log.reply_text || '—') + '</td>' +
            '<td>' + formatDate(log.replied_at) + '</td>' +
            '<td>' + (log.completed ? '<span class="badge completed">Yes</span>' : '—') + '</td>' +
          '</tr>';
        }).join('');
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      }
    }

    async function sendTestMessage() {
      const btn = document.getElementById('sendTestBtn');
      const msg = document.getElementById('statusMsg');
      btn.disabled = true;
      btn.textContent = 'Sending...';
      msg.textContent = '';
      msg.className = 'status-msg';

      try {
        const res = await fetch('/messages/send-test', {
          method: 'POST',
          headers: apiHeaders()
        });
        const data = await res.json();

        if (data.success) {
          msg.textContent = 'Message sent to ' + (data.details?.phoneNumber || 'test number');
          msg.className = 'status-msg success';
          setTimeout(fetchLogs, 2000);
        } else {
          msg.textContent = 'Failed: ' + (data.error?.message || JSON.stringify(data.error) || 'Unknown error');
          msg.className = 'status-msg error';
        }
      } catch (err) {
        msg.textContent = 'Error: ' + err.message;
        msg.className = 'status-msg error';
      }

      btn.disabled = false;
      btn.textContent = 'Send Test Message';
    }

    fetchLogs();
    setInterval(fetchLogs, 5000);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}
