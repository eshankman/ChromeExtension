document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["wishlist"], (res) => {
    const wishlist = res.wishlist || {};
    const ul = document.getElementById("wishlist-items");

    ul.innerHTML = "";

    const keys = Object.keys(wishlist);
    if (keys.length === 0) {
      ul.innerHTML = "<li>No items yet. Start hearting stuff!</li>";
    } else {
      for (const key of keys) {
        const item = wishlist[key];
        const li = document.createElement("li");

        li.innerHTML = item.url
          ? ` <button class="delete-btn" data-key="${key}" title="Remove from wishlist">🗑️</button>
            <a href="${item.url}" target="_blank" class="wishlist-link">${item.title}</a><br/>
            <span>${item.price} at ${item.site}</span>`
          : ` <button class="delete-btn" data-key="${key}" title="Remove from wishlist">🗑️</button>
            ${item.title}<br/>
            <span>${item.price} at ${item.site}</span>`;

        ul.appendChild(li);
      }

      document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const key = btn.dataset.key;
          chrome.storage.local.get(["wishlist"], (res) => {
            const wishlist = res.wishlist || {};
            delete wishlist[key];
            chrome.storage.local.set({ wishlist }, () => {
              // Refresh the popup
              location.reload();
            });
          });
        });
      });

      console.log("Loaded wishlist:", wishlist);
    }
  });
});
