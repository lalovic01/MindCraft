class Node {
  constructor(
    id,
    x,
    y,
    title = "Nova ideja",
    description = "",
    color = "#ffffff",
    icon = null,
    history = []
  ) {
    this.id =
      id || `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.x = x;
    this.y = y;
    this.title = title;
    this.description = description;
    this.color = color;
    this.icon = icon;
    this.history = history || [
      {
        title: this.title,
        description: this.description,
        timestamp: Date.now(),
      },
    ];

    this.element = this.createElement();
    this.updatePosition();
    this.updateTextColor();
    this.attachEventListeners();
  }

  createElement() {
    const nodeElement = document.createElement("div");
    nodeElement.classList.add("node");
    nodeElement.dataset.id = this.id; // Osiguravamo da je dataset.id postavljen
    nodeElement.style.backgroundColor = this.color;

    nodeElement.innerHTML = `
      <div class="node-header">
        ${
          this.icon
            ? `<span class="node-icon">${
                this.icon.startsWith("fa-")
                  ? `<i class="fas ${this.icon}"></i>`
                  : this.icon
              }</span>`
            : ""
        }
        <div class="node-title" contenteditable="true">${this.title}</div>
      </div>
      <div class="node-description" contenteditable="true" placeholder="Dodaj opis...">${
        this.description
      }</div>
    `;

    const descElement = nodeElement.querySelector(".node-description");
    if (!this.description) {
      descElement.classList.add("empty");
    }

    return nodeElement;
  }

  attachEventListeners() {
    const titleElement = this.element.querySelector(".node-title");
    const descriptionElement = this.element.querySelector(".node-description");

    // Mouse event for dragging
    this.element.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || app.isConnectingMode()) return; // Only left click
      if (event.target.closest('[contenteditable="true"]')) return;

      event.stopPropagation();
      app.initiateDrag(this, event);
    });

    // Touch event for dragging
    this.element.addEventListener(
      "touchstart",
      (event) => {
        if (app.isConnectingMode()) return;
        if (event.target.closest('[contenteditable="true"]')) return;

        // Prevent default touch action like scrolling when starting drag on a node
        // event.preventDefault(); // Consider if this is needed or if it interferes with text selection/scrolling within node
        event.stopPropagation();
        app.initiateDrag(this, event);
      },
      { passive: false }
    ); // passive: false allows preventDefault if needed later

    titleElement.addEventListener("blur", () =>
      this.updateContent(titleElement.textContent, this.description)
    );
    descriptionElement.addEventListener("blur", () => {
      this.updateContent(this.title, descriptionElement.textContent);
      descriptionElement.classList.toggle(
        "empty",
        !descriptionElement.textContent
      );
    });
    descriptionElement.addEventListener("input", () => {
      descriptionElement.classList.toggle(
        "empty",
        !descriptionElement.textContent
      );
    });

    titleElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleElement.blur();
      }
    });

    this.element.addEventListener("click", (e) => {
      if (this.element.classList.contains("dragging-ended-recently")) {
        this.element.classList.remove("dragging-ended-recently");
        return;
      }
      // Prevent node selection if it was a drag operation that just ended
      // This check might be more robust if handled within app.js endDrag
      if (app.wasDragging()) return;

      e.stopPropagation();
      app.selectNode(this);
    });
  }

  updatePosition() {
    this.element.style.left = `${this.x}px`;
    this.element.style.top = `${this.y}px`;
    app.updateConnectorsForNode(this);
  }

  updateContent(newTitle, newDescription) {
    const changed =
      newTitle !== this.title || newDescription !== this.description;
    if (changed) {
      this.title = newTitle;
      this.description = newDescription;
      this.history.push({
        title: this.title,
        description: this.description,
        timestamp: Date.now(),
      });
      if (this.history.length > 10) {
        this.history.shift();
      }
      console.log(
        `Node ${this.id} content updated. History size: ${this.history.length}`
      );
      app.saveState();
    }
  }

  setColor(newColor) {
    if (this.color !== newColor) {
      this.color = newColor;
      this.element.style.backgroundColor = this.color;
      this.updateTextColor();
      app.saveState();
    }
  }

  updateTextColor() {
    if (!this.element) return;

    const rgb = parseInt(this.color.substring(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    if (luminance < 140) {
      this.element.style.color = "#ffffff";
    } else {
      this.element.style.color = "#333333";
    }
  }

  focusTitle() {
    const titleElement = this.element.querySelector(".node-title");
    titleElement.focus();
    document.execCommand("selectAll", false, null);
    document.getSelection().collapseToEnd();
  }

  getElement() {
    return this.element;
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      title: this.title,
      description: this.description,
      color: this.color,
      icon: this.icon,
      history: this.history,
    };
  }

  static deserialize(data) {
    return new Node(
      data.id,
      data.x,
      data.y,
      data.title,
      data.description,
      data.color,
      data.icon,
      data.history
    );
  }

  remove() {
    this.element.remove();
  }
}
