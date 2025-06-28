// Content script for Price Drop Stalker
// Runs on shopping websites to detect products and extract pricing info

console.log('🛍️ Price Drop Stalker content script loaded on:', window.location.hostname);

// Product detection patterns for different retailers
const RETAILER_PATTERNS = {
  'amazon.com': {
    name: [
      '#productTitle',
      '.product-title',
      '[data-automation-id="product-title"]'
    ],
    price: [
      '.a-price-whole',
      '.a-offscreen',
      '[data-automation-id="product-price"]',
      '.a-price .a-offscreen',
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen'
    ],
    image: [
      '#landingImage',
      '.a-dynamic-image',
      '[data-automation-id="product-image"]'
    ]
  },
  'ebay.com': {
    name: [
      '.x-item-title-label',
      '[data-testid="x-item-title-label"]',
      '.it-ttl'
    ],
    price: [
      '.main-price',
      '.u-flL.condText',
      '[data-testid="converted-price"]',
      '.price-current'
    ],
    image: [
      '#icImg',
      '.ux-image-filmstrip-carousel-item img'
    ]
  },
  'bestbuy.com': {
    name: [
      '.heading-5.v-fw-regular',
      '[data-automation-id="product-title"]',
      '.sr-only'
    ],
    price: [
      '.sr-only:contains("current price")',
      '[data-automation-id="product-price"]',
      '.pricing-price__range'
    ],
    image: [
      '.primary-image',
      '[data-automation-id="hero-image"]'
    ]
  },
  'target.com': {
    name: [
      '[data-test="product-title"]',
      '.ProductTitle',
      'h1[data-test="product-title"]',
      '.styles__StyledHeading-sc-1xmf98v-0'
    ],
    price: [
      '[data-test="product-price"]',
      '.Price-characteristic',
      '.styles__CurrentPrice-sc-1o85bdb-3',
      '.h-text-red',
      '.h-text-grayDark'
    ],
    image: [
      '[data-test="hero-image"]',
      '.ProductImages img',
      '.styles__HeroImageContainer-sc-1v74sn7-0 img'
    ]
  },
  'walmart.com': {
    name: [
      '[data-automation-id="product-title"]',
      '.heading'
    ],
    price: [
      '[data-automation-id="product-price"]',
      '.price-current'
    ],
    image: [
      '[data-automation-id="product-image"]',
      '.hover-zoom-hero-image'
    ]
  }
};

// Current page product data
let currentProduct = null;

// Initialize product detection
function initializeProductDetection() {
  const hostname = window.location.hostname.replace('www.', '');
  const retailerPattern = RETAILER_PATTERNS[hostname];
  
  if (!retailerPattern) {
    console.log('⚠️ Retailer not supported:', hostname);
    return;
  }
  
  console.log('🎯 Initializing product detection for:', hostname);
  
  // Try to detect product immediately
  detectProduct();
  
  // Set up observer for dynamic content loading
  setupContentObserver();
  
  // Listen for URL changes (SPAs)
  setupURLChangeListener();
}

// Detect product on current page
function detectProduct() {
  const hostname = window.location.hostname.replace('www.', '');
  const retailerPattern = RETAILER_PATTERNS[hostname];
  
  if (!retailerPattern) return null;
  
  console.log('🔍 Attempting to detect product on:', hostname);
  
  const product = {
    name: extractText(retailerPattern.name),
    price: extractPrice(retailerPattern.price),
    imageUrl: extractImageUrl(retailerPattern.image),
    url: window.location.href,
    retailer: hostname
  };
  
  console.log('📊 Extracted product data:', product);
  
  // Only consider it a valid product if we have name and price
  if (product.name && product.price) {
    currentProduct = product;
    console.log('✅ Product detected:', product);
    
    // Store for popup access
    window.priceDropStalkerProduct = product;
    
    return product;
  } else {
    console.log('⚠️ Incomplete product data - Name:', !!product.name, 'Price:', !!product.price);
    currentProduct = null;
    window.priceDropStalkerProduct = null;
  }
  
  return null;
}

// Extract text using multiple selectors
function extractText(selectors) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || element.innerText;
        if (text && text.trim()) {
          console.log('📝 Found product name with selector:', selector, '→', text.trim().substring(0, 50) + '...');
          return text.trim();
        }
      }
    } catch (error) {
      console.log('⚠️ Error with selector:', selector, error);
    }
  }
  
  // Fallback: try to find any h1 or title-like element
  const fallbackSelectors = ['h1', '.title', '[class*="title"]', '[class*="name"]'];
  for (const selector of fallbackSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || element.innerText;
        if (text && text.trim() && text.length > 10) {
          console.log('📝 Found product name with fallback selector:', selector, '→', text.trim().substring(0, 50) + '...');
          return text.trim();
        }
      }
    } catch (error) {
      // Silent fallback failure
    }
  }
  
  console.log('❌ No product name found');
  return null;
}

// Extract and parse price
function extractPrice(selectors) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent || element.innerText;
        if (text) {
          // Extract numeric price from text
          const priceMatch = text.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
          if (priceMatch) {
            const price = parseFloat(priceMatch[1].replace(/,/g, ''));
            if (price > 0) {
              console.log('💰 Found price with selector:', selector, '→', price, 'from text:', text.trim());
              return price;
            }
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Error with price selector:', selector, error);
    }
  }
  
  // Fallback: search for any price-like text
  const fallbackSelectors = ['[class*="price"]', '[class*="cost"]', '[data*="price"]'];
  for (const selector of fallbackSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent || element.innerText;
        if (text) {
          const priceMatch = text.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
          if (priceMatch) {
            const price = parseFloat(priceMatch[1].replace(/,/g, ''));
            if (price > 5) { // Reasonable minimum price
              console.log('💰 Found price with fallback selector:', selector, '→', price);
              return price;
            }
          }
        }
      }
    } catch (error) {
      // Silent fallback failure
    }
  }
  
  console.log('❌ No price found');
  return null;
}

// Extract image URL
function extractImageUrl(selectors) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const src = element.src || element.getAttribute('data-src') || element.getAttribute('data-lazy-src');
        if (src && src.startsWith('http')) {
          console.log('🖼️ Found image:', src);
          return src;
        }
      }
    } catch (error) {
      console.log('⚠️ Error with image selector:', selector, error);
    }
  }
  
  // Fallback: find any large image
  try {
    const images = document.querySelectorAll('img');
    for (const img of images) {
      if (img.width > 200 && img.height > 200 && img.src && img.src.startsWith('http')) {
        console.log('🖼️ Found image with fallback:', img.src);
        return img.src;
      }
    }
  } catch (error) {
    // Silent fallback failure
  }
  
  return null;
}

// Set up content observer for dynamic loading
function setupContentObserver() {
  const observer = new MutationObserver((mutations) => {
    let shouldRecheck = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if any added nodes contain product information
        for (let node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const hostname = window.location.hostname.replace('www.', '');
            const retailerPattern = RETAILER_PATTERNS[hostname];
            
            if (retailerPattern) {
              // Check if the added content contains price or product title elements
              const hasPrice = retailerPattern.price.some(selector => {
                try {
                  return node.querySelector && node.querySelector(selector);
                } catch (e) {
                  return false;
                }
              });
              const hasTitle = retailerPattern.name.some(selector => {
                try {
                  return node.querySelector && node.querySelector(selector);
                } catch (e) {
                  return false;
                }
              });
              
              if (hasPrice || hasTitle) {
                shouldRecheck = true;
                break;
              }
            }
          }
        }
      }
    });
    
    if (shouldRecheck && !currentProduct) {
      // Debounce re-detection
      clearTimeout(window.productDetectionTimeout);
      window.productDetectionTimeout = setTimeout(() => {
        console.log('🔄 Re-detecting product due to DOM changes');
        detectProduct();
      }, 1000);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('👀 Content observer set up for dynamic loading');
}

// Set up URL change listener for SPAs
function setupURLChangeListener() {
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('🔄 URL changed, re-detecting product');
      setTimeout(() => {
        currentProduct = null;
        window.priceDropStalkerProduct = null;
        detectProduct();
      }, 2000); // Wait for page to load
    }
  }).observe(document, { subtree: true, childList: true });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Content script received message:', request);
  
  if (request.action === 'getCurrentProduct') {
    // Try to detect product if we haven't already
    if (!currentProduct) {
      detectProduct();
    }
    
    sendResponse({ 
      product: currentProduct || window.priceDropStalkerProduct,
      url: window.location.href,
      hostname: window.location.hostname
    });
  }
  
  return true;
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeProductDetection);
} else {
  initializeProductDetection();
}

// Also try after a delay for SPAs
setTimeout(initializeProductDetection, 2000);

console.log('✅ Price Drop Stalker content script initialized');