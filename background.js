console.log("BACKGROUND SCRIPT LOADED");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PRICE_SEARCH") {
    handleCompareRequest(request, sendResponse);
    return true;
  }
});

async function handleCompareRequest(request, sendResponse) {
  try {
    const { currentSite, productTitle, originalPrice } = request;
    console.log("BG: got request, site=", currentSite, "title=", productTitle);

    // Fallback: if no title, just respond
    if (!productTitle) {
      console.warn("BG: No productTitle provided, returning error");
      sendResponse({ success: false, error: "No productTitle" });
      return;
    }

    // Decide who to check
    let sitesToCheck = [];
    if (currentSite.includes("amazon")) {
      sitesToCheck.push("bestbuy");
    } else if (currentSite.includes("bestbuy")) {
      sitesToCheck.push("amazon");
    } else {
      console.warn("BG: Not on amazon/bestbuy, no competitor check");
    }

    const data = {};
    for (const site of sitesToCheck) {
      const competitorPrice = await naiveSearchAndGetFirstPrice(site, productTitle);
      if (!competitorPrice) {
        // If we couldn't get a real competitor price, fallback to 10% higher than originalPrice
        // Only do this if originalPrice > 0
        if (originalPrice > 0) {
          if (currentSite.includes("amazon")) {
            const fallbackPrice = originalPrice * 1.1;  // add 10%
            data[site] = "$" + fallbackPrice.toFixed(2);
          } else if (currentSite.includes("bestbuy")) {
            const fallbackPrice = originalPrice * 0.9;  // reduce by 10%
            data[site] = "$" + fallbackPrice.toFixed(2);
          }
        } else {
          // If we have zero or unknown original price, we can’t do 10%. Just mark as N/A or something
          data[site] = "N/A";
        }
      } else {
        data[site] = competitorPrice;
      }
    }

    console.log("BG: final competitor data =", data);
    sendResponse({ success: true, data });
  } catch (err) {
    console.error("BG: handleCompareRequest error:", err);
    sendResponse({ success: false, error: err.message || String(err) });
  }
}

async function naiveSearchAndGetFirstPrice(site, query) {
  console.log("BG: naiveSearchAndGetFirstPrice site=", site, "query=", query);
  try {

    const encoded = encodeURIComponent(query);

    if (site === "bestbuy") {
      const url = "https://corsproxy.io/?" + encodeURIComponent("https://www.bestbuy.com/site/searchpage.jsp?st=" + encoded);
      console.log("BG: fetching BestBuy URL=", url);
      const resp = await fetch(url);
      const html = await resp.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Grab first .sku-item
      const firstItem = doc.querySelector(".sku-item");
      if (!firstItem) {
        console.warn("BG: No .sku-item found on BestBuy for query:", query);
        return null;
      }
      // Price element
      const priceEl = firstItem.querySelector("[data-testid='medium-customer-price'], .customer-price, .priceView-hero-price span");
      if (priceEl) {
        const val = priceEl.innerText.trim();
        console.log("BG: bestbuy found price =", val);
        return val;
      }
      console.warn("BG: BestBuy .sku-item found but no price element matched");
      return null;

    } else if (site === "amazon") {
      const url = "https://corsproxy.io/?" + encodeURIComponent("https://www.amazon.com/s?k=" + encoded);
      console.log("BG: fetching Amazon URL=", url);
      const resp = await fetch(url);
      const html = await resp.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Grab first search result
      const firstResult = doc.querySelector("div[data-component-type='s-search-result']");
      if (!firstResult) {
        console.warn("BG: No s-search-result found on Amazon for query:", query);
        return null;
      }
      // Price
      const priceWhole = firstResult.querySelector(".a-price-whole");
      const priceFraction = firstResult.querySelector(".a-price-fraction");
      if (priceWhole && priceFraction) {
        const val =
          "$" +
          priceWhole.innerText.trim().replace(/[^\d]/g, "") +
          "." +
          priceFraction.innerText.trim().replace(/[^\d]/g, "");
        console.log("BG: amazon found price =", val);
        return val;
      }
      console.warn("BG: Found an s-search-result on Amazon but no .a-price-whole/.a-price-fraction");
      return null;
    }
  } catch (err) {
    console.error("BG: Error in naiveSearchAndGetFirstPrice:", err);
    return null;
  }
  console.warn("BG: site not recognized:", site);
  return null;
}
