const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка подключения к PostgreSQL
const getConnectionString = () => {
    // Пробуем разные варианты написания (на случай опечаток в Render)
    const rawUrl = process.env.DATABASE_URL || process.env.database_url || process.env.Database_Url;
    
    if (!rawUrl) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА: Переменная DATABASE_URL не найдена в окружении!');
        return null;
    }

    console.log('DATABASE_URL найдена. Длина:', rawUrl.length);

    // Очистка строки
    let cleanUrl = rawUrl.trim();
    
    // Если строка начинается не с postgres, пробуем найти начало ссылки
    if (!cleanUrl.startsWith('postgres')) {
        const index = cleanUrl.indexOf('postgres');
        if (index !== -1) {
            cleanUrl = cleanUrl.substring(index);
        }
    }

    // Убираем всё после первого пробела, кавычки и точки с запятой
    cleanUrl = cleanUrl.split(/\s+/)[0].replace(/['";]/g, '');

    // Финальная проверка
    if (!cleanUrl.startsWith('postgres')) {
        console.error('ОШИБКА: DATABASE_URL имеет неверный формат:', cleanUrl.substring(0, 20) + '...');
        return null;
    }

    return cleanUrl;
};

const connectionString = getConnectionString();

const pool = new Pool({
    connectionString: connectionString,
    ssl: connectionString ? { rejectUnauthorized: false } : false
});

// Проверка подключения
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Ошибка подключения к базе Neon:', err.stack);
    }
    console.log('Успешное тестовое подключение к Neon PostgreSQL!');
    release();
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.resolve(__dirname, '../')));

// Создание таблиц при запуске (если их нет)
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                password TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS cart (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                product_name TEXT NOT NULL,
                price TEXT,
                image_url TEXT
            );
        `);
        console.log('Облачная база данных PostgreSQL готова!');
    } catch (err) {
        console.error('Ошибка инициализации БД:', err);
    }
};

initDb();

// Регистрация
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
            [username, password]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Логин
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND password = $2',
            [username, password]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Неверный логин или пароль' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Добавление в корзину
app.post('/cart/add', async (req, res) => {
    const { user_id, product_name, price, image_url } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO cart (user_id, product_name, price, image_url) VALUES ($1, $2, $3, $4) RETURNING id',
            [user_id, product_name, price, image_url]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Получение корзины
app.get('/cart/:user_id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cart WHERE user_id = $1', [req.params.user_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Удаление из корзины
app.delete('/cart/delete/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM cart WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
