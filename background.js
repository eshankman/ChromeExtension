
console.log("BACKGROUND SCRIPT LOADED");
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  console.log("Got message", req);
  // ...
});


// Helper to fetch Best Buy with naive HTML scraping
async function fetchCompetitorPrice(site, query) {
    let url = "";
    let priceRegex = null;
  
    if (site === "walmart") {
      // Example search URL for Walmart
      url = "https://www.walmart.com/search?q=" + encodeURIComponent(query);
      // A naive example: Walmart might show prices in something like:
      // <span class="price-characteristic" content="1197"/>
      // or data-automation-id="product-price" with some structure. We’ll do a simple approach:
      priceRegex = /data-automation-id="product-price"[^>]*>(\$[\d.,]+)/;
    } 
    
    else if (site === "bestbuy") {
      // Example search URL for Best Buy
      url = "https://www.bestbuy.com/site/searchpage.jsp?st=" + encodeURIComponent(query);
      // A naive example:
      priceRegex = /class="srp-price.*?"[^>]*>\s*\$([\d.,]+)/;
      // or you could look for <div class="priceView-customer-price"><span>\$999.99</span></div>
    }

    else if (site === "amazon") {
        // e.g. https://www.amazon.com/s?k=some+title
        url = "https://www.amazon.com/s?k=" + encodeURIComponent(query);
      
        // VERY naive example:
        // Might match something like: <span class="a-price-whole">123</span>
        priceRegex = /<span class="a-price-whole">([\d,]+)/;
      }
      
  
    if (!url || !priceRegex) {
      return null;
    }
  
    try {
      const resp = await fetch(url);
      const html = await resp.text();
  
      const match = html.match(priceRegex);
      if (match) {
        // For Walmart, match[1] might already have a '$' in it. For Best Buy, we might reconstruct it.
        return match[1].startsWith("$") ? match[1] : "$" + match[1];
      }
    } catch (err) {
      console.error("Error fetching competitor price:", err);
    }
  
    return null;
  }
  
  // Listen for messages from content.js
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "GET_COMPETITOR_PRICES") {
      const { productTitle, currentSite } = request;
      
      // Decide which competitor to fetch:
      // e.g. if we’re on Amazon, we want Best Buy.
      // if we’re on Best Buy, we want Amazon.
      // (Or add Walmart, etc.)
      const sitesToCheck = [];
      
      if (currentSite.includes("amazon")) {
        sitesToCheck.push("bestbuy");
        // or push("walmart") if you want Walmart too
      } 
      else if (currentSite.includes("bestbuy")) {
        sitesToCheck.push("amazon");
      }
  
      // Now fetch from each competitor
      const competitorPrices = {};
      for (const site of sitesToCheck) {
        competitorPrices[site] = await fetchCompetitorPrice(site, productTitle);
      }
  
      sendResponse({ success: true, competitorPrices });
      return true; // keeps the sendResponse valid for async
    }
  });
  
  