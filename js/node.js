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
    this.history =
      history && history.length > 0
        ? history
        : [
            {
              title: this.title,
              description: this.description,
              icon: this.icon,
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
    nodeElement.dataset.id = this.id;
    nodeElement.style.backgroundColor = this.color;

    const headerDiv = document.createElement("div");
    headerDiv.classList.add("node-header");

    const titleDiv = document.createElement("div");
    titleDiv.classList.add("node-title");
    titleDiv.setAttribute("contenteditable", "true");
    titleDiv.textContent = this.title;

    const iconSpan = document.createElement("span");
    iconSpan.classList.add("node-icon");
    iconSpan.style.display = "none";
    iconSpan.style.marginRight = "8px";

    this._updateIconElement(iconSpan, this.icon);

    headerDiv.appendChild(iconSpan);
    headerDiv.appendChild(titleDiv);

    const descriptionDiv = document.createElement("div");
    descriptionDiv.classList.add("node-description");
    descriptionDiv.setAttribute("contenteditable", "true");
    descriptionDiv.setAttribute("placeholder", "Dodaj opis...");
    descriptionDiv.textContent = this.description;
    if (!this.description) {
      descriptionDiv.classList.add("empty");
    }

    nodeElement.appendChild(headerDiv);
    nodeElement.appendChild(descriptionDiv);

    console.log(
      `Node ${this.id} element created. Initial icon: ${this.icon}, Icon span display: ${iconSpan.style.display}`
    );
    return nodeElement;
  }

  _updateIconElement(iconSpanElement, iconCode) {
    if (!iconSpanElement) return;

    iconSpanElement.innerHTML = "";

    if (iconCode) {
      if (iconCode.startsWith("fa-")) {
        const iElement = document.createElement("i");
        iElement.className = `fas ${iconCode}`;
        iconSpanElement.appendChild(iElement);
      } else {
        iconSpanElement.textContent = iconCode;
      }
      iconSpanElement.style.display = "inline-block";
    } else {
      iconSpanElement.style.display = "none";
    }
  }

  attachEventListeners() {
    const titleElement = this.element.querySelector(".node-title");
    const descriptionElement = this.element.querySelector(".node-description");

    this.element.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || app.isConnectingMode()) return;
      if (event.target.closest('[contenteditable="true"]')) return;

      event.stopPropagation();
      app.initiateDrag(this, event);
    });

    this.element.addEventListener(
      "touchstart",
      (event) => {
        if (app.isConnectingMode()) return;
        if (event.target.closest('[contenteditable="true"]')) return;

        event.stopPropagation();
        app.initiateDrag(this, event);
      },
      { passive: false }
    );

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
    const titleChanged = newTitle !== this.title;
    const descriptionChanged = newDescription !== this.description;

    if (titleChanged || descriptionChanged) {
      this.title = newTitle;
      this.description = newDescription;

      this.history.push({
        title: this.title,
        description: this.description,
        icon: this.icon,
        timestamp: Date.now(),
      });
      if (this.history.length > 10) {
        this.history.shift();
      }
      console.log(
        `Node ${this.id} content updated. History size: ${this.history.length}. Current icon in history entry: ${this.icon}`
      );
      app.saveState();
    }
  }

  setIcon(newIcon) {
    console.log(
      `--- Node ${this.id}: setIcon CALLED with newIcon: "${newIcon}" ---`
    );
    console.log(
      `Node ${this.id}: Current this.icon BEFORE any change: "${this.icon}"`
    );

    const oldIcon = this.icon;
    const normalizedNewIcon =
      newIcon === "" || newIcon === undefined ? null : newIcon;

    console.log(
      `Node ${this.id}: Values for comparison - oldIcon: "${oldIcon}", normalizedNewIcon: "${normalizedNewIcon}"`
    );

    if (oldIcon === normalizedNewIcon) {
      console.log(
        `Node ${this.id}: Icon is the same ("${oldIcon}" === "${normalizedNewIcon}"), no update needed. Exiting setIcon.`
      );
      return;
    }

    console.log(`Node ${this.id}: Icon is different. Proceeding with update.`);
    this.icon = normalizedNewIcon;
    console.log(
      `Node ${this.id}: this.icon property updated to: "${this.icon}"`
    );

    const oldElement = this.element;
    const parent = oldElement.parentNode;

    console.log(
      `Node ${this.id}: Attempting to recreate element. Current this.icon for createElement: "${this.icon}"`
    );
    this.element = this.createElement();
    console.log(
      `Node ${this.id}: New element created. Attaching listeners and updating properties.`
    );
    this.updatePosition();
    this.updateTextColor();
    this.attachEventListeners();

    if (parent && oldElement) {
      parent.replaceChild(this.element, oldElement);
      console.log(`Node ${this.id}: Element replaced in DOM.`);
    } else {
      console.error(
        `Node ${this.id}: Could not replace element in DOM. Parent: ${parent}, oldElement: ${oldElement}`
      );
    }

    if (app.getSelectedNode() && app.getSelectedNode().id === this.id) {
      console.log(`Node ${this.id}: Re-selecting node.`);
      app.selectNode(this, true);
    }

    console.log(
      `Node ${this.id}: BEFORE history push, this.icon is: "${this.icon}"`
    );

    this.history.push({
      title: this.title,
      description: this.description,
      icon: this.icon,
      timestamp: Date.now(),
    });
    if (this.history.length > 10) {
      this.history.shift();
    }

    console.log(
      `Node ${this.id}: Icon change pushed to history. History size: ${this.history.length}. Icon in new history entry: ${this.icon}`
    );
    app.saveState();
    console.log(`--- Node ${this.id}: setIcon FINISHED ---`);
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
    const node = new Node(
      data.id,
      data.x,
      data.y,
      data.title,
      data.description,
      data.color,
      data.icon,
      data.history
    );
    console.log(`Node ${node.id} deserialized with icon: ${node.icon}`);
    return node;
  }

  remove() {
    this.element.remove();
  }
}
