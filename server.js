const express = require('express');
const app = express();
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Хранилище (в памяти)
const users = {};
const chats = {};
const messages = {};

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

// Получить список чатов пользователя
app.get('/chats/:username', (req, res) => {
  const { username } = req.params;
  if (!users[username]) return res.status(404).json({ error: 'Пользователь не найден' });
  const userChats = users[username].chats.map(id => ({ id, ...chats[id] }));
  res.json(userChats);
});

// Отправить сообщение
app.post('/messages', (req, res) => {
  const { chatId, sender, text } = req.body;
  if (!chats[chatId]) return res.status(404).json({ error: 'Чат не найден' });
  const msg = { sender, text, time: new Date().toISOString() };
  messages[chatId].push(msg);
  res.json(msg);
});

// Получить сообщения чата
app.get('/messages/:chatId', (req, res) => {
  const { chatId } = req.params;
  if (!chats[chatId]) return res.status(404).json({ error: 'Чат не найден' });
  res.json(messages[chatId] || []);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
