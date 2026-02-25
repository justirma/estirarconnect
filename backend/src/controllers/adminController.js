import { getRecentLogsWithDetails, getSeniorByPhone, logReply, getCompletionStreak, getActiveSeniors, insertSenior } from '../services/database.js';
import { sendWhatsAppMessage, sendWelcomeTemplate } from '../services/whatsapp.js';

export async function getRecentLogs(req, res) {
  try {
    const logs = await getRecentLogsWithDetails(50);
    return res.json({ success: true, logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

const COMPLETION_KEYWORDS = ['done', 'fin', 'listo', 'lista', 'complete', 'completed', 'hecho', 'finished', 'terminé', 'termine', 'lo hice'];

function isCompletion(text) {
  const lower = text.toLowerCase().trim();
  return COMPLETION_KEYWORDS.some(kw => lower.includes(kw));
}

export async function processReply(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  try {
    const { phoneNumber, replyText } = req.body;
    if (!phoneNumber || !replyText) {
      return res.status(400).json({ success: false, error: 'phoneNumber and replyText required' });
    }

    // Validate phone number format (E.164: + followed by 7-15 digits)
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phoneNumber.trim())) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format. Use E.164 (e.g. +13055629885)' });
    }

    // Sanitize reply text
    const sanitizedReply = String(replyText).trim().slice(0, 1000);
    if (!sanitizedReply) {
      return res.status(400).json({ success: false, error: 'replyText cannot be empty' });
    }

    const senior = await getSeniorByPhone(phoneNumber.trim());
    if (!senior) {
      return res.status(404).json({ success: false, error: 'Senior not found' });
    }

    const completed = isCompletion(sanitizedReply);
    await logReply(senior.id, sanitizedReply, completed);

    if (completed) {
      const streak = await getCompletionStreak(senior.id);
      const lang = senior.language;
      let msg = lang === 'es'
        ? '¡Buen trabajo! 💪 ¡Nos vemos la próxima semana! Tu próximo video será enviado el domingo a las 9 AM EST.'
        : 'Great job! 💪 See you next week! Your next video will be sent Sunday at 9 AM EST.';
      if (streak >= 3) {
        msg += lang === 'es'
          ? `\n\n🔥 ¡${streak} semanas seguidas! ¡Sigue así!`
          : `\n\n🔥 ${streak} weeks in a row! Keep it up!`;
      }
      await sendWhatsAppMessage(senior.phone_number, msg);
    }

    return res.json({ success: true, completed });
  } catch (error) {
    console.error('Error processing reply:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function addSenior(req, res) {
  try {
    const { phone, name, language } = req.body;

    if (!phone || !name || !language) {
      return res.status(400).json({ success: false, error: 'phone, name, and language are required' });
    }

    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phone.trim())) {
      return res.status(400).json({ success: false, error: 'Invalid phone number. Use E.164 format (e.g. +13055629885)' });
    }

    if (!['en', 'es'].includes(language)) {
      return res.status(400).json({ success: false, error: 'language must be "en" or "es"' });
    }

    const sanitizedName = String(name).trim().slice(0, 100);
    if (!sanitizedName) {
      return res.status(400).json({ success: false, error: 'name cannot be empty' });
    }

    const senior = await insertSenior(phone.trim(), sanitizedName, language);

    const welcomeResult = await sendWelcomeTemplate(phone.trim(), sanitizedName, language);
    if (!welcomeResult.success) {
      console.warn(`Welcome template failed for senior ${senior.id}:`, welcomeResult.error);
    }

    return res.json({ success: true, senior, welcomeSent: welcomeResult.success });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'A senior with this phone number already exists' });
    }
    console.error('Error adding senior:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getSeniors(req, res) {
  try {
    const seniors = await getActiveSeniors();
    return res.json({ success: true, seniors });
  } catch (error) {
    console.error('Error fetching seniors:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export function serveAdminDashboard(req, res) {
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
    .container { max-width: 1100px; margin: 24px auto; padding: 0 16px; }
    .actions { display: flex; gap: 12px; margin-bottom: 24px; align-items: center; }
    .btn { background: #25d366; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn:hover { background: #1da851; }
    .btn:disabled { background: #999; cursor: not-allowed; }
    .btn-secondary { background: #075e54; }
    .btn-secondary:hover { background: #054d44; }
    .btn-danger { background: #dc3545; }
    .btn-danger:hover { background: #c82333; }
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
    .badge.reminder { background: #e2d9f3; color: #5a3e91; }
    .reply-text { max-width: 200px; word-wrap: break-word; }
    .empty { text-align: center; padding: 40px; color: #999; }
    .refresh-note { font-size: 12px; color: #999; margin-bottom: 16px; }
    /* Login form */
    #loginView { display: flex; align-items: center; justify-content: center; min-height: 80vh; }
    .login-card { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); width: 100%; max-width: 360px; text-align: center; }
    .login-card h2 { margin-bottom: 8px; color: #075e54; }
    .login-card p { color: #666; font-size: 14px; margin-bottom: 24px; }
    .login-card input { width: 100%; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; margin-bottom: 12px; }
    .login-card input:focus { outline: none; border-color: #25d366; }
    .login-card .btn { width: 100%; }
    .login-error { color: #721c24; font-size: 13px; margin-top: 8px; display: none; }
    /* Add Senior form */
    .add-senior-section { background: white; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .form-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
    .form-field { display: flex; flex-direction: column; gap: 4px; }
    .form-field label { font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; }
    .form-field input, .form-field select { padding: 9px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; min-width: 160px; }
    .form-field input:focus, .form-field select:focus { outline: none; border-color: #25d366; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Estirar Connect</h1>
      <div>Admin Dashboard — WhatsApp Chair Exercise Bot</div>
    </div>
    <button class="btn btn-danger" onclick="logout()" style="padding:6px 14px;font-size:13px;">Logout</button>
  </div>

  <!-- Login view -->
  <div id="loginView">
    <div class="login-card">
      <h2>Admin Login</h2>
      <p>Enter your admin token to continue</p>
      <input type="password" id="tokenInput" placeholder="Admin token" onkeydown="if(event.key==='Enter') login()">
      <button class="btn" onclick="login()">Login</button>
      <div class="login-error" id="loginError">Invalid token. Please try again.</div>
    </div>
  </div>

  <!-- Dashboard view -->
  <div id="dashboardView" style="display:none">
    <div class="container">
      <div class="actions">
        <button class="btn" id="sendTestBtn" onclick="sendTestMessage()">Send Test Message</button>
        <button class="btn btn-secondary" id="processReplyBtn" onclick="processReplyAction()">Process Reply</button>
        <span id="statusMsg"></span>
      </div>

      <div class="add-senior-section">
        <div class="section-title" style="margin-bottom:14px;">Add New Senior</div>
        <div class="form-row">
          <div class="form-field">
            <label>Name</label>
            <input type="text" id="newName" placeholder="Maria Garcia" />
          </div>
          <div class="form-field">
            <label>Phone (E.164)</label>
            <input type="text" id="newPhone" placeholder="+13055629885" />
          </div>
          <div class="form-field">
            <label>Language</label>
            <select id="newLanguage">
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
          <button class="btn" id="addSeniorBtn" onclick="addSeniorAction()">Add &amp; Send Welcome</button>
        </div>
        <span id="addSeniorStatus" style="display:block;margin-top:10px;"></span>
      </div>

      <div style="margin-bottom: 24px;">
        <div class="section-title" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          Active Seniors
          <span id="seniorCount" style="font-size:12px;color:#999;font-weight:400;"></span>
        </div>
        <table class="log-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Language</th>
            </tr>
          </thead>
          <tbody id="seniorBody">
            <tr><td colspan="3" class="empty">Loading...</td></tr>
          </tbody>
        </table>
      </div>

      <div class="section-title">Message Log</div>
      <div class="refresh-note">Auto-refreshes every 30 seconds</div>

      <table class="log-table">
        <thead>
          <tr>
            <th>Senior</th>
            <th>Video</th>
            <th>Type</th>
            <th>Sent At</th>
            <th>Status</th>
            <th>Reply</th>
            <th>Replied At</th>
            <th>Completed</th>
          </tr>
        </thead>
        <tbody id="logBody">
          <tr><td colspan="8" class="empty">Loading...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const TOKEN_KEY = 'estirarAdminToken';

    function esc(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function getToken() {
      return sessionStorage.getItem(TOKEN_KEY);
    }

    function apiHeaders() {
      return { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' };
    }

    function showLogin() {
      document.getElementById('loginView').style.display = 'flex';
      document.getElementById('dashboardView').style.display = 'none';
    }

    function showDashboard() {
      document.getElementById('loginView').style.display = 'none';
      document.getElementById('dashboardView').style.display = 'block';
      fetchSeniors();
      fetchLogs();
    }

    async function login() {
      const token = document.getElementById('tokenInput').value.trim();
      if (!token) return;

      // Verify token by hitting a protected endpoint
      const res = await fetch('/admin/api/logs', {
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
      });

      if (res.status === 401) {
        document.getElementById('loginError').style.display = 'block';
        return;
      }

      document.getElementById('loginError').style.display = 'none';
      sessionStorage.setItem(TOKEN_KEY, token);
      showDashboard();
    }

    function logout() {
      sessionStorage.removeItem(TOKEN_KEY);
      showLogin();
    }

    function formatDate(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    }

    async function fetchSeniors() {
      try {
        const res = await fetch('/admin/api/seniors', { headers: apiHeaders() });
        if (res.status === 401) { showLogin(); return; }
        const data = await res.json();
        if (!data.success) return;

        const tbody = document.getElementById('seniorBody');
        const countEl = document.getElementById('seniorCount');

        if (!data.seniors || data.seniors.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" class="empty">No active seniors</td></tr>';
          countEl.textContent = '0 enrolled';
          return;
        }

        countEl.textContent = data.seniors.length + ' enrolled';
        tbody.innerHTML = data.seniors.map(s =>
          '<tr>' +
          '<td><strong>' + esc(s.name || '—') + '</strong></td>' +
          '<td>' + (s.phone_number || '—') + '</td>' +
          '<td><span class="badge ' + (s.language === 'es' ? 'reminder' : 'sent') + '">' + (s.language || '—').toUpperCase() + '</span></td>' +
          '</tr>'
        ).join('');
      } catch (err) {
        console.error('Failed to fetch seniors:', err);
      }
    }

    async function fetchLogs() {
      try {
        const res = await fetch('/admin/api/logs', { headers: apiHeaders() });
        if (res.status === 401) { showLogin(); return; }
        const data = await res.json();
        if (!data.success) return;

        const tbody = document.getElementById('logBody');
        if (!data.logs || data.logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" class="empty">No messages yet</td></tr>';
          return;
        }

        tbody.innerHTML = data.logs.map(log => {
          const senior = log.seniors || {};
          const video = log.videos || {};
          const logType = log.type || 'video';
          return '<tr>' +
            '<td><strong>' + esc(senior.name || 'Unknown') + '</strong><br><small>' + (senior.phone_number || '') + ' · ' + (senior.language || '').toUpperCase() + '</small></td>' +
            '<td>' + (video.title || '—') + '</td>' +
            '<td><span class="badge ' + logType + '">' + logType + '</span></td>' +
            '<td>' + formatDate(log.sent_at) + '</td>' +
            '<td><span class="badge ' + (log.status || '') + '">' + (log.status || '—') + '</span></td>' +
            '<td class="reply-text">' + (log.reply_text ? esc(log.reply_text) : '—') + '</td>' +
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

    async function processReplyAction() {
      const btn = document.getElementById('processReplyBtn');
      const msg = document.getElementById('statusMsg');

      const phoneNumber = prompt('Enter senior phone number (e.g. +13055629885):');
      if (!phoneNumber) return;

      const replyText = prompt('Enter the reply text (e.g. "Done"):');
      if (!replyText) return;

      btn.disabled = true;
      btn.textContent = 'Processing...';
      msg.textContent = '';
      msg.className = 'status-msg';

      try {
        const res = await fetch('/admin/api/process-reply', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ phoneNumber: phoneNumber.trim(), replyText: replyText.trim() })
        });
        const data = await res.json();

        if (data.success) {
          msg.textContent = 'Reply processed' + (data.completed ? ' — marked as completed!' : '');
          msg.className = 'status-msg success';
          setTimeout(fetchLogs, 1000);
        } else {
          msg.textContent = 'Failed: ' + (data.error || 'Unknown error');
          msg.className = 'status-msg error';
        }
      } catch (err) {
        msg.textContent = 'Error: ' + err.message;
        msg.className = 'status-msg error';
      }

      btn.disabled = false;
      btn.textContent = 'Process Reply';
    }

    async function addSeniorAction() {
      const btn = document.getElementById('addSeniorBtn');
      const status = document.getElementById('addSeniorStatus');
      const name = document.getElementById('newName').value.trim();
      const phone = document.getElementById('newPhone').value.trim();
      const language = document.getElementById('newLanguage').value;

      if (!name || !phone) {
        status.textContent = 'Name and phone are required.';
        status.className = 'status-msg error';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Adding...';
      status.textContent = '';
      status.className = 'status-msg';

      try {
        const res = await fetch('/admin/api/seniors', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ name, phone, language })
        });
        const data = await res.json();

        if (data.success) {
          status.textContent = data.welcomeSent
            ? name + ' added and welcome message sent!'
            : name + ' added. (Welcome template not yet configured — message not sent)';
          status.className = 'status-msg success';
          document.getElementById('newName').value = '';
          document.getElementById('newPhone').value = '';
          document.getElementById('newLanguage').value = 'en';
          fetchSeniors();
        } else {
          status.textContent = 'Failed: ' + (data.error || 'Unknown error');
          status.className = 'status-msg error';
        }
      } catch (err) {
        status.textContent = 'Error: ' + err.message;
        status.className = 'status-msg error';
      }

      btn.disabled = false;
      btn.textContent = 'Add & Send Welcome';
    }

    // Init: check for existing session
    if (getToken()) {
      showDashboard();
    } else {
      showLogin();
    }

    setInterval(() => {
      if (getToken()) { fetchSeniors(); fetchLogs(); }
    }, 30000);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}
