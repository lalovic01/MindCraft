const themeToggleButton = document.getElementById("theme-toggle-btn");
const notificationArea = document.getElementById("notification-area");
const contextMenu = document.getElementById("context-menu");
const workspace = document.getElementById("workspace");
const nodeLayer = document.getElementById("node-layer");
const connectorLayer = document.getElementById("connector-layer");
const contextColorPicker = document.getElementById("context-color-picker");
const navbar = document.querySelector(".navbar");
const historyModal = document.getElementById("history-modal");
const closeHistoryModalButton = document.getElementById(
  "close-history-modal-btn"
);
const historyList = document.getElementById("history-list");
const iconPickerModal = document.getElementById("icon-picker-modal");
const closeIconPickerModalButton = document.getElementById(
  "close-icon-picker-modal-btn"
);
const iconListContainer = document.getElementById("icon-list-container");
const snapToGridButton = document.getElementById("snap-to-grid-btn");

const helpModal = document.getElementById("help-modal");
const closeHelpModalButton = document.getElementById("close-help-modal-btn");

const PREDEFINED_ICONS = [
  "fa-lightbulb",
  "fa-comment",
  "fa-star",
  "fa-heart",
  "fa-check",
  "fa-times",
  "fa-flag",
  "fa-tag",
  "fa-book",
  "fa-user",
  "fa-cog",
  "fa-folder",
  "fa-paperclip",
  "fa-map-marker-alt",
  "fa-exclamation-triangle",
  "fa-question-circle",
  "fa-info-circle",
  "fa-link",
  "fa-image",
  "fa-video",
  "fa-music",
  "fa-calendar-alt",
  "fa-clock",
  "fa-brain",
  "fa-atom",
  "fa-rocket",
  "fa-tree",
  "fa-cloud",
  "fa-bolt",
  "💡",
  "⭐",
  "❤️",
  "✅",
  "❌",
  "🏁",
  "🏷️",
  "📚",
  "👤",
  "⚙️",
  "📁",
  "📎",
  "📍",
  "⚠️",
  "❓",
  "ℹ️",
  "🔗",
  "🖼️",
  "🎞️",
  "🎵",
  "📅",
  "⏰",
  "🧠",
  "⚛️",
  "🚀",
  "🌳",
  "☁️",
  "⚡",
];

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
  if (!targetNode) {
    console.warn("Kontekstualni meni otvoren bez ciljnog čvora.");
    return;
  }

  const historyOption = contextMenu.querySelector('li[data-action="history"]');
  if (historyOption) {
    historyOption.style.display =
      targetNode && targetNode.history && targetNode.history.length > 0
        ? "flex"
        : "none";
  }

  console.log("Otvaranje kontekstualnog menija za čvor:", targetNode);

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

function hideContextMenu(resetTarget = true) {
  if (contextMenuVisible) {
    contextMenu.classList.remove("visible");
    setTimeout(() => {
      contextMenu.style.display = "none";
      if (resetTarget) {
        contextTargetNode = null;
      }
    }, 200);
    contextMenuVisible = false;
  }
}

function showHistoryModal(node) {
  if (!node || !node.history || node.history.length === 0) {
    showNotification("Nema istorije izmena za ovaj čvor.", "info");
    return;
  }

  historyList.innerHTML = "";

  [...node.history].reverse().forEach((entry) => {
    const listItem = document.createElement("li");

    const timestamp = new Date(entry.timestamp).toLocaleString("sr-RS", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    let iconDisplayHTML = "";
    if (entry.icon && entry.icon.trim() !== "") {
      iconDisplayHTML = `<span class="history-icon-display">${
        entry.icon.startsWith("fa-")
          ? `<i class="fas ${entry.icon}"></i>`
          : entry.icon
      }</span>`;
    } else {
      iconDisplayHTML = `<span class="history-icon-display">&nbsp;</span>`;
    }

    listItem.innerHTML = `
      <span class="history-timestamp">${timestamp}</span>
      <div class="history-entry-header">
        ${iconDisplayHTML}
        <span class="history-title">${entry.title || "Nema naslova"}</span>
      </div>
      <div class="history-description">${
        entry.description || "Nema opisa"
      }</div>
    `;
    historyList.appendChild(listItem);
  });

  historyModal.style.display = "flex";
  requestAnimationFrame(() => {
    historyModal.classList.add("visible");
  });
}

function hideHistoryModal() {
  historyModal.classList.remove("visible");
}

function showHelpModal() {
  if (helpModal) {
    helpModal.style.display = "flex";
    requestAnimationFrame(() => {
      helpModal.classList.add("visible");
    });
  }
}

function hideHelpModal() {
  if (helpModal) {
    helpModal.classList.remove("visible");
    setTimeout(() => {
      helpModal.style.display = "none";
    }, 300);
  }
}

function showIconPickerModal(node) {
  if (!node) {
    showNotification("Greška: Nije izabran čvor za promenu ikone.", "error");
    return;
  }

  iconListContainer.innerHTML = "";

  PREDEFINED_ICONS.forEach((iconCode) => {
    const iconItem = document.createElement("div");
    iconItem.classList.add("icon-grid-item");
    iconItem.dataset.icon = iconCode;
    iconItem.innerHTML = iconCode.startsWith("fa-")
      ? `<i class="fas ${iconCode}"></i>`
      : iconCode;

    iconItem.addEventListener("click", () => {
      console.log(
        `Icon clicked in picker. Icon code: "${iconCode}". Attempting to set icon for node:`,
        node
      );
      if (node) {
        if (typeof node.setIcon === "function") {
          if (node.icon !== iconCode) {
            console.log(`Calling node.setIcon("${iconCode}")`);
            node.setIcon(iconCode);
          } else {
            console.log("Icon is the same, not calling setIcon.");
          }
        } else {
          console.error("CRITICAL: node.setIcon is NOT a function!", node);
          showNotification(
            "Greška: Ne može se postaviti ikona. Metoda nije pronađena.",
            "error"
          );
        }
      } else {
        console.error(
          "CRITICAL: 'node' is null or undefined when trying to set icon from picker!"
        );
        showNotification("Greška: Ciljni čvor nije definisan.", "error");
      }
      hideIconPickerModal();
    });
    iconListContainer.appendChild(iconItem);
  });

  const removeIconItem = document.createElement("div");
  removeIconItem.classList.add("icon-grid-item");
  removeIconItem.dataset.icon = "";
  removeIconItem.innerHTML = `<i class="fas fa-ban"></i>`;
  removeIconItem.title = "Ukloni ikonu";
  removeIconItem.addEventListener("click", () => {
    console.log(
      "Remove icon clicked. Attempting to remove icon for node:",
      node
    );
    if (node) {
      if (typeof node.setIcon === "function") {
        if (node.icon !== null && node.icon !== "") {
          console.log("Calling node.setIcon(null) to remove icon.");
          node.setIcon(null);
        } else {
          console.log("Node already has no icon, not calling setIcon.");
        }
      } else {
        console.error(
          "CRITICAL: node.setIcon is NOT a function when trying to remove icon!",
          node
        );
        showNotification(
          "Greška: Ne može se ukloniti ikona. Metoda nije pronađena.",
          "error"
        );
      }
    } else {
      console.error(
        "CRITICAL: 'node' is null or undefined when trying to remove icon!"
      );
      showNotification("Greška: Ciljni čvor nije definisan.", "error");
    }
    hideIconPickerModal();
  });
  iconListContainer.appendChild(removeIconItem);

  iconPickerModal.style.display = "flex";
  requestAnimationFrame(() => {
    iconPickerModal.classList.add("visible");
  });
}

function hideIconPickerModal() {
  iconPickerModal.classList.remove("visible");
}

function updateSnapToGridButtonState(isEnabled) {
  if (snapToGridButton) {
    if (isEnabled) {
      snapToGridButton.classList.add("active");
      snapToGridButton.title = "Isključi lepljenje za mrežu";
    } else {
      snapToGridButton.classList.remove("active");
      snapToGridButton.title = "Uključi lepljenje za mrežu";
    }
  }
}

function initUI() {
  const savedTheme = loadTheme();
  applyTheme(savedTheme);

  themeToggleButton.addEventListener("click", toggleTheme);

  if (snapToGridButton) {
    snapToGridButton.addEventListener("click", () => {
      app.toggleSnapToGrid();
    });
  }
  if (
    typeof app !== "undefined" &&
    typeof app.isSnapToGridEnabled === "function"
  ) {
    updateSnapToGridButtonState(app.isSnapToGridEnabled());
  }

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

    if (!contextTargetNode && action !== "color") {
      console.error(
        "Akcija kontekstualnog menija pokrenuta, ali contextTargetNode je null."
      );
      hideContextMenu(true);
      return;
    }

    if (action !== "color" && !contextTargetNode) {
      console.error(
        `Akcija "${action}" zahteva contextTargetNode, ali je null.`
      );
      hideContextMenu(true);
      return;
    }

    if (action !== "color") {
      console.log(
        `Akcija kontekstualnog menija "${action}" izabrana za čvor:`,
        contextTargetNode.id
      );
    }

    switch (action) {
      case "edit":
        contextTargetNode.focusTitle();
        hideContextMenu(true);
        break;
      case "connect":
        app.startConnection(contextTargetNode);
        hideContextMenu(true);
        break;
      case "color":
        if (!contextTargetNode) {
          console.error(
            "Akcija 'Promeni boju' pokrenuta, ali contextTargetNode je null."
          );
          hideContextMenu(true);
          return;
        }
        console.log("Akcija Promeni boju za čvor:", contextTargetNode.id);

        contextColorPicker.oninput = (e) => {
          if (contextTargetNode) {
            contextTargetNode.setColor(e.target.value);
            app.saveState();
          } else {
            console.error(
              "contextTargetNode je null unutar color picker oninput"
            );
          }
        };

        contextColorPicker.onchange = (e) => {
          if (contextTargetNode) {
            console.log(
              "Color picker change (committed) za čvor:",
              contextTargetNode.id,
              "Nova boja:",
              e.target.value
            );
            contextTargetNode.setColor(e.target.value);
            app.saveState();
          } else {
            console.error(
              "contextTargetNode je null unutar color picker onchange"
            );
          }
          hideContextMenu(true);
        };

        contextColorPicker.click();
        break;
      case "delete":
        app.deleteNode(contextTargetNode);
        hideContextMenu(true);
        break;
      case "history":
        if (contextTargetNode) {
          showHistoryModal(contextTargetNode);
        } else {
          console.error("Pokušaj prikaza istorije bez selektovanog čvora.");
          showNotification(
            "Greška: Nije izabran čvor za prikaz istorije.",
            "error"
          );
        }
        hideContextMenu(true);
        break;
      case "icon":
        if (contextTargetNode) {
          showIconPickerModal(contextTargetNode);
        } else {
          console.error("Pokušaj izbora ikone bez selektovanog čvora.");
          showNotification(
            "Greška: Nije izabran čvor za promenu ikone.",
            "error"
          );
        }
        hideContextMenu(true);
        break;
      default:
        console.warn(`Nepoznata akcija: ${action}`);
        hideContextMenu(true);
    }
  });

  if (closeHistoryModalButton) {
    closeHistoryModalButton.addEventListener("click", hideHistoryModal);
  }
  if (historyModal) {
    historyModal.addEventListener("click", (event) => {
      if (event.target === historyModal) {
        hideHistoryModal();
      }
    });
  }

  if (closeIconPickerModalButton) {
    closeIconPickerModalButton.addEventListener("click", hideIconPickerModal);
  }
  if (iconPickerModal) {
    iconPickerModal.addEventListener("click", (event) => {
      if (event.target === iconPickerModal) {
        hideIconPickerModal();
      }
    });
  }

  if (closeHelpModalButton) {
    closeHelpModalButton.addEventListener("click", hideHelpModal);
  }
  if (helpModal) {
    helpModal.addEventListener("click", (event) => {
      if (event.target === helpModal) {
        hideHelpModal();
      }
    });
  }

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

const ui = {
  updateSnapToGridButtonState: updateSnapToGridButtonState,
  showHelpModal: showHelpModal,
};
