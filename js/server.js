const express = require('express'); // создание сервера и API

const { Pool } = require('pg'); //подключение к БД

const cors = require('cors'); // позволяет фронтенду обращаться к API

const bodyParser = require('body-parser'); // преобразование JSON из запросов в JavaScript объекты

// path - встроенный модуль Node.js для работы с путями к файлам
const path = require('path');

// dotenv - загружает переменные окружения из файла .env Используется для хранения секретных данных
require('dotenv').config();


/* ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ */
// Создаем экземпляр Express приложения
const app = express();

// Определяем порт для сервера
// Используем переменную окружения PORT (для хостинга) или 3000 по умолчанию (для локальной разработки)
const PORT = process.env.PORT || 3000;


const getConnectionString = () => 
    {
    // Получаем строку подключения из переменных окружения
    const rawUrl = process.env.DATABASE_URL || process.env.database_url; // Проверяем оба варианта написания (DATABASE_URL и database_url) для совместимости
    
    // Если строка подключения не найдена, выводим ошибку и возвращаем null 
    if (!rawUrl) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА: DATABASE_URL не найдена!');
        return null;
    }

    // Вывод логов для диагностики
    console.log('RAW DATABASE_URL length:', rawUrl.length);
    console.log('RAW DATABASE_URL starts with:', rawUrl.substring(0, 15));

    // Убираем пробелы в начале и конце строки
    let cleanUrl = rawUrl.trim();
    

    const pgMatch = cleanUrl.match(/postgresql?:\/\/[^\s]+/); // поиск ссылки на базу данных, для избежания ошибок
    if (pgMatch) 
        {
        // Если нашли совпадение, используем только эту часть
        cleanUrl = pgMatch[0];
    }


    cleanUrl = cleanUrl.replace(/['";]/g, ''); //удаление лишних знаков от хостинга для избежания ошибок в загрузке БД

    //проверка
    console.log('CLEAN DATABASE_URL ends with:', cleanUrl.substring(cleanUrl.length - 10));
    
    
    return cleanUrl; // возвращение очищенной строки подключения
};


/*Настройка подключения БД*/
// Получаем очищенную строку подключения
const connectionString = getConnectionString();

// Создаем пул соединений с PostgreSQL
// Pool управляет несколькими подключениями к БД для повышения производительности
const pool = new Pool(
    {
    connectionString: connectionString, // Строка подключения к базе данных
    ssl: connectionString ? { rejectUnauthorized: false } : false //безопасное подключение к БД именно для Neon
});

// Проверка подключения к базе данных при запуске сервера
pool.connect((err, client, release) => {
    // Если произошла ошибка подключения, выводим её в консоль
    if (err) {
        return console.error('Ошибка подключения к базе Neon:', err.stack);
    }
    // Если подключение успешно, выводим сообщение
    console.log('Успешное тестовое подключение к Neon PostgreSQL!');
    // освобождение клиента обратно в пул
    release();
});



// Включаем CORS для всех маршрутов
// Это позволяет фронтенду на любом домене делать запросы к нашему API
app.use(cors());

// Настраиваем парсинг JSON из тела запросов
app.use(bodyParser.json()); //автоматическое преобразование в объект


app.use(express.static(path.resolve(__dirname, '../'))); //доступ к файлам из корневой папки


/*функция для создания БД*/
const initDb = async () => 
    {
    try 
    {
        // Выполняем SQL запрос для создания таблиц
        await pool.query(`
            -- Таблица пользователей
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,              -- Автоинкрементный уникальный ID
                username TEXT NOT NULL UNIQUE,     -- Имя пользователя (обязательно, уникально)
                password TEXT NOT NULL             -- Пароль (обязательно, хранится в открытом виде - небезопасно для продакшена!)
            );
            
            -- Таблица корзины покупок
            CREATE TABLE IF NOT EXISTS cart (
                id SERIAL PRIMARY KEY,             -- Автоинкрементный уникальный ID товара в корзине
                user_id INTEGER,                    -- ID пользователя, которому принадлежит товар
                product_name TEXT NOT NULL,         -- Название товара (обязательно)
                price TEXT,                         -- Цена товара (хранится как текст для форматирования)
                image_url TEXT                      -- URL изображения товара
            );
        `);
        console.log('Облачная база данных PostgreSQL готова!'); //вывод успеха
    } 
    catch (err) 
    {
        // Если произошла ошибка при создании таблиц, выводим её в консоль
        console.error('Ошибка инициализации БД:', err);
    }
};


initDb(); //при запуске сервера инцилизируем БД


/*проверка уникальности имени перед созданием*/
app.post('/register', async (req, res) => {
    // Извлекаем данные из тела запроса (JSON)
    const { username, password } = req.body;
    
    // Валидация данных - проверяем, что все обязательные поля заполнены
    if (!username || !password) {
        // Возвращаем ошибку 400 (Bad Request) с сообщением
        return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }
    
    try {
        //проверка наличия пользователя с таким же именем
        const checkUser = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username] // Передаем username как параметр
        );
        
        // Если нашли хотя бы одну строку, значит пользователь уже существует
        if (checkUser.rows.length > 0) {
            // ошибка
            return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
        }
        
        // Если пользователя нет, создаем нового
        // RETURNING id - возвращает ID созданного пользователя
        const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
            [username, password] // передача параметров
        );
        
        //Возвращение новых данных пользователя
        res.json({ id: result.rows[0].id, username: username });
    } catch (err) {
        // Обработка ошибок
        console.error('Ошибка при регистрации:', err);
        
        //обработка ошибок
        if (err.code === '23505' || err.message.includes('duplicate') || err.message.includes('unique')) {
            return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
        }
        
        // Общее сообщение об ошибке для иных случаев
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

app.post('/login', async (req, res) => {
    // Извлекаем данные из тела запроса
    const { username, password } = req.body;
    
    // проверка обязательных полей
    if (!username || !password) {
        return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }
    
    try {
        // Ищем пользователя с совпадающим логином И паролем
        // Используем параметризованный запрос для безопасности
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND password = $2',
            [username, password] // Передаем оба параметра
        );
        
        // Если не нашли ни одной строки, значит логин или пароль неверны
        if (result.rows.length === 0) {
            // Возвращаем ошибку 404 с сообщением
            return res.status(404).json({ error: 'Неверный логин или пароль' });
        }
        
        // Если нашли пользователя, возвращаем его данные
        res.json(result.rows[0]);
    } catch (err) {
        // Обработка ошибок базы данных
        console.error('Ошибка при входе:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// База данных для корзины
app.post('/cart/add', async (req, res) => {
    // Извлекаем данные о товаре из тела запроса
    const { user_id, product_name, price, image_url } = req.body;
    
    
    
    if (!user_id || !product_name) { //проверка обязательных полей
        return res.status(400).json({ error: 'Отсутствуют обязательные поля' });
    }
    
    try {
        const result = await pool.query( //присвоение полей
            'INSERT INTO cart (user_id, product_name, price, image_url) VALUES ($1, $2, $3, $4) RETURNING id',
            [user_id, product_name, price, image_url] // передача всех полей
        );
        
        res.json({ id: result.rows[0].id }); //возвращение id добавленного товара
    } catch (err) {
        // Обработка ошибок
        console.error('Ошибка при добавлении в корзину:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

app.get('/cart/:user_id', async (req, res) => { //получение всех товаров из корзины пользователя
    try {
        const result = await pool.query( //получение id пользователя
            'SELECT * FROM cart WHERE user_id = $1', //поиск всех товаров из корзины данного пользователя
            [req.params.user_id] // передача параметров
        );
        
        // Возвращаем массив всех найденных товаров
        // Если корзина пуста, вернется пустой массив []
        res.json(result.rows);
    }
     catch (err) {
        // Обработка ошибок
        console.error('Ошибка при получении корзины:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

app.delete('/cart/delete/:id', async (req, res) => { //удаление товара из корзины
    try {
        const result = await pool.query( // удаление товара по его ID
            'DELETE FROM cart WHERE id = $1', 
            [req.params.id] // Безопасная передача параметра
        );
        
        // Проверяем, была ли удалена хотя бы одна строка
        // rowCount показывает количество затронутых строк
        if (result.rowCount === 0) {
            // Если ничего не удалили, значит товар с таким ID не существует
            return res.status(404).json({ error: 'Товар не найден в корзине' });
        }
        
        // Если удаление прошло успешно, возвращаем подтверждение
        res.json({ success: true });
    } catch (err) {
        // Обработка ошибок
        console.error('Ошибка при удалении из корзины:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});


/*Запуск сервера*/
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
