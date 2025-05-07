const themeToggleButton = document.getElementById("theme-toggle-btn");
const notificationArea = document.getElementById("notification-area");
const contextMenu = document.getElementById("context-menu");
const workspace = document.getElementById("workspace");
const nodeLayer = document.getElementById("node-layer");
const connectorLayer = document.getElementById("connector-layer");
const contextColorPicker = document.getElementById("context-color-picker");
const navbar = document.querySelector(".navbar");

let currentTheme = "light";
let contextMenuVisible = false;
let contextTargetNode = null;
let tippyInstances = [];

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

  const newTippyTheme = newTheme === "dark" ? "dark" : "light";
  if (tippyInstances && tippyInstances.length > 0) {
    tippyInstances.forEach((instance) => {
      instance.setProps({ theme: newTippyTheme });
    });
    console.log(`Tippy themes updated to: ${newTippyTheme}`);
  }
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notificationArea.appendChild(notification);

  if (notification.animationTimeout)
    clearTimeout(notification.animationTimeout);
  if (notification.removeTimeout) clearTimeout(notification.removeTimeout);

  void notification.offsetWidth;

  notification.style.opacity = "1";
  notification.style.transform = "translateY(0)";

  notification.animationTimeout = setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateY(-10px) scale(0.95)";
    notification.removeTimeout = setTimeout(() => notification.remove(), 500);
  }, 3500);
}

function showContextMenu(x, y, targetNode) {
  contextTargetNode = targetNode;
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.style.display = "block";
  requestAnimationFrame(() => {
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
    setTimeout(() => {
      contextMenu.style.display = "none";
    }, 200);
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

  updateNavbarHeight();
  window.addEventListener("resize", updateNavbarHeight);

  if (typeof tippy === "function") {
    const tippyTheme = currentTheme === "dark" ? "dark" : "light";

    if (tippyInstances && tippyInstances.length > 0) {
      tippyInstances.forEach((instance) => instance.destroy());
      tippyInstances = [];
    }

    const newInstances = tippy(
      ".navbar .tools button[title], .navbar .tools .tool-button[title]",
      {
        animation: "scale-subtle",
        placement: "bottom",
        theme: tippyTheme,
        appendTo: () => document.body,
        zIndex: 9999,
        content(reference) {
          let content = reference.getAttribute("data-tippy-original-title");
          if (!content && reference.hasAttribute("title")) {
            content = reference.getAttribute("title");
            reference.setAttribute("data-tippy-original-title", content);
          }
          console.log(
            `Tippy content function for element: ${
              reference.id || "untitled"
            }. Determined content: "${content || ""}"`
          );
          return content || "";
        },
        onShow(instance) {
          const el = instance.reference;
          if (el.hasAttribute("title")) {
            if (!el.hasAttribute("data-tippy-original-title")) {
              el.setAttribute(
                "data-tippy-original-title",
                el.getAttribute("title")
              );
            }
            el.removeAttribute("title");
            console.log(`Removed title from ${el.id || "element"} in onShow.`);
          }
        },
        onHide(instance) {
          const el = instance.reference;
          const originalTitle = el.getAttribute("data-tippy-original-title");
          if (originalTitle && !el.hasAttribute("title")) {
            el.setAttribute("title", originalTitle);
            console.log(`Restored title to ${el.id || "element"} in onHide.`);
          }
        },
      }
    );

    if (newInstances) {
      tippyInstances = Array.isArray(newInstances)
        ? newInstances
        : [newInstances];
    } else {
      tippyInstances = [];
    }

    console.log(
      `Tippy.js initialized for navbar tools with theme: ${tippyTheme}. Instances: ${tippyInstances.length}`
    );
  } else {
    console.warn("Tippy.js not loaded, tooltips will be native.");
  }

  console.log("UI Initialized");
}
