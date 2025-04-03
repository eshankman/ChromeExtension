// this is to avoid making too many calls and being perceived as a spam/bot
let hoverTimeout;

document.addEventListener("mouseover", (e) => {
  //don't run if mouse is over the bubble itself
  const isInsideBubble = e.target.closest("#pricepal-bubble");
  if (isInsideBubble) return;

  clearTimeout(hoverTimeout);
  hoverTimeout = setTimeout(() => {
    // const { title, price } = getProductInfo(e.target);
    // if (title) {
    //   showPriceBubble(title, price, e.pageX, e.pageY);
    // }
    handleHover(e);
  }, 200);
});

// our main invocator
function handleHover(e) {
  const { title, price } = getProductInfo(e.target);
  if (title) {
    console.log("Sending message with title:", title, "from site:", window.location.hostname);

    // 1) Convert "$99.99" → 99.99
    let numericPrice = 0;
    if (price) {
      numericPrice = parseFloat(price.replace(/[^0-9.]/g, ""));
      if (isNaN(numericPrice)) numericPrice = 0;
    }

    // 2) Now include `originalPrice` in the message
    chrome.runtime.sendMessage(
      {
        action: "PRICE_SEARCH",
        currentSite: window.location.hostname,
        productTitle: title,
        originalPrice: numericPrice
      },
      (response) => {
        console.log("Got competitor response:", response);
        showPriceBubble(title, price, e.pageX, e.pageY, response);
      }
    );
  }
}


// To make the title shorter, i.e. max 50 chars
function truncateTitle(str, maxLength = 50) {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

// Creates the bubble at the given (x, y)
function showPriceBubble(title, price, x, y, competitorData) {
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

  // Competitors
  if (competitorData && competitorData.success) {
    const comps = competitorData.data;
    if (comps && Object.keys(comps).length > 0) {
      const cTitle = document.createElement("div");
      cTitle.style.marginTop = "6px";
      cTitle.textContent = "Competitor Price(s):";
      bubble.appendChild(cTitle);

      //to iterate and add more comparison retailers
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

  //creation of the heart button for the wishlist
  const heartBtn = document.createElement("button");
  heartBtn.textContent = "🤍";
  heartBtn.classList.add("wishlist-btn");
  heartBtn.title = "Add to Wishlist";
  
  // Check if item is already in wishlist to show red heart
  chrome.storage.local.get(["wishlist"], (res) => {
    const wishlist = res.wishlist || {};
    const key = normalizeTitle(title);
    if (wishlist[key]) {
      heartBtn.textContent = "❤️";
      console.log("📦 Wishlist loaded:", wishlist);

    }
  });
  
  // Handle click
  heartBtn.addEventListener("click", () => {
    chrome.storage.local.get(["wishlist"], (res) => {
      const wishlist = res.wishlist || {};
      const key = normalizeTitle(title);
  
      // Toggle behavior: if already saved, remove it; otherwise, add it
      if (wishlist[key]) {
        delete wishlist[key];
        heartBtn.textContent = "🤍";
      } else {
        wishlist[key] = {
          title,
          price,
          site: window.location.hostname,
          date: new Date().toISOString(),
          url: window.location.href
        };
        heartBtn.textContent = "❤️";
      }
  
      chrome.storage.local.set({ wishlist }, () => {
        console.log("📦 Wishlist updated");
      });
    });
  });
  
  bubble.appendChild(heartBtn);

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
        price =
          "$" +
          priceWhole.innerText.trim().replace(/[^\d]/g, "") +
          "." +
          priceFraction.innerText.trim().replace(/[^\d]/g, "");
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

    // BEST BUY
  } else if (hostname.includes("bestbuy.com")) {
    const productCard = element.closest(
      ".span.value, .sku-item, .product-list-item"
    );
    if (productCard) {
      // Title
      title = getBestBuyTitle(productCard);

      // Price
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

function getBestBuyTitle(productCard) {
  // 1) Look for <h2 class="product-title">
  const h2TitleEl = productCard.querySelector("h2.product-title");
  if (h2TitleEl && h2TitleEl.innerText.trim()) {
    return h2TitleEl.innerText.trim();
  }

  // 2) fallback: maybe <h4 class="sku-header"> used on older pages
  const h4Header = productCard.querySelector("h4.sku-header");
  if (h4Header && h4Header.innerText.trim()) {
    return h4Header.innerText.trim();
  }

  // 3) fallback: maybe there's a <div class="sku-title"> or .product-title a
  const altTitleEl = productCard.querySelector(".sku-title, .product-title a");
  if (altTitleEl && altTitleEl.innerText.trim()) {
    return altTitleEl.innerText.trim();
  }

  // 4) final fallback: just return null if nothing is found
  return null;
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/gi, "-");
}
