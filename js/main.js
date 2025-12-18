// Автоматически определяем адрес сервера
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? (window.location.port === '3000' ? '' : 'http://localhost:3000')
    : (window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin);

console.log('API_URL set to:', API_URL || 'Local server mode (port 3000)');

document.addEventListener('DOMContentLoaded', function() {
    const popUp = document.getElementById('pop_up');
    const cartPopUp = document.getElementById('cart_pop_up');
    const cartItemsList = document.getElementById('cart-items-list');

    // 1. Функция обновления интерфейса
    async function updateUI() {
        const userId = localStorage.getItem('userId');
        const currentUser = localStorage.getItem('currentUser');

        console.log('Updating UI for user:', currentUser, 'ID:', userId);

        // Показываем/скрываем элементы в зависимости от логина
        document.querySelectorAll('.guest-only').forEach(el => el.style.display = currentUser ? 'none' : 'inline-block');
        document.querySelectorAll('.user-only').forEach(el => el.style.display = currentUser ? 'inline-block' : 'none');
        
        const nameDisplay = document.getElementById('user-name-display');
        if (currentUser && nameDisplay) nameDisplay.textContent = currentUser;

        if (userId) {
            try {
                const res = await fetch(`${API_URL}/cart/${userId}`);
                if (!res.ok) throw new Error('Ошибка сервера');
                const items = await res.json();
                
                const badge = document.getElementById('cart-count');
                if (badge) badge.textContent = items.length;

                if (cartItemsList) {
                    cartItemsList.innerHTML = '';
                    let total = 0;
                    if (items.length === 0) {
                        cartItemsList.innerHTML = '<p style="text-align:center; padding:20px;">Корзина пуста</p>';
                    } else {
                        items.forEach(item => {
                            // Очищаем цену от лишних символов для расчета
                            const cleanPrice = item.price.toString().replace(/[^\d]/g, '');
                            const priceNum = parseInt(cleanPrice) || 0;
                            total += priceNum;

                            // Форматируем цену для отображения в списке
                            const formattedPrice = priceNum.toLocaleString('ru-RU') + ' ₽';

                            const itemDiv = document.createElement('div');
                            itemDiv.className = 'cart-item';
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
                            cartItemsList.appendChild(itemDiv);
                        });
                    }
                    const totalEl = document.getElementById('cart-total-price');
                    if (totalEl) {
                        totalEl.textContent = total.toLocaleString('ru-RU');
                    }
                }
            } catch (e) { 
                console.error('Ошибка связи с сервером в updateUI:', e); 
            }
        }
    }

    updateUI();

    // 2. ОБРАБОТКА КЛИКОВ
    document.addEventListener('click', async (e) => {
        // --- УДАЛЕНИЕ ---
        if (e.target.classList.contains('delete-item')) {
            e.preventDefault();
            e.stopPropagation(); 
            const id = e.target.dataset.id;
            // Сначала удаляем, потом обновляем UI
            await fetch(`${API_URL}/cart/delete/${id}`, { method: 'DELETE' });
            await updateUI();
            return;
        }

        // --- ОТКРЫТИЕ КОРЗИНЫ ---
        if (e.target.closest('.cart-link')) {
            e.preventDefault();
            if (cartPopUp) {
                cartPopUp.classList.add('active');
                updateUI();
            }
            return;
        }

        // --- КНОПКИ ЗАКРЫТИЯ (КРЕСТИКИ) ---
        if (e.target.classList.contains('pop_up_close') || e.target.id === 'cart_pop_up_close') {
            const currentPop = e.target.closest('.pop_up');
            if (currentPop) currentPop.classList.remove('active');
            return;
        }

        // --- ДОБАВЛЕНИЕ В КОРЗИНУ ---
        if (e.target.classList.contains('add-to-cart') || (e.target.classList.contains('btn') && e.target.textContent === 'Купить')) {
            e.preventDefault();
            const userId = localStorage.getItem('userId');
            if (!userId) { popUp && popUp.classList.add('active'); return; }
            
            const card = e.target.closest('.product-card') || e.target.closest('.product-detail') || document.body;
            
            // Более точный поиск названия
            const nameEl = card.querySelector('h3') || card.querySelector('h1');
            const name = nameEl ? nameEl.textContent.trim() : 'Товар';
            
            // Улучшенный поиск цены: ищем класс .product-price или пробуем найти строку с "₽"
            let priceText = '';
            const priceEl = card.querySelector('.product-price');
            if (priceEl) {
                priceText = priceEl.textContent;
            } else {
                // Если класса нет (на странице товара), ищем элемент списка или параграф, содержащий ₽
                const allElements = card.querySelectorAll('li, p, span');
                for (let el of allElements) {
                    if (el.textContent.includes('₽')) {
                        priceText = el.textContent;
                        break;
                    }
                }
            }

            // Очищаем цену от всего, кроме цифр, прямо при добавлении
            const cleanPrice = priceText.replace(/[^\d]/g, '');
            const finalPrice = cleanPrice ? parseInt(cleanPrice).toLocaleString('ru-RU') + ' ₽' : '0 ₽';

            const imgEl = card.querySelector('img:not(.logo):not(.cutehom):not(.footer-logo)');
            const img = imgEl ? imgEl.src : '';

            try {
                const res = await fetch(`${API_URL}/cart/add`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        user_id: userId, 
                        product_name: name, 
                        price: finalPrice, 
                        image_url: img
                    })
                });
                
                if (res.ok) {
                    updateUI();
                    // Убрали alert('Добавлено в корзину!');
                }
            } catch (err) {
                console.error('Ошибка при добавлении:', err);
            }
        }

        // --- ВХОД / РЕГИСТРАЦИЯ ---
        if (e.target.id === 'open_pop_up' || e.target.id === 'open_register_pop_up' || e.target.classList.contains('switch-to-register') || e.target.classList.contains('switch-to-login')) {
            e.preventDefault();
            popUp.classList.add('active');
            
            const isLogin = e.target.id === 'open_pop_up' || e.target.classList.contains('switch-to-login');
            
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            
            if (loginForm) loginForm.classList.toggle('active', isLogin);
            if (registerForm) registerForm.classList.toggle('active', !isLogin);
        }
    });

    // 3. ЗАКРЫТИЕ ПО КЛИКУ НА ФОН (Отдельно для надежности)
    document.querySelectorAll('.pop_up').forEach(p => {
        p.addEventListener('click', (e) => {
            if (e.target === p) {
                p.classList.remove('active');
            }
        });
    });

    // Формы авторизации
    const auth = (id, type) => {
        const f = document.getElementById(id);
        if (f) f.onsubmit = async (ev) => {
            ev.preventDefault();
            const inputs = f.querySelectorAll('input');
            console.log(`Attempting ${type} for:`, inputs[0].value);
            
            try {
                const res = await fetch(`${API_URL}/${type}`, { 
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify({username: inputs[0].value, password: inputs[1].value}) 
                });
                
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Ошибка сервера');
                }

                const data = await res.json();
                console.log(`${type} success:`, data);
                
                localStorage.setItem('currentUser', data.username || inputs[0].value); 
                localStorage.setItem('userId', data.id); 
                location.reload(); 
            } catch (err) {
                console.error(`Error during ${type}:`, err);
                alert('Ошибка: ' + err.message);
            }
        };
    };
    auth('loginForm', 'login'); auth('registerForm', 'register');

    const logout = document.getElementById('logout-btn');
    if (logout) logout.onclick = (e) => { 
        e.preventDefault();
        localStorage.clear(); 
        location.reload(); 
    };
});