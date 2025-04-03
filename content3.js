console.log("CONTENT SCRIPT LOADED on", window.location.href);

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
    // Ask background.js for competitor price
    chrome.runtime.sendMessage(
      {
        action: "NAIVE_COMPETITOR_COMPARE",
        currentSite: window.location.hostname,
        productTitle: title
      },
      (response) => {
        // If we got competitor data, show them
        showPriceBubble(title, price, e.pageX, e.pageY, response);
      }
    );
  }
}

function showPriceBubble(localTitle, localPrice, x, y, competitorData) {
  // Remove old bubble
  const oldBubble = document.getElementById("pricepal-bubble");
  if (oldBubble) oldBubble.remove();

  // Create bubble
  const bubble = document.createElement("div");
  bubble.id = "pricepal-bubble";
  bubble.style.left = (x + 15) + "px";
  bubble.style.top = (y + 15) + "px";

  // Title
  const titleEl = document.createElement("div");
  titleEl.style.fontWeight = "bold";
  titleEl.textContent = truncateTitle(localTitle, 60);
  bubble.appendChild(titleEl);

  // Local price
  const priceEl = document.createElement("div");
  priceEl.style.marginTop = "5px";
  priceEl.textContent = localPrice ? `Local Price: ${localPrice}` : "Price: Not found";
  bubble.appendChild(priceEl);

  // Competitors
  if (competitorData && competitorData.success) {
    const comps = competitorData.data; 
    // e.g. { bestbuy: "$799.99" }

    const compsTitle = document.createElement("div");
    compsTitle.style.marginTop = "5px";
    compsTitle.textContent = "Competitor Price(s):";
    bubble.appendChild(compsTitle);

    for (let site in comps) {
      const siteLine = document.createElement("div");
      siteLine.style.marginLeft = "10px";
      siteLine.textContent = `${site.toUpperCase()}: ${comps[site] || "N/A"}`;
      bubble.appendChild(siteLine);
    }
  }

  document.body.appendChild(bubble);
}

// Basic truncation
function truncateTitle(str, maxLength = 50) {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

// Same as before: parse the local site’s product info
function getProductInfo(element) {
  const hostname = window.location.hostname;
  let title = null;
  let price = null;

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
  } else if (hostname.includes("bestbuy.com")) {
    const productCard = element.closest(".sku-item, .product-list-item");
    if (productCard) {
      title = getBestBuyTitle(productCard);
      let priceElement = productCard.querySelector("[data-testid='medium-customer-price'], .customer-price, .priceView-hero-price span");
      if (priceElement) {
        price = priceElement.innerText.trim();
      }
    }
  }
  // ignoring walmart for now, or keep it if you like

  return { title, price };
}

function getAmazonTitle(productCard) {
  // (Your existing logic for Amazon)
  const h2El = productCard.querySelector("h2");
  if (h2El) {
    const h2Aria = h2El.getAttribute("aria-label");
    if (h2Aria && h2Aria.trim()) {
      return h2Aria.trim();
    }
  }
  const linkEl = productCard.querySelector("h2 a");
  if (linkEl) {
    const linkAria = linkEl.getAttribute("aria-label");
    if (linkAria && linkAria.trim()) {
      return linkAria.trim();
    }
  }
  const spanEls = productCard.querySelectorAll("h2 span");
  if (spanEls.length > 0) {
    let combo = "";
    spanEls.forEach(s => combo += s.innerText.trim() + " ");
    return combo.trim();
  }
  return null;
}

function getBestBuyTitle(productCard) {
  // (Your existing logic for Best Buy)
  const h2TitleEl = productCard.querySelector("h2.product-title");
  if (h2TitleEl && h2TitleEl.innerText.trim()) {
    return h2TitleEl.innerText.trim();
  }
  const h4Header = productCard.querySelector("h4.sku-header");
  if (h4Header && h4Header.innerText.trim()) {
    return h4Header.innerText.trim();
  }
  const altTitleEl = productCard.querySelector(".sku-title, .product-title a");
  if (altTitleEl && altTitleEl.innerText.trim()) {
    return altTitleEl.innerText.trim();
  }
  return null;
}
