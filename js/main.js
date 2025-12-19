const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') // Если localhost или 127.0.0.1 → используем localhost:3000 (или пустую строку, если порт уже 3000)
    ? (window.location.port === '3000' ? '' : 'http://localhost:3000') // Если открыт файл напрямую (file://) → используем localhost:3000
    : (window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin);// иначе используем текущий origin (для хостинга типа Render.com)


console.log('API_URL set to:', API_URL || 'Local server mode (port 3000)'); // вывод в консоль

document.addEventListener('DOMContentLoaded', function() { 
    const popUp = document.getElementById('pop_up'); // Pop up для входа/регистрации
    const cartPopUp = document.getElementById('cart_pop_up'); // Pop up корзины
    const cartItemsList = document.getElementById('cart-items-list'); // Список товаров в корзине

    async function updateUI() {
        // Получаем данные пользователя из локального хранилища браузера
        const userId = localStorage.getItem('userId'); // ID пользователя в базе данных
        const currentUser = localStorage.getItem('currentUser'); // Имя пользователя

        console.log('Updating UI for user:', currentUser, 'ID:', userId); // Вывод сообщение в консоль в браузере

        /*Скрипт для показа интерфейса для авторизированого и не авторизированого пользователя*/
        document.querySelectorAll('.guest-only').forEach(el => el.style.display = currentUser ? 'none' : 'inline-block'); //для неавторизированого
        document.querySelectorAll('.user-only').forEach(el => el.style.display = currentUser ? 'inline-block' : 'none'); //для авторизированого
        
        // Отоброжения имени пользователя в шапке сайта
        const nameDisplay = document.getElementById('user-name-display');
        if (currentUser && nameDisplay) nameDisplay.textContent = currentUser;

        // Если пользователь авторизован, загружаем его корзину
        if (userId) 
            {
            try 
            {
                // Отправляем GET запрос на сервер для получения корзины пользователя
                const res = await fetch(`${API_URL}/cart/${userId}`);
                
                // Проверяем статус ответа сервера
                if (!res.ok) 
                    {
                    /*Обработка ошибок*/
                    let errorMessage = 'Ошибка сервера';
                    if (res.status === 404) 
                        {
                        errorMessage = 'Корзина не найдена';
                    } 
                    else if (res.status === 500) {
                        errorMessage = 'Внутренняя ошибка сервера';
                    } 
                    else if (res.status === 400) {
                        errorMessage = 'Неверный запрос';
                    }
                    throw new Error(errorMessage);
                }
                
                const items = await res.json(); //запрос массива товаров
                
                // Обновление счетчика товаров в иконке карзины
                const badge = document.getElementById('cart-count');
                if (badge) badge.textContent = items.length;

                // Если элемент списка корзины существует, заполняем его
                if (cartItemsList) 
                    {
                    // Очищаем предыдущее содержимое
                    cartItemsList.innerHTML = '';
                    let total = 0; // Переменная для подсчета общей суммы
                    
                    // Если корзина пуста, показываем сообщение
                    if (items.length === 0) 
                        {
                        cartItemsList.innerHTML = '<p style="text-align:center; padding:20px;">Корзина пуста</p>';
                    } 
                    else 
                    {
                        // перебор каждого товара в корзине
                        items.forEach(item => 
                            {
                            // Очитска цен от всего кроме цифр (для корзины)
                            const cleanPrice = item.price.toString().replace(/[^\d]/g, '');
                            // Преобразуем строку в число, если не получилось - используем 0
                            const priceNum = parseInt(cleanPrice) || 0;
                            // добавление цены товара к общей сумме
                            total += priceNum;

                            // формотирование цены
                            const formattedPrice = priceNum.toLocaleString('ru-RU') + ' ₽';

                            // создание html элемента для товаров
                            const itemDiv = document.createElement('div');
                            itemDiv.className = 'cart-item';
                            // Заполняем HTML с информацией о товаре
                            itemDiv.innerHTML = `
                                <div style="display:flex; align-items:center; gap:15px;">
                                    <img src="${item.image_url}" style="width:60px; height:60px; object-fit:contain; border-radius:5px;">
                                    <div>
                                        <h4 style="margin:0; font-size:16px;">${item.product_name}</h4>
                                        <p style="margin:5px 0 0 0; color:#1E90FF; font-weight:bold;">${formattedPrice}</p>
                                    </div>
                                </div>
                                <button class="delete-item" data-id="${item.id}">Удалить</button>
                            `;
                            // Добавление товара в список
                            cartItemsList.appendChild(itemDiv);
                        });
                    }
                    
                    // Обновляем общую сумму в корзине
                    const totalEl = document.getElementById('cart-total-price');
                    if (totalEl) {
                        // Форматируем общую сумму с разделителями тысяч
                        totalEl.textContent = total.toLocaleString('ru-RU');
                    }
                }
            } 
            catch (e) 
            { 
                // Обработка ошибок при загрузке корзины
                console.error('Ошибка связи с сервером в updateUI:', e);
                // Показываем пользователю сообщение только для критических ошибок
                if (e.message.includes('500') || e.message.includes('Внутренняя ошибка')) {
                    console.warn('Критическая ошибка сервера при загрузке корзины');
                }
            }
        }
    }

    /*Вызов функции обновления интерфейса при загрузке страницы*/
    updateUI();


    document.addEventListener('click', async (e) => 
        {
        //удаление товара из корзины
        if (e.target.classList.contains('delete-item')) 
            {
            //предотвращение стандартонго поведения событий
            e.preventDefault();
            e.stopPropagation(); 
            
            //получение ID товара
            const id = e.target.dataset.id;
            
            try {
                // Отправка DELETE запроса на сервер для удаления товара
                const res = await fetch(`${API_URL}/cart/delete/${id}`, { method: 'DELETE' });
                
                // Проверка успешность операции
                if (!res.ok) {
                    // Определение сообщения об ошибке в зависимости от статуса
                    let errorMessage = 'Ошибка при удалении';
                    if (res.status === 404) {
                        errorMessage = 'Товар не найден в корзине';
                    } else if (res.status === 500) {
                        errorMessage = 'Ошибка сервера при удалении';
                    } else if (res.status === 400) {
                        errorMessage = 'Неверный запрос на удаление';
                    }
                    throw new Error(errorMessage);
                }
                
                // После успешного удаления обновляем интерфейс
                await updateUI();
            } catch (err) {
                // Обработка ошибок
                console.error('Ошибка при удалении:', err);
                alert('Ошибка: ' + err.message);
            }
            return; // Прерываем дальнейшую обработку
        }

        /**открытие коризны */
        if (e.target.closest('.cart-link')) { //проверка налчиия клика
            e.preventDefault();
            if (cartPopUp) {
                // Добавляем класс 'active' для показа окна
                cartPopUp.classList.add('active');
                // Обновляем содержимое корзины перед показом
                updateUI();
            }
            return;
        }

        // --- КНОПКА "КУПИТЬ" В КОРЗИНЕ ---
        if (e.target.id === 'cart-buy-btn' || e.target.classList.contains('cart-buy-btn')) {
            e.preventDefault();
            // Показываем сообщение о том, что функция пока не реализована
            alert('Когда-нибудь эта функция появится');
            return;
        }
 
        // --- КНОПКИ ЗАКРЫТИЯ ПОПАПОВ (КРЕСТИКИ) ---
        // Закрываем попап при клике на кнопку закрытия
        if (e.target.classList.contains('pop_up_close') || e.target.id === 'cart_pop_up_close') {
            // Находим ближайший родительский попап
            const currentPop = e.target.closest('.pop_up');
            if (currentPop) {
                // Убираем класс 'active' для скрытия попапа
                currentPop.classList.remove('active');
            }
            return;
        }

        // Проверяем, была ли нажата кнопка "В корзину" или "Купить"
        if (e.target.classList.contains('add-to-cart') || (e.target.classList.contains('btn') && e.target.textContent === 'Купить')) {
            e.preventDefault();
            
            // Проверяем, авторизован ли пользователь
            const userId = localStorage.getItem('userId');
            if (!userId) { 
                // Если не авторизован, показываем popup входа/регистрации
                popUp && popUp.classList.add('active'); 
                return; 
            }
            
            // Находим карточку товара 
            const card = e.target.closest('.product-card') || e.target.closest('.product-detail') || document.body;
            
            // Поиск названия товара
            const nameEl = card.querySelector('h3') || card.querySelector('h1');
            const name = nameEl ? nameEl.textContent.trim() : 'Товар';
            
            // Поиск цены товара
            let priceText = '';
            const priceEl = card.querySelector('.product-price');
            if (priceEl) {
                priceText = priceEl.textContent;
            } else {
                // Если класса нет (на странице товара), ищем любой элемент, содержащий символ ₽
                const allElements = card.querySelectorAll('li, p, span');
                for (let el of allElements) {
                    if (el.textContent.includes('₽')) {
                        priceText = el.textContent;
                        break; // Прерываем поиск после первого найденного
                    }
                }
            }

            // Очистка цены от символов (для корзирны)
            const cleanPrice = priceText.replace(/[^\d]/g, '');
            // Разделние цены на тысячи, сотни и т.п.
            const finalPrice = cleanPrice ? parseInt(cleanPrice).toLocaleString('ru-RU') + ' ₽' : '0 ₽';

            // Поиск изображения
            const imgEl = card.querySelector('img:not(.logo):not(.cutehom):not(.footer-logo)'); //кроме лого, футера и т.п.
            const img = imgEl ? imgEl.src : '';

            try {
                // Отправляем POST запрос на сервер для добавления товара в корзину
                const res = await fetch(`${API_URL}/cart/add`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'}, //Флаг отправки
                    body: JSON.stringify({
                        user_id: userId,      // ID пользователя
                        product_name: name,   // Название товара
                        price: finalPrice,    // Цена (отформатированная)
                        image_url: img        // URL изображения товара
                    })
                });
                
                // Проверка успешности выполнения
                if (!res.ok) {
                    // Определяем конкретное сообщение об ошибке
                    let errorMessage = 'Ошибка при добавлении в корзину';
                    if (res.status === 404) {
                        errorMessage = 'Сервис корзины недоступен';
                    } else if (res.status === 500) {
                        errorMessage = 'Ошибка сервера при добавлении товара';
                    } else if (res.status === 400) {
                        errorMessage = 'Неверные данные товара';
                    } else if (res.status === 401) {
                        errorMessage = 'Необходима авторизация';
                    }
                    throw new Error(errorMessage);
                }
                
                // После успешного добавления обновляем интерфейс (счетчик, список)
                updateUI();
                // Убрали alert('Добавлено в корзину!'); - теперь обновление происходит без уведомления
            } catch (err) {
                // Обработка ошибок
                console.error('Ошибка при добавлении:', err);
                alert('Ошибка: ' + err.message);
            }
        }

        // Проверка, нажата ли была кнопка регистрации
        if (e.target.id === 'open_pop_up' || e.target.id === 'open_register_pop_up' || e.target.classList.contains('switch-to-register') || e.target.classList.contains('switch-to-login')) {
            e.preventDefault();
            
            // Показ popup
            popUp.classList.add('active');
            
            // Определение, какую форму нужно показать (вход или регистрация)
            const isLogin = e.target.id === 'open_pop_up' || e.target.classList.contains('switch-to-login');
            
            // Получаем ссылки на формы
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            
            // Переключаем видимость форм в зависимости от того, что нужно показать
            if (loginForm) loginForm.classList.toggle('active', isLogin);
            if (registerForm) registerForm.classList.toggle('active', !isLogin);
        }
    });

    /**
     * Обработчик закрытия попапов при клике на затемненный фон
     * Работает отдельно от основного обработчика для надежности
     * Закрывает попап только если клик был именно по фону (не по содержимому)
     */
    document.querySelectorAll('.pop_up').forEach(p => { //закрытия popup при нажатии в обасти вне его
        p.addEventListener('click', (e) => {
            // проверка куда производится клик
            if (e.target === p) {
                // Скрываем popup
                p.classList.remove('active');
            }
        });
    });


    //Формы авторизаций
    const auth = (id, type) => {
        // Получаем форму по ID
        const f = document.getElementById(id);
        
        // Если форма найдена, настраиваем обработчик отправки
        if (f) f.onsubmit = async (ev) => {
            // Предотвращаем стандартную отправку формы (перезагрузку страницы)
            ev.preventDefault();
            
            // Получаем все поля ввода из формы
            const inputs = f.querySelectorAll('input');
            console.log(`Attempting ${type} for:`, inputs[0].value);
            
            try {
                // Отправляем POST запрос на сервер
                const res = await fetch(`${API_URL}/${type}`, { 
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'}, 
                    // Отправляем логин (первое поле) и пароль (второе поле)
                    body: JSON.stringify({username: inputs[0].value, password: inputs[1].value}) 
                });
                
                // Проверяем успешность операции
                if (!res.ok) {
                    let errorMessage = 'Ошибка при авторизации';
                    
                    // Получение сообщение об ошибке
                    if (res.status === 404) {
                        errorMessage = 'Пользователь не найден';
                    } else if (res.status === 500) {
                        errorMessage = 'Внутренняя ошибка сервера';
                    } else if (res.status === 400) {
                        // Детальное сообщнение об ошибке
                        try {
                            const errorData = await res.json();
                            errorMessage = errorData.error || 'Неверные данные';
                        } catch {
                            errorMessage = 'Неверный запрос';
                        }
                    } else if (res.status === 401) {
                        errorMessage = 'Неверный логин или пароль';
                    } else if (res.status === 403) {
                        errorMessage = 'Доступ запрещен';
                    }
                    
                    console.error('Server error:', res.status, errorMessage);
                    throw new Error(errorMessage);
                }

                // Ждем успешного ответа от сервера
                const data = await res.json();
                console.log(`${type} success:`, data);
                
                // Сохраняем данные пользователя в локальное хранилище браузера
                localStorage.setItem('currentUser', data.username || inputs[0].value); 
                localStorage.setItem('userId', data.id); 
                
                // Перезагружаем страницу для обновления интерфейса
                location.reload(); 
            } catch (err) {
                // Обработка ошибок
                console.error(`Error during ${type}:`, err);
                alert('Ошибка: ' + err.message);
            }
        };
    };
    
    // Настраиваем обработчики для обеих форм
    auth('loginForm', 'login');      // Форма входа
    auth('registerForm', 'register'); // Форма регистрации

    /*Обработка выхода*/
    const logout = document.getElementById('logout-btn'); //обработка кнопки выхода
    if (logout) logout.onclick = (e) => { 
        e.preventDefault();
        
        // Очищаем все данные из локального хранилища (логин, ID, корзина и т.д.)
        localStorage.clear(); 
        
        // Перезагружаем страницу для обновления интерфейса (скрыть элементы для авторизованных)
        location.reload(); 
    };
});