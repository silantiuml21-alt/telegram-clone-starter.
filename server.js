const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer');
const WebSocket = require('ws');
const http = require('http');

// Создаём сервер для WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Настройка multer для загрузки файлов
const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Раздаём загруженные файлы
app.use('/uploads', express.static('uploads'));

// Хранилище пользователей и сообщений (в памяти)
const users = {};
const messages = {};

// === ОБРАБОТЧИКИ API ===

// Регистрация
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Введите логин и пароль' });
  if (users[username]) return res.status(400).json({ error: 'Такой пользователь уже есть' });
  users[username] = { password, chats: [] };
  res.json({ success: true, message: 'Вы зарегистрированы!' });
});

// Вход
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!users[username] || users[username].password !== password) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  res.json({ success: true, message: 'Добро пожаловать!' });
});

// Загрузка файлов
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ fileUrl });
});

// Создать чат
app.post('/chats', (req, res) => {
  const { name, creator } = req.body;
  if (!name || !creator) return res.status(400).json({ error: 'Укажите название и создателя' });
  const chatId = Date.now().toString();
  chats[chatId] = { name, creator, users: [creator] };
  messages[chatId] = [];
  users[creator].chats.push(chatId);
  res.json({ chatId, chat: chats[chatId] });
});

// Получить список чатов
app.get('/chats/:username', (req, res) => {
  const { username } = req.params;
  if (!users[username]) return res.status(404).json({ error: 'Пользователь не найден' });
  const userChats = users[username].chats.map(id => ({ id, ...chats[id] }));
  res.json(userChats);
});

// Отправить сообщение
app.post('/messages', (req, res) => {
  const { chatId, sender, text, fileUrl } = req.body;
  if (!chats[chatId]) return res.status(404).json({ error: 'Чат не найден' });
  const msg = { 
    sender, 
    text, 
    fileUrl: fileUrl || null,
    timestamp: new Date().toISOString()
  };
  messages[chatId].push(msg);
  res.json(msg);
});

// Получить сообщения чата
app.get('/messages/:chatId', (req, res) => {
  const { chatId } = req.params;
  if (!chats[chatId]) return res.status(404).json({ error: 'Чат не найден' });
  res.json(messages[chatId] || []);
});

// === WEBSOCKET ДЛЯ ИНДИКАТОРА ПЕЧАТИ ===
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'typing') {
        // Отправляем всем, кроме отправителя
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'typing',
              user: data.user
            }));
          }
        });
      }
    } catch (e) {
      console.error('WebSocket error:', e);
    }
  });
});

// Отдаём index.html для любых других запросов
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
