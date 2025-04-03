console.log("BACKGROUND SCRIPT LOADED");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "NAIVE_COMPETITOR_COMPARE") {
    // We do our async work in a separate function, but we must
    // return true here so Chrome knows to keep the channel open.
    handleCompareRequest(request, sendResponse);
    return true;
  }
});

async function handleCompareRequest(request, sendResponse) {
  try {
    const { currentSite, productTitle } = request;
    console.log("BG: got request, site=", currentSite, "title=", productTitle);

    // Fallback: if no title, just respond
    if (!productTitle) {
      console.warn("BG: No productTitle provided, returning error");
      sendResponse({ success: false, error: "No productTitle" });
      return;
    }

    // For example, we truncate to 50 chars
    const truncatedQuery = productTitle.substring(0, 50);
    console.log("BG: truncatedQuery =", truncatedQuery);

    // Decide who to check
    let sitesToCheck = [];
    if (currentSite.includes("amazon")) {
      sitesToCheck.push("bestbuy");
    } else if (currentSite.includes("bestbuy")) {
      sitesToCheck.push("amazon");
    } else {
      console.warn("BG: Not on amazon/bestbuy, no competitor check");
    }

    // Perform naive fetch
    const data = {};
    for (const site of sitesToCheck) {
      const competitorPrice = await naiveSearchAndGetFirstPrice(site, truncatedQuery);
      data[site] = competitorPrice; // Might be null if no match
    }

    console.log("BG: final competitor data =", data);
    // Let the content script know we’re done
    sendResponse({ success: true, data });
  } catch (err) {
    console.error("BG: handleCompareRequest error:", err);
    sendResponse({ success: false, error: err.message || String(err) });
  }
}

async function naiveSearchAndGetFirstPrice(site, query) {
  console.log("BG: naiveSearchAndGetFirstPrice site=", site, "query=", query);
  try {
    if (site === "bestbuy") {
      const url = "https://www.bestbuy.com/site/searchpage.jsp?st=" + encodeURIComponent(query);
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
      const url = "https://www.amazon.com/s?k=" + encodeURIComponent(query);
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
