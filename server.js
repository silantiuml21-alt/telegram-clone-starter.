const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer');
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const users = {};
const messages = {};
const chats = {};

// === API ===
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Введите логин и пароль' });
  if (users[username]) return res.status(400).json({ error: 'Такой пользователь уже есть' });
  users[username] = { password, chats: [] };
  res.json({ success: true, message: 'Вы зарегистрированы!' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!users[username] || users[username].password !== password) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  res.json({ success: true, message: 'Добро пожаловать!' });
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  res.json({ fileUrl: `/uploads/${req.file.filename}` });
});

app.post('/chats', (req, res) => {
  const { name, creator } = req.body;
  if (!name || !creator) return res.status(400).json({ error: 'Укажите название и создателя' });
  const chatId = Date.now().toString();
  chats[chatId] = { name, creator, users: [creator] };
  messages[chatId] = [];
  users[creator].chats.push(chatId);
  res.json({ chatId, chat: chats[chatId] });
});

app.get('/chats/:username', (req, res) => {
  const { username } = req.params;
  if (!users[username]) return res.status(404).json({ error: 'Пользователь не найден' });
  const userChats = users[username].chats.map(id => ({ id, ...chats[id] }));
  res.json(userChats);
});

app.post('/messages', (req, res) => {
  const { chatId, sender, text, fileUrl } = req.body;
  if (!chats[chatId]) return res.status(404).json({ error: 'Чат не найден' });
  const msg = { sender, text, fileUrl: fileUrl || null, timestamp: new Date().toISOString() };
  messages[chatId].push(msg);
  res.json(msg);
});

app.get('/messages/:chatId', (req, res) => {
  const { chatId } = req.params;
  if (!chats[chatId]) return res.status(404).json({ error: 'Чат не найден' });
  res.json(messages[chatId] || []);
});

// === НОВЫЕ РОУТЫ ДЛЯ РЕДАКТИРОВАНИЯ И УДАЛЕНИЯ ===
app.delete('/messages/:chatId/:msgId', (req, res) => {
  const { chatId, msgId } = req.params;
  const index = parseInt(msgId);
  if (!messages[chatId] || index >= messages[chatId].length) {
    return res.status(404).json({ error: 'Сообщение не найдено' });
  }
  messages[chatId].splice(index, 1);
  res.json({ success: true });
});

app.put('/messages/:chatId/:msgId', (req, res) => {
  const { chatId, msgId } = req.params;
  const { text } = req.body;
  const index = parseInt(msgId);
  if (!messages[chatId] || index >= messages[chatId].length) {
    return res.status(404).json({ error: 'Сообщение не найдено' });
  }
  messages[chatId][index].text = text;
  res.json({ success: true, message: messages[chatId][index] });
});

// === WEBSOCKET ===
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'typing') {
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'typing', user: data.user }));
          }
        });
      }
    } catch (e) {
      console.error('WebSocket error:', e);
    }
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
