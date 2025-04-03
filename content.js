function createBubble(productName) {
  const existing = document.querySelector("#pricepal-bubble");
  if (existing) existing.remove();

  const bubble = document.createElement("div");
  bubble.id = "pricepal-bubble";
  bubble.innerHTML = `
    <strong>${productName}</strong><br>
    🔥 Walmart: $17.99<br>
    🛒 Amazon: $19.49<br>
    💡 Best Price: Walmart
  `;
  document.body.appendChild(bubble);

  document.addEventListener("mousemove", function moveBubble(e) {
    bubble.style.top = e.pageY + 15 + "px";
    bubble.style.left = e.pageX + 15 + "px";
  }, { once: true });
}

function isAmazonProductCard(node) {
  return node?.classList?.contains("s-title-instructions-style") || node?.closest(".s-main-slot");
}

function isWalmartProductCard(node) {
  return node?.classList?.contains("search-result-product-title") || node?.closest("[data-type='items']");
}

document.addEventListener("mouseover", (e) => {
  const target = e.target;

  if (window.location.hostname.includes("amazon")) {
    if (isAmazonProductCard(target)) {
      const title = target.innerText || "Amazon Product";
      createBubble(title);
    }
  }

  if (window.location.hostname.includes("walmart")) {
    if (isWalmartProductCard(target)) {
      const title = target.innerText || "Walmart Product";
      createBubble(title);
    }
  }
});

document.addEventListener("mouseout", () => {
  const existing = document.querySelector("#pricepal-bubble");
  if (existing) existing.remove();
});
