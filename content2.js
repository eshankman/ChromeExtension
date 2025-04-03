
console.log("CONTENT SCRIPT LOADED on", window.location.href, 
    typeof chrome, typeof chrome.runtime);


// ====== 1) THROTTLE HOVER EVENTS =================================================
let hoverTimeout;
document.addEventListener("mouseover", (e) => {
  clearTimeout(hoverTimeout);
  hoverTimeout = setTimeout(() => {
    handleHover(e);
  }, 200);
});

function handleHover(e) {
  const { title, price } = getProductInfo(e.target);
  if (title) {
    // We have a local (current site) title/price. Now let's fetch competitor prices.
    fetchCompetitorPrices(title)
      .then((competitorData) => {
        // Show the bubble with BOTH local price and competitor data
        showPriceBubble(title, price, e.pageX, e.pageY, competitorData);
      })
      .catch((err) => {
        console.error("Error fetching competitor prices:", err);
        showPriceBubble(title, price, e.pageX, e.pageY, null);
      });
  }
}

// ====== 2) FETCH COMPETITOR PRICES (Call background.js) ==========================
function fetchCompetitorPrices(productTitle) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: "GET_COMPETITOR_PRICES",
        productTitle,
        currentSite: window.location.hostname
      },
      (response) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        if (!response || !response.success) {
          return reject(response ? response.error : "No response");
        }
        resolve(response.competitorPrices);
      }
    );
  });
}

// ====== 3) CREATE THE PRICE BUBBLE ===============================================
function showPriceBubble(title, price, x, y, competitorData) {
  // Remove old bubble if any
  const oldBubble = document.getElementById("pricepal-bubble");
  if (oldBubble) oldBubble.remove();

  // Create bubble container
  const bubble = document.createElement("div");
  bubble.id = "pricepal-bubble";

  // Position near mouse
  bubble.style.left = x + 15 + "px";
  bubble.style.top = y + 15 + "px";

  // Title line
  const titleEl = document.createElement("div");
  titleEl.style.fontWeight = "bold";
  titleEl.classList.add("pricepal-title");
  titleEl.textContent = truncateTitle(title, 50);
  bubble.appendChild(titleEl);

  // Local price line
  const priceEl = document.createElement("div");
  priceEl.style.marginTop = "5px";
  priceEl.classList.add("pricepal-price");
  // priceEl.textContent = price ? `Local Price: ${price}` : "Price: Not found";
  priceEl.textContent = price 
  ? `Local Price: ${price}`
  : "Price: Not found";
  bubble.appendChild(priceEl);

  // If we got competitor data, display it
  if (competitorData) {
    const competitorEl = document.createElement("div");
    competitorEl.style.marginTop = "5px";
    competitorEl.textContent = "Competitors:";
    bubble.appendChild(competitorEl);

    for (let [site, sitePrice] of Object.entries(competitorData)) {
      const cLine = document.createElement("div");
      cLine.style.marginLeft = "10px";
      const label = site.toUpperCase();
    cLine.textContent = `- ${label}: ${sitePrice || "N/A"}`;
      bubble.appendChild(cLine);
    }
  }

  // Small tip
  const tipEl = document.createElement("div");
  tipEl.classList.add("pricepal-tip");
  tipEl.textContent = "👀 Compare or watch for drops!";
  bubble.appendChild(tipEl);

  // Append to DOM
  document.body.appendChild(bubble);
}

// ====== 4) SHORTEN LONG TITLES ===================================================
function truncateTitle(str, maxLength = 50) {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

// ====== 5) PARSE CURRENT SITE'S PRODUCT INFO =====================================

function getProductInfo(element) {
  const hostname = window.location.hostname;
  let title = null;
  let price = null;

  // Amazon
  if (hostname.includes("amazon.com")) {
    const productCard = element.closest("div[data-component-type='s-search-result']");
    if (productCard) {
      title = getAmazonTitle(productCard);
      const priceWhole = productCard.querySelector(".a-price-whole");
      const priceFraction = productCard.querySelector(".a-price-fraction");
      if (priceWhole && priceFraction) {
        price =
          "$" +
          priceWhole.innerText.trim().replace(/[^\d]/g, "") +
          "." +
          priceFraction.innerText.trim().replace(/[^\d]/g, "");
      }
    }

  // Walmart
  } else if (hostname.includes("walmart.com")) {
    const productCard = element.closest("[data-type='items']");
    if (productCard) {
      const titleElement = productCard.querySelector("a span");
      const priceElement = productCard.querySelector(
        "span[data-automation-id='product-price']"
      );
      title = titleElement ? titleElement.innerText.trim() : null;
      price = priceElement ? priceElement.innerText.trim() : null;
    }

  // Best Buy
  } else if (hostname.includes("bestbuy.com")) {
    const productCard = element.closest(".span.value, .sku-item, .product-list-item");
    if (productCard) {
      title = getBestBuyTitle(productCard);
      let priceElement = productCard.querySelector(
        "[data-testid='medium-customer-price'], .customer-price, .priceView-hero-price span"
      );
      if (priceElement) {
        price = priceElement.innerText.trim();
      }
    }
  }

  return { title, price };
}

function getAmazonTitle(productCard) {
  // 1) h2 with aria-label
  const h2El = productCard.querySelector("h2");
  if (h2El) {
    const h2Aria = h2El.getAttribute("aria-label");
    if (h2Aria && h2Aria.trim()) {
      return h2Aria.trim();
    }
  }
  // 2) h2 a with aria-label
  const linkEl = productCard.querySelector("h2 a");
  if (linkEl) {
    const linkAria = linkEl.getAttribute("aria-label");
    if (linkAria && linkAria.trim()) {
      return linkAria.trim();
    }
  }
  // 3) fallback: combine all <span> inside h2
  const spanEls = productCard.querySelectorAll("h2 span");
  if (spanEls.length > 0) {
    let combined = "";
    spanEls.forEach((s) => (combined += s.innerText.trim() + " "));
    const comboTitle = combined.trim();
    if (comboTitle) {
      return comboTitle;
    }
  }
  return null; // final fallback
}

function getBestBuyTitle(productCard) {
  // 1) <h2 class="product-title">
  const h2TitleEl = productCard.querySelector("h2.product-title");
  if (h2TitleEl && h2TitleEl.innerText.trim()) {
    return h2TitleEl.innerText.trim();
  }
  // 2) fallback: <h4 class="sku-header">
  const h4Header = productCard.querySelector("h4.sku-header");
  if (h4Header && h4Header.innerText.trim()) {
    return h4Header.innerText.trim();
  }
  // 3) <div class="sku-title"> or .product-title a
  const altTitleEl = productCard.querySelector(".sku-title, .product-title a");
  if (altTitleEl && altTitleEl.innerText.trim()) {
    return altTitleEl.innerText.trim();
  }
  return null;
}
