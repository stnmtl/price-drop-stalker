// Popup JavaScript for Price Drop Stalker
console.log('🎯 Popup script loaded');

// Global variables
let currentProduct = null;
let trackedItems = [];
let userSettings = {};

// Initialize popup when loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM loaded, initializing popup...');
    initializePopup();
});

// Initialize the popup
async function initializePopup() {
    showLoading(true);
    
    try {
        // Load user data
        await loadUserData();
        
        // Detect current product
        await detectCurrentProduct();
        
        // Load tracked items
        await loadTrackedItems();
        
        // Update UI
        updateUI();
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('✅ Popup initialized successfully');
        
    } catch (error) {
        showError('Failed to load extension data');
        console.error('❌ Initialization error:', error);
    } finally {
        showLoading(false);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Track button
    const trackBtn = document.getElementById('track-btn');
    if (trackBtn) {
        trackBtn.addEventListener('click', trackCurrentProduct);
    }
    
    // Footer links
    const upgradeBtn = document.querySelector('.upgrade-btn');
    if (upgradeBtn) {
        upgradeBtn.addEventListener('click', showUpgrade);
    }
    
    // Footer links
    const footerLinks = document.querySelectorAll('.footer-link');
    footerLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const text = this.textContent;
            if (text === 'Dashboard') openDashboard();
            else if (text === 'Settings') openSettings();
            else if (text === 'Help') openHelp();
        });
    });
}

// Load user data from storage
async function loadUserData() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['userSettings'], (result) => {
            userSettings = result.userSettings || {
                isPro: false,
                notifications: true,
                installDate: Date.now()
            };
            console.log('👤 User settings loaded:', userSettings);
            resolve();
        });
    });
}

// Detect product on current page
async function detectCurrentProduct() {
    return new Promise((resolve) => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                console.log('🔍 Querying active tab for product data...');
                
                // First, try to inject content script if not already present
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        // Check if our content script variables exist
                        return {
                            hasContentScript: typeof window.priceDropStalkerProduct !== 'undefined',
                            product: window.priceDropStalkerProduct || null,
                            url: window.location.href,
                            hostname: window.location.hostname
                        };
                    }
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        console.log('⚠️ Could not inject script:', chrome.runtime.lastError.message);
                        currentProduct = null;
                        resolve();
                        return;
                    }
                    
                    if (results && results[0] && results[0].result) {
                        const data = results[0].result;
                        console.log('📊 Tab data received:', data);
                        
                        if (data.product) {
                            currentProduct = data.product;
                            console.log('✅ Product found via injection:', currentProduct);
                        } else {
                            console.log('⚠️ No product detected on current page');
                            currentProduct = null;
                        }
                    }
                    
                    resolve();
                });
            } else {
                console.log('⚠️ No active tab found');
                resolve();
            }
        });
    });
}

// Load tracked items from storage
async function loadTrackedItems() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['trackedItems'], (result) => {
            trackedItems = result.trackedItems || [];
            console.log('📦 Tracked items loaded:', trackedItems.length);
            resolve();
        });
    });
}

// Update the UI based on current state
function updateUI() {
    updateProductSection();
    updateStatsSection();
    updateTrackedItemsList();
    updateUpgradeSection();
}

// Update product detection section
function updateProductSection() {
    const trackSection = document.getElementById('track-section');
    const productIcon = document.getElementById('product-icon');
    const productName = document.getElementById('product-name');
    const productPrice = document.getElementById('product-price');
    const trackBtn = document.getElementById('track-btn');
    
    if (currentProduct && currentProduct.name && currentProduct.price) {
        // Determine icon based on retailer
        const retailerIcons = {
            'target.com': '🎯',
            'amazon.com': '📦',
            'ebay.com': '💼',
            'bestbuy.com': '🛒',
            'walmart.com': '🏪'
        };
        
        if (productIcon) productIcon.textContent = retailerIcons[currentProduct.retailer] || '🛍️';
        if (productName) productName.textContent = currentProduct.name.length > 50 ? 
            currentProduct.name.substring(0, 50) + '...' : currentProduct.name;
        if (productPrice) productPrice.textContent = `$${currentProduct.price.toFixed(2)}`;
        if (trackBtn) trackBtn.disabled = false;
        
        // Check if already tracking this item
        const alreadyTracked = trackedItems.some(item => item.url === currentProduct.url);
        if (alreadyTracked && trackBtn) {
            trackBtn.textContent = '✅ Already Tracking';
            trackBtn.disabled = true;
        }
        
        // Show free plan warning if applicable
        if (!userSettings.isPro) {
            const warningDiv = document.getElementById('free-limit-warning');
            const itemsCount = document.getElementById('items-count');
            if (warningDiv && itemsCount) {
                itemsCount.textContent = trackedItems.length;
                warningDiv.style.display = 'block';
            }
        }
        
    } else {
        // No product detected
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                const hostname = tabs[0].url ? new URL(tabs[0].url).hostname : '';
                const supportedSites = ['amazon.com', 'target.com', 'ebay.com', 'bestbuy.com', 'walmart.com'];
                const isSupported = supportedSites.some(site => hostname.includes(site));
                
                if (trackSection) {
                    if (isSupported) {
                        trackSection.innerHTML = `
                            <div class="current-page">
                                <div class="product-icon">🔍</div>
                                <div class="product-info">
                                    <div class="product-name">Looking for products...</div>
                                    <div class="product-price" style="color: #666;">Navigate to a product page</div>
                                </div>
                            </div>
                            <button class="track-btn" disabled style="opacity: 0.6;">
                                🔍 No Product Detected
                            </button>
                        `;
                    } else {
                        trackSection.innerHTML = `
                            <div class="empty-state">
                                <div class="empty-icon">🏪</div>
                                <div class="empty-text">Visit a supported store</div>
                                <div class="empty-subtext">Amazon, Target, eBay, Best Buy & Walmart</div>
                            </div>
                        `;
                    }
                }
            }
        });
    }
}

// Update stats section
function updateStatsSection() {
    const totalSaved = calculateTotalSavings();
    const itemsCount = trackedItems.length;
    
    const totalSavedEl = document.getElementById('total-saved');
    const itemsTrackingEl = document.getElementById('items-tracking');
    
    if (totalSavedEl) totalSavedEl.textContent = `$${totalSaved}`;
    if (itemsTrackingEl) itemsTrackingEl.textContent = itemsCount;
}

// Calculate total savings from price drops
function calculateTotalSavings() {
    let totalSavings = 0;
    
    trackedItems.forEach(item => {
        if (item.originalPrice && item.currentPrice && item.currentPrice < item.originalPrice) {
            totalSavings += (item.originalPrice - item.currentPrice);
        }
    });
    
    return totalSavings.toFixed(0);
}

// Update tracked items list
function updateTrackedItemsList() {
    const container = document.getElementById('tracked-items');
    const emptyState = document.getElementById('empty-state');
    
    if (trackedItems.length === 0) {
        if (container) container.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (container) container.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    
    if (container) {
        container.innerHTML = trackedItems.map(item => `
            <div class="tracked-item">
                <div class="item-details">
                    <div class="item-name" title="${item.name}">${item.name}</div>
                    <div class="item-price">$${item.currentPrice.toFixed(2)}</div>
                    <div class="price-change ${getPriceChangeClass(item)}">
                        ${getPriceChangeText(item)}
                    </div>
                </div>
                <div class="item-actions">
                    <button class="action-btn remove-btn" data-item-id="${item.id}" title="Remove from tracking">×</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners for remove buttons
        const removeButtons = container.querySelectorAll('.remove-btn');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const itemId = this.getAttribute('data-item-id');
                removeItem(itemId);
            });
        });
    }
}

// Get price change CSS class
function getPriceChangeClass(item) {
    if (!item.priceHistory || item.priceHistory.length < 2) return '';
    
    const lastChange = item.priceHistory[item.priceHistory.length - 1].change;
    return lastChange < 0 ? 'price-down' : lastChange > 0 ? 'price-up' : '';
}

// Get price change text
function getPriceChangeText(item) {
    if (!item.priceHistory || item.priceHistory.length < 2) {
        return 'No change';
    }
    
    const lastChange = item.priceHistory[item.priceHistory.length - 1].change;
    if (lastChange === 0) return 'No change';
    
    const arrow = lastChange < 0 ? '↓' : '↑';
    const timeAgo = getTimeAgo(item.priceHistory[item.priceHistory.length - 1].timestamp);
    
    return `${arrow} $${Math.abs(lastChange).toFixed(2)} (${timeAgo})`;
}

// Get human-readable time ago
function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
}

// Update upgrade section visibility
function updateUpgradeSection() {
    const upgradeSection = document.getElementById('upgrade-section');
    
    if (upgradeSection) {
        if (!userSettings.isPro && trackedItems.length >= 3) {
            upgradeSection.style.display = 'block';
        } else {
            upgradeSection.style.display = 'none';
        }
    }
}

// Track current product
async function trackCurrentProduct() {
    console.log('🎯 Track button clicked');
    
    if (!currentProduct) {
        showError('No product detected on this page');
        return;
    }
    
    // Check free plan limit
    if (!userSettings.isPro && trackedItems.length >= 5) {
        showError('Free plan limited to 5 items. Upgrade to Pro for unlimited tracking!');
        const upgradeSection = document.getElementById('upgrade-section');
        if (upgradeSection) upgradeSection.style.display = 'block';
        return;
    }
    
    const trackBtn = document.getElementById('track-btn');
    if (trackBtn) {
        trackBtn.disabled = true;
        trackBtn.textContent = '⏳ Adding...';
    }
    
    try {
        // Send to background script
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'trackProduct',
                data: currentProduct
            }, resolve);
        });
        
        if (response && response.error) {
            throw new Error(response.error);
        }
        
        showSuccess(`Now tracking: ${currentProduct.name.substring(0, 30)}...`);
        if (trackBtn) trackBtn.textContent = '✅ Added to Tracking';
        
        // Reload data and update UI
        await loadTrackedItems();
        updateUI();
        
    } catch (error) {
        showError(error.message || 'Failed to track product');
        if (trackBtn) {
            trackBtn.disabled = false;
            trackBtn.textContent = '🎯 Track This Product';
        }
    }
}

// Remove tracked item
async function removeItem(itemId) {
    console.log('🗑️ Removing item:', itemId);
    
    try {
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'removeItem',
                itemId: itemId
            }, resolve);
        });
        
        if (response && response.error) {
            throw new Error(response.error);
        }
        
        showSuccess('Item removed from tracking');
        
        // Reload data and update UI
        await loadTrackedItems();
        updateUI();
        
    } catch (error) {
        showError('Failed to remove item');
        console.error('❌ Remove item error:', error);
    }
}

// Show/hide loading state
function showLoading(show) {
    const loadingEl = document.getElementById('loading-state');
    if (loadingEl) {
        loadingEl.style.display = show ? 'block' : 'none';
    }
}

// Show error message
function showError(message) {
    console.log('❌ Error:', message);
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// Show success message
function showSuccess(message) {
    console.log('✅ Success:', message);
    const successDiv = document.getElementById('success-message');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    }
}

// External link functions - Updated with your actual Netlify URL
function showUpgrade() {
    chrome.tabs.create({
        url: 'https://price-drop-stalker.netlify.app/dashboard.html'
    });
}

function openDashboard() {
    chrome.tabs.create({
        url: 'https://price-drop-stalker.netlify.app/dashboard.html'
    });
}

function openSettings() {
    chrome.tabs.create({
        url: 'https://price-drop-stalker.netlify.app/settings.html'
    });
}

function openHelp() {
    chrome.tabs.create({
        url: 'https://price-drop-stalker.netlify.app/dashboard.html'
    });
}

console.log('✅ Popup script loaded successfully');
