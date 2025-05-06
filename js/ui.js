const themeToggleButton = document.getElementById("theme-toggle-btn");
const notificationArea = document.getElementById("notification-area");
const contextMenu = document.getElementById("context-menu");
const workspace = document.getElementById("workspace");
const nodeLayer = document.getElementById("node-layer");
const connectorLayer = document.getElementById("connector-layer");
const contextColorPicker = document.getElementById("context-color-picker");
const navbar = document.querySelector(".navbar"); // Dodato

let currentTheme = "light";
let contextMenuVisible = false;
let contextTargetNode = null;

// Funkcija za ažuriranje visine navbara
function updateNavbarHeight() {
  if (navbar) {
    const navbarHeight = navbar.offsetHeight;
    document.documentElement.style.setProperty(
      "--navbar-height",
      `${navbarHeight}px`
    );
  }
}

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  currentTheme = theme;
  const icon = themeToggleButton.querySelector("i");
  if (icon) {
    icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
  }
}

function toggleTheme() {
  const newTheme = currentTheme === "light" ? "dark" : "light";
  applyTheme(newTheme);
  saveTheme(newTheme);
  showNotification(
    `Tema promenjena u ${newTheme === "dark" ? "tamnu" : "svetlu"}.`
  );
}

function showNotification(message, type = "info") {
  // type can be 'info', 'success', 'error', 'warning'
  const notification = document.createElement("div");
  notification.className = `notification ${type}`; // Use type for class
  notification.textContent = message;
  notificationArea.appendChild(notification);

  // Clear previous timeouts if any for this specific notification (optional, for rapid notifications)
  if (notification.animationTimeout)
    clearTimeout(notification.animationTimeout);
  if (notification.removeTimeout) clearTimeout(notification.removeTimeout);

  // Force reflow to ensure animation plays
  void notification.offsetWidth;

  notification.style.opacity = "1"; // Set target opacity for animation start
  notification.style.transform = "translateY(0)"; // Set target transform for animation start

  notification.animationTimeout = setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateY(-10px) scale(0.95)";
    notification.removeTimeout = setTimeout(() => notification.remove(), 500); // Matches CSS animation fade-out
  }, 3500); // Keep notification visible for 3.5s before starting fade out
}

function showContextMenu(x, y, targetNode) {
  contextTargetNode = targetNode;
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.style.display = "block"; // Set display before adding class for transition
  requestAnimationFrame(() => {
    // Ensure display:block is applied before class
    contextMenu.classList.add("visible");
  });
  contextMenuVisible = true;

  const connectOption = contextMenu.querySelector('li[data-action="connect"]');
  if (connectOption) {
    connectOption.style.display = targetNode ? "flex" : "none";
  }
  const nodeSpecificOptions = contextMenu.querySelectorAll(
    'li[data-action="edit"], li[data-action="color"], li[data-action="delete"], li[data-action="history"]'
  );
  nodeSpecificOptions.forEach(
    (opt) => (opt.style.display = targetNode ? "flex" : "none")
  );
}

function hideContextMenu() {
  if (contextMenuVisible) {
    contextMenu.classList.remove("visible");
    // Wait for animation to finish before setting display to none
    setTimeout(() => {
      contextMenu.style.display = "none";
    }, 200); // Matches transition duration in CSS for opacity/transform
    contextMenuVisible = false;
    contextTargetNode = null;
  }
}

function initUI() {
  const savedTheme = loadTheme();
  applyTheme(savedTheme);

  themeToggleButton.addEventListener("click", toggleTheme);

  document.addEventListener("click", (event) => {
    if (contextMenuVisible && !contextMenu.contains(event.target)) {
      hideContextMenu();
    }
  });

  workspace.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const targetNodeElement = event.target.closest(".node");
    const targetNodeInstance = targetNodeElement
      ? app.findNodeById(targetNodeElement.dataset.id)
      : null;
    showContextMenu(event.clientX, event.clientY, targetNodeInstance);
  });

  contextMenu.addEventListener("click", (event) => {
    const actionItem = event.target.closest("li[data-action]");
    if (!actionItem) return;

    const action = actionItem.dataset.action;
    hideContextMenu();

    if (contextTargetNode) {
      switch (action) {
        case "edit":
          contextTargetNode.focusTitle();
          break;
        case "connect":
          app.startConnection(contextTargetNode);
          break;
        case "color":
          contextColorPicker.oninput = (e) => {
            contextTargetNode.setColor(e.target.value);
            app.saveState();
          };
          contextColorPicker.click();
          break;
        case "delete":
          app.deleteNode(contextTargetNode);
          break;
        case "history":
          showNotification("Istorija izmena još nije implementirana.");
          break;
      }
    } else {
    }
  });

  // Poziv za inicijalno postavljanje visine navbara
  updateNavbarHeight();
  // Dodavanje event listener-a za promenu veličine prozora
  window.addEventListener("resize", updateNavbarHeight);

  console.log("UI Initialized");
}
