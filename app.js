/**
 * Quantum Store - Frontend Logic
 * Interacts with 4 microservices:
 * - User Service (8001)
 * - Product Service (8002)
 * - Order Service (8003)
 * - Payment Service (8004)
 */

const API_CONFIG = {
    // USER: 'http://localhost:8001',
    // PRODUCT: 'http://localhost:8002',
    // ORDER: 'http://localhost:8003',
    // PAYMENT: 'http://localhost:8004'


    USER: 'https://dc-cep-user-service-production.up.railway.app',
    PRODUCT: 'https://dc-cep-product-service-production.up.railway.app',
    ORDER: 'https://dc-cep-order-service-production.up.railway.app',
    PAYMENT: 'https://dc-cep-payment-service-production.up.railway.app'
};

// --- State Management ---
let state = {
    user: JSON.parse(localStorage.getItem('quantum_user')) || null,
    products: [],
    cart: JSON.parse(localStorage.getItem('quantum_cart')) || [],
    currentSection: 'products'
};

// --- DOM Elements ---
const elements = {
    navItems: document.querySelectorAll('.nav-item'),
    panels: document.querySelectorAll('.panel'),
    productGrid: document.getElementById('productGrid'),
    cartBtn: document.getElementById('cartBtn'),
    cartBadge: document.getElementById('cartBadge'),
    cartDrawer: document.getElementById('cartDrawer'),
    closeCart: document.getElementById('closeCart'),
    drawerOverlay: document.getElementById('drawerOverlay'),
    cartItemsList: document.getElementById('cartItemsList'),
    cartDrawerTotal: document.getElementById('cartDrawerTotal'),
    checkoutItems: document.getElementById('checkoutItems'),
    totalPrice: document.getElementById('totalPrice'),
    subtotalPrice: document.getElementById('subtotalPrice'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    orderForm: document.getElementById('orderForm'),
    statusLog: document.getElementById('statusLog'),
    userDisplay: document.getElementById('userDisplay'),
    userName: document.getElementById('userName'),
    toastContainer: document.getElementById('toastContainer'),
    productSearch: document.getElementById('productSearch'),
    switchToRegister: document.getElementById('switchToRegister'),
    switchToLogin: document.getElementById('switchToLogin'),
    loginCard: document.getElementById('loginCard'),
    registerCard: document.getElementById('registerCard'),
    goToCheckout: document.getElementById('goToCheckout')
};

// --- Initializing ---
function init() {
    setupEventListeners();
    updateCartUI();
    updateUserUI();
    fetchProducts();
    checkServiceHealth();
    
    // Smooth scroll to sections
    document.querySelectorAll('button[data-section]').forEach(btn => {
        btn.addEventListener('click', () => switchSection(btn.dataset.section));
    });

    log('Quantum Store UI Initialized.', 'system');
}

// --- Navigation Logic ---
function switchSection(sectionId) {
    state.currentSection = sectionId;
    
    // Update Navbar
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });

    // Update Panels
    elements.panels.forEach(panel => {
        panel.classList.toggle('active', panel.id === sectionId);
    });

    // Special logic for hero
    const hero = document.getElementById('hero');
    if (sectionId === 'products') {
        hero.style.display = 'flex';
    } else {
        hero.style.display = 'none';
    }

    if (sectionId === 'checkout') {
        renderCheckout();
    }

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    log(`Navigated to section: ${sectionId.toUpperCase()}`, 'info');
}

// --- API Interactions ---

// 1. Product Service
async function fetchProducts() {
    try {
        log('Requesting catalog from Product Service...', 'system');
        const res = await fetch(`${API_CONFIG.PRODUCT}/products`);
        if (!res.ok) throw new Error('Product service unavailable');
        state.products = await res.json();
        renderProducts(state.products);
        log(`Loaded ${state.products.length} products successfully.`, 'system');
        updateIndicator('productSvcStatus', true);
    } catch (err) {
        log(`Product Service Error: ${err.message}`, 'error');
        elements.productGrid.innerHTML = `<div class="error-msg">Failed to load products. Ensure Product Service is running on port 8002.</div>`;
        updateIndicator('productSvcStatus', false);
    }
}

// 2. User Service
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        log('Authenticating with User Service...', 'system');
        const res = await fetch(`${API_CONFIG.USER}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.status === 'true') {
            state.user = data.user;
            localStorage.setItem('quantum_user', JSON.stringify(data.user));
            updateUserUI();
            showToast(`Welcome back, ${data.user.name}!`);
            switchSection('products');
            log(`User logged in: ${data.user.email}`, 'info');
        } else {
            throw new Error(data.error || 'Invalid credentials');
        }
    } catch (err) {
        log(`Auth Error: ${err.message}`, 'error');
        showToast(err.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        log('Creating account in User Service...', 'system');
        const res = await fetch(`${API_CONFIG.USER}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();

        if (data.status === 'true') {
            showToast('Account created successfully! Please log in.');
            elements.loginCard.classList.remove('hidden');
            elements.registerCard.classList.add('hidden');
            log(`New user registered: ${email}`, 'info');
        } else {
            throw new Error(data.error || 'Registration failed');
        }
    } catch (err) {
        log(`Registration Error: ${err.message}`, 'error');
        showToast(err.message, 'error');
    }
}

// 3. Order & Payment Service
async function processOrder(e) {
    e.preventDefault();
    if (!state.user) {
        showToast('Please login to place an order', 'error');
        switchSection('account');
        return;
    }

    if (state.cart.length === 0) {
        showToast('Your cart is empty', 'error');
        return;
    }

    const payMethod = document.querySelector('input[name="payMethod"]:checked').value;
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    placeOrderBtn.disabled = true;
    placeOrderBtn.innerText = 'Processing...';

    try {
        // Step 1: Create Order
        log('Step 1: Submitting order to Order Service...', 'system');
        const orderRes = await fetch(`${API_CONFIG.ORDER}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: state.user.user_id,
                items: state.cart.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity
                }))
            })
        });
        const orderData = await orderRes.json();
        
        if (orderData.error) throw new Error(orderData.error);

        log(`Order created ID: ${orderData.order_id}. Amount: $${orderData.total_amount}`, 'info');

        // Step 2: Process Payment
        log('Step 2: Processing payment with Payment Service...', 'system');
        const payRes = await fetch(`${API_CONFIG.PAYMENT}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id: orderData.order_id,
                amount: orderData.total_amount,
                payment_method: payMethod
            })
        });
        const payData = await payRes.json();

        if (payData.payment_status === 'Success') {
            showToast('Order placed successfully! 🚀');
            log('Payment confirmed. Transaction complete.', 'info');
            clearCart();
            switchSection('status');
        } else {
            throw new Error('Payment failed. Please try again.');
        }
    } catch (err) {
        log(`Transaction Error: ${err.message}`, 'error');
        showToast(err.message, 'error');
    } finally {
        placeOrderBtn.disabled = false;
        placeOrderBtn.innerText = 'Complete Payment';
    }
}

// --- Cart Logic ---
function addToCart(productId) {
    const product = state.products.find(p => p.product_id === productId);
    if (!product) return;
    
    const existing = state.cart.find(item => item.product_id === productId);

    if (existing) {
        existing.quantity += 1;
    } else {
        state.cart.push({ ...product, quantity: 1 });
    }

    localStorage.setItem('quantum_cart', JSON.stringify(state.cart));
    updateCartUI();
    showToast(`${product.title} added to cart`);
    log(`Cart updated: +${product.title}`, 'info');
}

function clearCart() {
    state.cart = [];
    localStorage.removeItem('quantum_cart');
    updateCartUI();
}

// --- UI Rendering ---
function renderProducts(products) {
    if (products.length === 0) {
        elements.productGrid.innerHTML = '<p>No products found.</p>';
        return;
    }

    elements.productGrid.innerHTML = products.map(p => `
        <div class="product-card">
            <div class="product-img">
                <img src="${p.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80'}" alt="${p.title}">
                <span class="product-category">${p.category || 'Tech'}</span>
            </div>
            <div class="product-info">
                <h3>${p.title}</h3>
                <p>${p.description || 'No description available.'}</p>
                <div class="product-bottom">
                    <span class="product-price">$${parseFloat(p.price).toFixed(2)}</span>
                    <button class="add-btn" onclick="addToCart(${p.product_id})">+</button>
                </div>
            </div>
        </div>
    `).join('');
}

function updateCartUI() {
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    elements.cartBadge.innerText = count;

    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    elements.cartDrawerTotal.innerText = `$${total.toFixed(2)}`;

    if (state.cart.length === 0) {
        elements.cartItemsList.innerHTML = '<div class="empty-cart-msg">Your cart is feeling light.</div>';
    } else {
        elements.cartItemsList.innerHTML = state.cart.map(item => `
            <div class="cart-item">
                <img src="${item.image_url || 'https://via.placeholder.com/70x70'}" class="cart-item-img">
                <div class="cart-item-info">
                    <h4>${item.title}</h4>
                    <div class="cart-item-price">${item.quantity} x $${parseFloat(item.price).toFixed(2)}</div>
                </div>
            </div>
        `).join('');
    }
}

function renderCheckout() {
    if (state.cart.length === 0) {
        elements.checkoutItems.innerHTML = '<p>Your cart is empty.</p>';
        elements.totalPrice.innerText = '$0.00';
        elements.subtotalPrice.innerText = '$0.00';
        return;
    }

    elements.checkoutItems.innerHTML = state.cart.map(item => `
        <div class="summary-row">
            <span>${item.title} (x${item.quantity})</span>
            <span>$${(item.price * item.quantity).toFixed(2)}</span>
        </div>
    `).join('');

    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    elements.totalPrice.innerText = `$${total.toFixed(2)}`;
    elements.subtotalPrice.innerText = `$${total.toFixed(2)}`;
}

function updateUserUI() {
    if (state.user) {
        elements.userDisplay.classList.remove('hidden');
        elements.userName.innerText = state.user.name.split(' ')[0];
        elements.loginCard.innerHTML = `
            <h2>Hello, ${state.user.name}</h2>
            <p>You are logged in as ${state.user.email}</p>
            <button id="logoutBtn" class="btn btn-secondary full-width">Sign Out</button>
        `;
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    } else {
        elements.userDisplay.classList.add('hidden');
    }
}

function handleLogout() {
    state.user = null;
    localStorage.removeItem('quantum_user');
    window.location.reload();
}

// --- Utilities ---
function log(msg, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${msg}`;
    elements.statusLog.prepend(entry);
}

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function updateIndicator(id, online) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('online', online);
}

async function checkServiceHealth() {
    const services = [
        { id: 'userSvcStatus', url: API_CONFIG.USER + '/users/1' },
        { id: 'productSvcStatus', url: API_CONFIG.PRODUCT + '/products' },
        { id: 'orderSvcStatus', url: API_CONFIG.ORDER + '/orders' },
        { id: 'paymentSvcStatus', url: API_CONFIG.PAYMENT + '/payments' }
    ];

    for (const svc of services) {
        try {
            await fetch(svc.url, { method: 'GET', mode: 'no-cors' });
            updateIndicator(svc.id, true);
        } catch {
            updateIndicator(svc.id, false);
        }
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchSection(item.dataset.section);
        });
    });

    // Cart Drawer
    elements.cartBtn.addEventListener('click', () => elements.cartDrawer.classList.add('open'));
    elements.closeCart.addEventListener('click', () => elements.cartDrawer.classList.remove('open'));
    elements.drawerOverlay.addEventListener('click', () => elements.cartDrawer.classList.remove('open'));
    elements.goToCheckout.addEventListener('click', () => {
        elements.cartDrawer.classList.remove('open');
        switchSection('checkout');
    });

    // Forms
    elements.loginForm.addEventListener('submit', handleLogin);
    elements.registerForm.addEventListener('submit', handleRegister);
    elements.orderForm.addEventListener('submit', processOrder);

    // Auth Switch
    elements.switchToRegister.addEventListener('click', () => {
        elements.loginCard.classList.add('hidden');
        elements.registerCard.classList.remove('hidden');
    });
    elements.switchToLogin.addEventListener('click', () => {
        elements.registerCard.classList.add('hidden');
        elements.loginCard.classList.remove('hidden');
    });

    // Search
    elements.productSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = state.products.filter(p => 
            p.title.toLowerCase().includes(term) || 
            (p.category && p.category.toLowerCase().includes(term))
        );
        renderProducts(filtered);
    });
}

// Global exposure for onclick
window.addToCart = addToCart;

// Start the app
document.addEventListener('DOMContentLoaded', init);
