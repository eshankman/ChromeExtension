console.log("CONTENT SCRIPT LOADED on", window.location.href);

let hoverTimeout;
document.addEventListener("mouseover", (e) => {
  clearTimeout(hoverTimeout);
  hoverTimeout = setTimeout(() => handleHover(e), 200);
});

function handleHover(e) {
  const { title, price } = getProductInfo(e.target);
  if (title) {
    console.log("Sending message with title:", title, "from site:", window.location.hostname);

    chrome.runtime.sendMessage(
      {
        action: "NAIVE_COMPETITOR_COMPARE",
        currentSite: window.location.hostname,
        productTitle: title
      },
      (response) => {
        console.log("Got competitor response:", response); 
        // => If the background script returns an object with { success, data }, it’ll show up here.

        showPriceBubble(title, price, e.pageX, e.pageY, response);
      }
    );
  }
}

function showPriceBubble(localTitle, localPrice, x, y, competitorData) {
  // Remove old bubble
  const oldBubble = document.getElementById("pricepal-bubble");
  if (oldBubble) oldBubble.remove();

  const bubble = document.createElement("div");
  bubble.id = "pricepal-bubble";
  bubble.style.position = "absolute";
  bubble.style.left = (x + 15) + "px";
  bubble.style.top = (y + 15) + "px";
  bubble.style.border = "1px solid #ccc";
  bubble.style.backgroundColor = "#fff";
  bubble.style.padding = "8px";
  bubble.style.zIndex = 999999;

  // Title
  const titleEl = document.createElement("div");
  titleEl.style.fontWeight = "bold";
  titleEl.textContent = truncateTitle(localTitle, 60);
  bubble.appendChild(titleEl);

  // Local price
  const priceEl = document.createElement("div");
  priceEl.style.marginTop = "4px";
  priceEl.textContent = localPrice ? `Local Price: ${localPrice}` : "No local price";
  bubble.appendChild(priceEl);

  // Competitors
  if (competitorData && competitorData.success) {
    const comps = competitorData.data;
    if (comps && Object.keys(comps).length > 0) {
      const cTitle = document.createElement("div");
      cTitle.style.marginTop = "6px";
      cTitle.textContent = "Competitor Price(s):";
      bubble.appendChild(cTitle);

      for (const site of Object.keys(comps)) {
        const siteLine = document.createElement("div");
        siteLine.style.marginLeft = "8px";
        siteLine.textContent = `${site.toUpperCase()}: ${comps[site] || "N/A"}`;
        bubble.appendChild(siteLine);
      }
    }
  } else if (competitorData && competitorData.error) {
    const errEl = document.createElement("div");
    errEl.style.color = "red";
    errEl.textContent = `Error: ${competitorData.error}`;
    bubble.appendChild(errEl);
  }

  document.body.appendChild(bubble);
}

function truncateTitle(str, maxLength = 50) {
  if (!str) return "";
  return str.length <= maxLength ? str : str.slice(0, maxLength) + "...";
}

// Basic local logic for Amazon or BestBuy
function getProductInfo(element) {
  const hostname = window.location.hostname;
  let title = null, price = null;

  if (hostname.includes("amazon.com")) {
    const productCard = element.closest("div[data-component-type='s-search-result']");
    if (productCard) {
      title = getAmazonTitle(productCard);
      const priceWhole = productCard.querySelector(".a-price-whole");
      const priceFraction = productCard.querySelector(".a-price-fraction");
      if (priceWhole && priceFraction) {
        price = "$" + 
          priceWhole.innerText.trim().replace(/[^\d]/g, "") +
          "." +
          priceFraction.innerText.trim().replace(/[^\d]/g, "");
      }
    }
  } else if (hostname.includes("bestbuy.com")) {
    const productCard = element.closest(".sku-item, .product-list-item");
    if (productCard) {
      title = getBestBuyTitle(productCard);
      let priceEl = productCard.querySelector("[data-testid='medium-customer-price'], .customer-price, .priceView-hero-price span");
      if (priceEl) {
        price = priceEl.innerText.trim();
      }
    }
  }

  return { title, price };
}

function getAmazonTitle(productCard) {
  const h2El = productCard.querySelector("h2");
  if (h2El) {
    const aria = h2El.getAttribute("aria-label");
    if (aria && aria.trim()) return aria.trim();
  }
  const linkEl = productCard.querySelector("h2 a");
  if (linkEl) {
    const linkAria = linkEl.getAttribute("aria-label");
    if (linkAria && linkAria.trim()) return linkAria.trim();
  }
  const spanEls = productCard.querySelectorAll("h2 span");
  if (spanEls.length > 0) {
    let combined = "";
    spanEls.forEach(s => { combined += s.innerText.trim() + " "; });
    return combined.trim();
  }
  return null;
}

function getBestBuyTitle(productCard) {
  const h2El = productCard.querySelector("h2.product-title");
  if (h2El && h2El.innerText.trim()) return h2El.innerText.trim();
  const h4El = productCard.querySelector("h4.sku-header");
  if (h4El && h4El.innerText.trim()) return h4El.innerText.trim();
  const alt = productCard.querySelector(".sku-title, .product-title a");
  if (alt && alt.innerText.trim()) return alt.innerText.trim();
  return null;
}
