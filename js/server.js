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
    const rawUrl = process.env.DATABASE_URL || process.env.database_url;
    
    if (!rawUrl) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА: DATABASE_URL не найдена!');
        return null;
    }

    // Выводим в логи (безопасно) для диагностики
    console.log('RAW DATABASE_URL length:', rawUrl.length);
    console.log('RAW DATABASE_URL starts with:', rawUrl.substring(0, 15));

    let cleanUrl = rawUrl.trim();
    
    // Если в начале есть мусор (типа "base = "), отрезаем его
    const pgMatch = cleanUrl.match(/postgresql?:\/\/[^\s]+/);
    if (pgMatch) {
        cleanUrl = pgMatch[0];
    }

    // Убираем кавычки
    cleanUrl = cleanUrl.replace(/['";]/g, '');

    console.log('CLEAN DATABASE_URL ends with:', cleanUrl.substring(cleanUrl.length - 10));
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
                username TEXT NOT NULL UNIQUE,
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
    
    // Валидация данных
    if (!username || !password) {
        return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }
    
    try {
        // Сначала проверяем, существует ли пользователь с таким именем
        const checkUser = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );
        
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
        }
        
        // Если пользователя нет, создаем нового
        const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
            [username, password]
        );
        res.json({ id: result.rows[0].id, username: username });
    } catch (err) {
        console.error('Ошибка при регистрации:', err);
        // Дополнительная проверка на случай, если UNIQUE ограничение все равно сработает
        if (err.code === '23505' || err.message.includes('duplicate') || err.message.includes('unique')) {
            return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
        }
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Логин
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Валидация данных
    if (!username || !password) {
        return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }
    
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
        console.error('Ошибка при входе:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Добавление в корзину
app.post('/cart/add', async (req, res) => {
    const { user_id, product_name, price, image_url } = req.body;
    
    // Валидация данных
    if (!user_id || !product_name) {
        return res.status(400).json({ error: 'Отсутствуют обязательные поля' });
    }
    
    try {
        const result = await pool.query(
            'INSERT INTO cart (user_id, product_name, price, image_url) VALUES ($1, $2, $3, $4) RETURNING id',
            [user_id, product_name, price, image_url]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        console.error('Ошибка при добавлении в корзину:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение корзины
app.get('/cart/:user_id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cart WHERE user_id = $1', [req.params.user_id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении корзины:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Удаление из корзины
app.delete('/cart/delete/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM cart WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Товар не найден в корзине' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка при удалении из корзины:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
