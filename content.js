// this is to avoid making too many calls and being perceived as a spam/bot
let hoverTimeout;
document.addEventListener("mouseover", (e) => {
  clearTimeout(hoverTimeout);
  hoverTimeout = setTimeout(() => {
    const { title, price } = getProductInfo(e.target);
    if (title) {
      showPriceBubble(title, price, e.pageX, e.pageY);
    }
  }, 200);
});

// our main invocator
function handleHover(e) {
  const { title, price } = getProductInfo(e.target);

  if (title) {
    showPriceBubble(title, price, e.pageX, e.pageY);
  }
}

// To make the title shorter, i.e. max 50 chars
function truncateTitle(str, maxLength = 50) {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

// Creates the bubble at the given (x, y)
function showPriceBubble(title, price, x, y) {
  // Remove old bubble
  const oldBubble = document.getElementById("pricepal-bubble");
  if (oldBubble) oldBubble.remove();

  // Create bubble container
  const bubble = document.createElement("div");
  bubble.id = "pricepal-bubble";

  // Position near mouse (the only inline style we'll keep is left/top)
  bubble.style.left = x + 15 + "px";
  bubble.style.top = y + 15 + "px";

  // CORRECT: Title line
  const titleEl = document.createElement("div");
  titleEl.style.fontWeight = "bold";
  titleEl.classList.add("pricepal-title");
  titleEl.textContent = truncateTitle(title, 50); //! adjust the title to be shorter (max 50)
  bubble.appendChild(titleEl);

  // CORRECT: Price line
  const priceEl = document.createElement("div");
  priceEl.style.marginTop = "5px";
  priceEl.classList.add("pricepal-price");
  priceEl.textContent = price ? `💵 Price: ${price}` : "Price: Not found";
  bubble.appendChild(priceEl);

  // Quick tip line
  const tipEl = document.createElement("div");
  tipEl.classList.add("pricepal-tip");
  tipEl.textContent = "👀 Compare or watch for drops!";
  bubble.appendChild(tipEl);

  // Append to DOM
  document.body.appendChild(bubble);
}

// The getProductInfo function you already have
function getProductInfo(element) {
  const hostname = window.location.hostname;
  let title = null;
  let price = null;

  // AMAZON
  if (hostname.includes("amazon.com")) {
    const productCard = element.closest(
      "div[data-component-type='s-search-result']"
    );
    if (productCard) {
      // Pass the productCard to your helper
      title = getAmazonTitle(productCard);

      // Price logic remains the same
      const priceWhole = productCard.querySelector(".a-price-whole");
      const priceFraction = productCard.querySelector(".a-price-fraction");
      if (priceWhole && priceFraction) {
        price = "$" + priceWhole.innerText.trim().replace(/[^\d]/g, "") + "." + priceFraction.innerText.trim().replace(/[^\d]/g, "");
      }
    }

    // WALMART
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
  }

  return { title, price };
}

function getAmazonTitle(productCard) {
  // Implement multiple ways of getting the title to make sure we
  // Maximize our chances of actually getting the product name

  // 1) h2 with aria-label
  const h2El = productCard.querySelector("h2");
  if (h2El) {
    const h2Aria = h2El.getAttribute("aria-label");
    if (h2Aria && h2Aria.trim()) {
      return h2Aria.trim();
    }
  }

  // 2) h2 a with aria-label
  const linkEl = productCard.querySelector("h2 a"); // also checking the title as an 'anchor tag' (Eric)
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

  // 4) final fallback
  return null;
}
