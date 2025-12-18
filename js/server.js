const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Раздача статических файлов (теперь сервер будет показывать сайт)
app.use(express.static(path.resolve(__dirname, '../')));

const dbPath = path.resolve(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Ошибка открытия БД:', err.message);
    else console.log('База данных SQLite подключена!');
});

db.serialize(() => {
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password TEXT NOT NULL
    )`);

    // Таблица корзины (добавили image_url)
    db.run(`CREATE TABLE IF NOT EXISTS cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_name TEXT NOT NULL,
        price TEXT,
        image_url TEXT, 
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Неверный логин или пароль' });
        res.json(row);
    });
});

// Добавление в корзину (теперь с картинкой)
app.post('/cart/add', (req, res) => {
    const { user_id, product_name, price, image_url } = req.body;
    const sql = 'INSERT INTO cart (user_id, product_name, price, image_url) VALUES (?, ?, ?, ?)';
    db.run(sql, [user_id, product_name, price, image_url], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

app.get('/cart/:user_id', (req, res) => {
    db.all('SELECT * FROM cart WHERE user_id = ?', [req.params.user_id], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(rows);
    });
});

// Удаление из корзины
app.delete('/cart/delete/:id', (req, res) => {
    db.run('DELETE FROM cart WHERE id = ?', req.params.id, function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ success: true });
    });
});

app.listen(PORT, () => console.log(`Сервер: http://localhost:${PORT}`));