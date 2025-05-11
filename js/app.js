const app = (function () {
  const workspace = document.getElementById("workspace");
  const nodeLayer = document.getElementById("node-layer");
  const connectorLayer = document.getElementById("connector-layer");
  const addNodeButton = document.getElementById("add-node-btn");
  const newProjectButton = document.getElementById("new-project-btn");
  const connectNodesButton = document.getElementById("connect-nodes-btn");
  const exportJsonButton = document.getElementById("export-json-btn");
  const importJsonInput = document.getElementById("import-json-input");
  const exportPngButton = document.getElementById("export-png-btn");
  const exportPdfButton = document.getElementById("export-pdf-btn");
  const helpButton = document.getElementById("help-btn");

  const GRID_SIZE = 20;
  let nodes = [];
  let selectedNode = null;
  let isDraggingNode = false;
  let isPanning = false;
  let dragOffsetX, dragOffsetY;
  let panStartX, panStartY;
  let viewTransform = { x: 0, y: 0, scale: 1 };
  let snapToGridEnabled = false;
  let lastDragEndTime = 0;

  function getSelectedNode() {
    return selectedNode;
  }

  function wasDragging() {
    return Date.now() - lastDragEndTime < 100;
  }

  function isConnectingMode() {
    return isConnecting;
  }

  function isSnapToGridEnabled() {
    return snapToGridEnabled;
  }

  function init() {
    console.log("App Initializing...");
    initUI();

    connectorManager.init(
      findNodeById,
      saveState,
      showNotification,
      deselectNode,
      getSelectedNode,
      workspace,
      connectorLayer,
      connectNodesButton
    );

    loadState();
    setupEventListeners();
    console.log("App Initialized.");
  }

  function setupEventListeners() {
    addNodeButton.addEventListener("click", () => addNode());
    newProjectButton.addEventListener("click", createNewProject);
    exportJsonButton.addEventListener("click", exportMapJson);
    importJsonInput.addEventListener("change", importMapJson);
    exportPngButton.addEventListener("click", exportMapPng);
    exportPdfButton.addEventListener("click", exportMapPdf);
    helpButton.addEventListener("click", () => ui.showHelpModal());
    workspace.addEventListener("mousedown", handlePanStart);
    workspace.addEventListener("touchstart", handlePanStart, {
      passive: false,
    });

    window.addEventListener("mousemove", handleGenericMove);
    window.addEventListener("touchmove", handleGenericMove, { passive: false });

    window.addEventListener("mouseup", handleGenericEnd);
    window.addEventListener("touchend", handleGenericEnd);
    window.addEventListener("touchcancel", handleGenericEnd);

    workspace.addEventListener("wheel", zoom, { passive: false });
    window.addEventListener("resize", handleWindowResize);

    workspace.addEventListener("click", (e) => {
      if (wasDragging()) return;
      if (
        e.target === workspace ||
        e.target === nodeLayer ||
        e.target === connectorLayer
      ) {
        deselectNode();
        if (connectorManager.isConnectingMode()) {
          connectorManager.cancelConnectionMode();
        }
      }
    });

    workspace.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const targetNodeElement = event.target.closest(".node");
      if (!targetNodeElement) {
        console.warn("Desni klik nije detektovao čvor.");
        return;
      }

      const nodeId = targetNodeElement.dataset.id;
      if (!nodeId) {
        console.error("Čvor nema dataset.id:", targetNodeElement);
        return;
      }

      const targetNodeInstance = app.findNodeById(nodeId);
      if (!targetNodeInstance) {
        console.error("Čvor nije pronađen u aplikaciji za ID:", nodeId);
        return;
      }

      console.log("Pronađen čvor za kontekstualni meni:", targetNodeInstance);
      showContextMenu(event.clientX, event.clientY, targetNodeInstance);
    });
  }

  function addNode(x, y) {
    if (x === undefined || y === undefined) {
      const rect = workspace.getBoundingClientRect();

      const viewportCenterX = rect.width / 2;
      const viewportCenterY = rect.height / 2;

      x = (viewportCenterX - viewTransform.x) / viewTransform.scale;
      y = (viewportCenterY - viewTransform.y) / viewTransform.scale;
    }

    const newNode = new Node(null, x, y, "Nova ideja", "", "#ffffff", null);
    nodes.push(newNode);
    nodeLayer.appendChild(newNode.getElement());

    showNotification(`Ideja "${newNode.title}" dodata.`);
    saveState();
    return newNode;
  }

  function deleteNode(nodeToDelete) {
    if (!nodeToDelete) return;

    const nodeId = nodeToDelete.id;

    nodes = nodes.filter((node) => node.id !== nodeId);

    nodeToDelete.remove();

    connectorManager.removeConnectorsForNode(nodeId);

    if (selectedNode && selectedNode.id === nodeId) {
      selectedNode = null;
    }

    showNotification(`Ideja "${nodeToDelete.title}" obrisana.`);
    saveState();
  }

  function findNodeById(id) {
    return nodes.find((node) => node.id === id);
  }

  function selectNode(nodeToSelect, internalCall = false) {
    if (!internalCall && wasDragging() && selectedNode === nodeToSelect) {
      return;
    }

    if (
      !internalCall &&
      connectorManager.isConnectingMode() &&
      connectorManager.getConnectionStartNode() &&
      nodeToSelect !== connectorManager.getConnectionStartNode()
    ) {
      if (
        connectorManager.createConnector(
          connectorManager.getConnectionStartNode(),
          nodeToSelect
        )
      ) {
        connectorManager.cancelConnectionMode();
      }
      return;
    }

    if (selectedNode && selectedNode !== nodeToSelect) {
      selectedNode.getElement().classList.remove("selected");
    }
    if (nodeToSelect) {
      selectedNode = nodeToSelect;
      selectedNode.getElement().classList.add("selected");
    } else {
      selectedNode = null;
    }
  }

  function deselectNode() {
    if (selectedNode) {
      selectedNode.getElement().classList.remove("selected");
      selectedNode = null;
    }
  }

  function initiateDrag(node, event) {
    if (isPanning) return;
    if (event.type === "mousedown" && event.button !== 0) return;

    console.log("Initiating drag for node:", node.id);
    isDraggingNode = true;
    selectNode(node);
    node.getElement().classList.add("dragging");
    workspace.style.cursor = "grabbing";

    const nodeRect = node.getElement().getBoundingClientRect();
    const clientX = event.type.startsWith("touch")
      ? event.touches[0].clientX
      : event.clientX;
    const clientY = event.type.startsWith("touch")
      ? event.touches[0].clientY
      : event.clientY;

    const offsetX_viewport = clientX - nodeRect.left;
    const offsetY_viewport = clientY - nodeRect.top;

    dragOffsetX = offsetX_viewport / viewTransform.scale;
    dragOffsetY = offsetY_viewport / viewTransform.scale;

    console.log("Drag Offset X:", dragOffsetX, "Y:", dragOffsetY);
    if (event.type.startsWith("touch")) {
      event.preventDefault();
    }
  }

  function dragNode(event) {
    if (!isDraggingNode || !selectedNode) return;

    const workspaceRect = workspace.getBoundingClientRect();
    const clientX = event.type.startsWith("touch")
      ? event.touches[0].clientX
      : event.clientX;
    const clientY = event.type.startsWith("touch")
      ? event.touches[0].clientY
      : event.clientY;

    const mouseX_relative_to_workspace_viewport = clientX - workspaceRect.left;
    const mouseY_relative_to_workspace_viewport = clientY - workspaceRect.top;

    const mouseX_in_nodelayer =
      (mouseX_relative_to_workspace_viewport - viewTransform.x) /
      viewTransform.scale;
    const mouseY_in_nodelayer =
      (mouseY_relative_to_workspace_viewport - viewTransform.y) /
      viewTransform.scale;

    let newX = mouseX_in_nodelayer - dragOffsetX;
    let newY = mouseY_in_nodelayer - dragOffsetY;

    if (snapToGridEnabled) {
      newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
      newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
    }

    selectedNode.x = newX;
    selectedNode.y = newY;
    selectedNode.updatePosition();
  }

  function endDragNode() {
    if (!isDraggingNode || !selectedNode) return;
    console.log("Ending drag for node:", selectedNode.id);
    lastDragEndTime = Date.now();
    const draggedNodeElement = selectedNode.getElement();
    draggedNodeElement.classList.remove("dragging");

    draggedNodeElement.classList.add("dropped");
    setTimeout(() => {
      if (draggedNodeElement) {
        draggedNodeElement.classList.remove("dropped");
      }
    }, 500);

    draggedNodeElement.classList.add("dragging-ended-recently");
    setTimeout(() => {
      if (draggedNodeElement) {
        draggedNodeElement.classList.remove("dragging-ended-recently");
      }
    }, 50);

    isDraggingNode = false;

    if (!isPanning) {
      workspace.style.cursor = "grab";
    }
    saveState();
  }

  function handleGenericMove(event) {
    if (isDraggingNode) {
      if (event.type === "touchmove") event.preventDefault();
      dragNode(event);
    } else if (isPanning) {
      if (event.type === "touchmove") event.preventDefault();
      pan(event);
    }
  }

  function handleGenericEnd(event) {
    if (isDraggingNode) {
      endDragNode();
    }
    if (isPanning) {
      endPan();
    }
  }

  function updateConnectorsForNode(node) {
    connectorManager.updateConnectorsForNode(node);
  }

  function redrawAllConnectors() {
    connectorManager.redrawAllConnectors();
  }

  function applyViewTransform() {
    nodeLayer.style.transform = `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`;
    connectorLayer.style.transform = `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`;

    if (workspace.classList.contains("grid-visible")) {
      const scaledGridSize = GRID_SIZE * viewTransform.scale;

      if (
        scaledGridSize >= 1 &&
        workspace.offsetWidth > 0 &&
        workspace.offsetHeight > 0 &&
        scaledGridSize < workspace.offsetWidth * 4 &&
        scaledGridSize < workspace.offsetHeight * 4
      ) {
        workspace.style.backgroundSize = `${scaledGridSize}px ${scaledGridSize}px`;
        const xPos = viewTransform.x % scaledGridSize;
        const yPos = viewTransform.y % scaledGridSize;
        workspace.style.backgroundPosition = `${xPos}px ${yPos}px`;
        console.log(
          `[Grid Debug] Grid APPLIED. Size: ${scaledGridSize.toFixed(
            2
          )}px, Position: ${xPos.toFixed(2)}px ${yPos.toFixed(2)}px`
        );
      } else {
        workspace.style.backgroundSize = "0 0";
        workspace.style.backgroundPosition = "0 0";
        console.log(
          `[Grid Debug] Grid HIDDEN. Reason: scaledGridSize (${scaledGridSize.toFixed(
            4
          )}) is out of range or workspace dimensions are zero.`
        );
        if (scaledGridSize < 1)
          console.log("[Grid Debug] Reason detail: scaledGridSize < 1");
        if (workspace.offsetWidth <= 0)
          console.log("[Grid Debug] Reason detail: workspace.offsetWidth <= 0");
        if (workspace.offsetHeight <= 0)
          console.log(
            "[Grid Debug] Reason detail: workspace.offsetHeight <= 0"
          );
        if (scaledGridSize >= workspace.offsetWidth * 4)
          console.log(
            "[Grid Debug] Reason detail: scaledGridSize too large for width"
          );
        if (scaledGridSize >= workspace.offsetHeight * 4)
          console.log(
            "[Grid Debug] Reason detail: scaledGridSize too large for height"
          );
      }
    } else {
      workspace.style.backgroundSize = "";
      workspace.style.backgroundPosition = "";
      console.log(
        `[Grid Debug] Grid NOT APPLIED. Class 'grid-visible' is ABSENT.`
      );
    }
  }

  function handlePanStart(event) {
    const isNodeTarget = event.target.closest(".node");
    const isPrimaryAction =
      event.type === "touchstart" ||
      (event.type === "mousedown" && event.button === 0);
    const isMiddleMousePan =
      event.type === "mousedown" && event.button === 1 && !isDraggingNode;

    if (
      isDraggingNode ||
      connectorManager.isConnectingMode() ||
      isNodeTarget ||
      !(isPrimaryAction || isMiddleMousePan)
    )
      return;

    if (event.type === "mousedown" && event.button === 0) {
      if (
        document.activeElement &&
        document.activeElement.closest('[contenteditable="true"]')
      ) {
        return;
      }
    }

    if (event.type.startsWith("touch")) {
      event.preventDefault();
    }

    isPanning = true;
    const clientX = event.type.startsWith("touch")
      ? event.touches[0].clientX
      : event.clientX;
    const clientY = event.type.startsWith("touch")
      ? event.touches[0].clientY
      : event.clientY;

    panStartX = clientX - viewTransform.x;
    panStartY = clientY - viewTransform.y;
    workspace.classList.add("panning");
    workspace.style.cursor = "grabbing";
  }

  function pan(event) {
    if (!isPanning) return;

    const clientX = event.type.startsWith("touch")
      ? event.touches[0].clientX
      : event.clientX;
    const clientY = event.type.startsWith("touch")
      ? event.touches[0].clientY
      : event.clientY;

    viewTransform.x = clientX - panStartX;
    viewTransform.y = clientY - panStartY;
    applyViewTransform();
  }

  function endPan() {
    if (!isPanning) return;
    isPanning = false;
    workspace.classList.remove("panning");
    workspace.style.cursor = "grab";
  }

  function zoom(event) {
    if (
      isPanning ||
      (event.buttons & 4) === 4 ||
      Date.now() - lastDragEndTime < 50
    ) {
      return;
    }
    event.preventDefault();

    const scaleAmount = 0.05;
    const workspaceRect = workspace.getBoundingClientRect();

    const centerX = workspaceRect.width / 2;
    const centerY = workspaceRect.height / 2;

    const worldCenterX_before =
      (centerX - viewTransform.x) / viewTransform.scale;
    const worldCenterY_before =
      (centerY - viewTransform.y) / viewTransform.scale;

    let oldScale = viewTransform.scale;
    let newScale = viewTransform.scale;

    if (event.deltaY < 0) {
      newScale = Math.min(oldScale * (1 + scaleAmount), 3);
    } else {
      newScale = Math.max(oldScale * (1 - scaleAmount), 0.2);
    }

    if (newScale === oldScale) {
      return;
    }

    viewTransform.scale = newScale;

    viewTransform.x = centerX - worldCenterX_before * newScale;
    viewTransform.y = centerY - worldCenterY_before * newScale;

    applyViewTransform();
    requestAnimationFrame(redrawAllConnectors);
  }

  function handleWindowResize() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        console.log(
          "Window resized, redrawing connectors via double requestAnimationFrame."
        );
        applyViewTransform();
        redrawAllConnectors();
      });
    });
  }

  function saveState() {
    const data = {
      nodes: nodes.map((node) => node.serialize()),
      connectors: connectorManager.getSerializedData(),
      viewTransform: viewTransform,
      snapToGridEnabled: snapToGridEnabled,
    };
    saveMapData(data);
    console.log("Application state saved.");
  }

  function loadState() {
    const data = loadMapData();
    if (data) {
      clearWorkspace();

      viewTransform = data.viewTransform || { x: 0, y: 0, scale: 1 };
      snapToGridEnabled = data.snapToGridEnabled === true;

      console.log(
        `[Grid Debug] Loaded snapToGridEnabled: ${snapToGridEnabled}`
      );
      if (snapToGridEnabled) {
        workspace.classList.add("grid-visible");
      } else {
        workspace.classList.remove("grid-visible");
      }

      if (
        typeof ui !== "undefined" &&
        typeof ui.updateSnapToGridButtonState === "function"
      ) {
        ui.updateSnapToGridButtonState(snapToGridEnabled);
      }

      if (data.nodes) {
        nodes = data.nodes.map((nodeData) => {
          const node = Node.deserialize(nodeData);
          nodeLayer.appendChild(node.getElement());

          return node;
        });
      }

      if (data.connectors) {
        connectorManager.loadSerializedData(data.connectors);
      }

      console.log("Application state loaded.");
      showNotification("Prethodna mapa uspešno učitana.", "success");
    } else {
      showNotification("Započnite kreiranjem nove ideje!", "info");
      clearWorkspace();
      viewTransform = { x: 0, y: 0, scale: 1 };
      snapToGridEnabled = false;
      workspace.classList.remove("grid-visible");
      console.log(
        `[Grid Debug] New map or no data, snapToGridEnabled: ${snapToGridEnabled}`
      );

      if (
        typeof ui !== "undefined" &&
        typeof ui.updateSnapToGridButtonState === "function"
      ) {
        ui.updateSnapToGridButtonState(snapToGridEnabled);
      }
    }
    applyViewTransform();
    requestAnimationFrame(redrawAllConnectors);
  }

  function clearWorkspace() {
    nodes.forEach((node) => node.remove());
    nodes = [];
    connectorManager.clearData();

    selectedNode = null;
  }

  function exportMapJson() {
    const data = {
      nodes: nodes.map((node) => node.serialize()),
      connectors: connectorManager.getSerializedData(),
      viewTransform: viewTransform,
      snapToGridEnabled: snapToGridEnabled,
    };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mindcraft_map.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification("Mapa eksportovana u JSON fajl.", "success");
  }

  function importMapJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);

        if (
          data &&
          Array.isArray(data.nodes) &&
          Array.isArray(data.connectors)
        ) {
          clearWorkspace();

          if (data.viewTransform) {
            viewTransform = data.viewTransform;
          }

          snapToGridEnabled = data.snapToGridEnabled === true;
          console.log(
            `[Grid Debug] Imported snapToGridEnabled: ${snapToGridEnabled}`
          );
          if (snapToGridEnabled) {
            workspace.classList.add("grid-visible");
          } else {
            workspace.classList.remove("grid-visible");
          }
          if (
            typeof ui !== "undefined" &&
            typeof ui.updateSnapToGridButtonState === "function"
          ) {
            ui.updateSnapToGridButtonState(snapToGridEnabled);
          }

          applyViewTransform();

          nodes = data.nodes.map((nodeData) => {
            const node = Node.deserialize(nodeData);
            nodeLayer.appendChild(node.getElement());

            return node;
          });
          if (data.connectors) {
            connectorManager.loadSerializedData(data.connectors);
          }

          showNotification("Mapa uspešno uvezena iz JSON fajla.", "success");
          saveState();
        } else {
          throw new Error("Nevažeći format JSON fajla.");
        }
      } catch (error) {
        console.error("Greška pri uvozu JSON fajla:", error);
        showNotification(`Greška pri uvozu: ${error.message}`, "error");
      } finally {
        importJsonInput.value = null;
      }
    };
    reader.readAsText(file);
  }

  function exportMapPng() {
    showNotification("Priprema PNG eksport...");

    if (typeof domtoimage === "undefined") {
      console.error("dom-to-image-more library is not loaded!");
      showNotification("Greška: Biblioteka za eksport nije učitana.", "error");
      return;
    }

    const nodeToCapture = workspace;

    const options = {
      quality: 0.95,
      bgcolor: getComputedStyle(document.body)
        .getPropertyValue("--background-main")
        .trim(),
    };

    domtoimage
      .toPng(nodeToCapture, options)
      .then(function (dataUrl) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "mindcraft_map.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showNotification("Mapa eksportovana kao PNG slika.", "success");
      })
      .catch(function (error) {
        console.error("Greška tokom dom-to-image eksporta:", error);
        showNotification(
          `Greška pri kreiranju PNG slike: ${error.message || error}`,
          "error"
        );
      });
  }

  function exportMapPdf() {
    showNotification("Priprema PDF eksport...");

    if (typeof domtoimage === "undefined") {
      console.error("dom-to-image-more library is not loaded!");
      showNotification(
        "Greška: Biblioteka za eksport (dom-to-image) nije učitana.",
        "error"
      );
      return;
    }
    if (
      typeof window.jspdf === "undefined" ||
      typeof window.jspdf.jsPDF === "undefined"
    ) {
      console.error("jsPDF library is not loaded!");
      showNotification(
        "Greška: Biblioteka za PDF eksport (jsPDF) nije učitana.",
        "error"
      );
      return;
    }

    const { jsPDF } = window.jspdf;
    const nodeToCapture = workspace;
    const options = {
      quality: 0.95,
      bgcolor: getComputedStyle(document.body)
        .getPropertyValue("--background-main")
        .trim(),
    };

    domtoimage
      .toPng(nodeToCapture, options)
      .then(function (dataUrl) {
        const img = new Image();
        img.onload = function () {
          const imgWidth = this.naturalWidth;
          const imgHeight = this.naturalHeight;

          const orientation = imgWidth > imgHeight ? "l" : "p";
          const pdf = new jsPDF(orientation, "px", [imgWidth, imgHeight]);

          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();

          pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
          pdf.save("mindcraft_map.pdf");
          showNotification("Mapa eksportovana kao PDF dokument.", "success");
        };
        img.onerror = function () {
          console.error("Greška pri učitavanju slike za PDF.");
          showNotification("Greška pri generisanju slike za PDF.", "error");
        };
        img.src = dataUrl;
      })
      .catch(function (error) {
        console.error("Greška tokom dom-to-image za PDF eksport:", error);
        showNotification(
          `Greška pri kreiranju PDF dokumenta: ${error.message || error}`,
          "error"
        );
      });
  }

  function toggleSnapToGrid() {
    snapToGridEnabled = !snapToGridEnabled;
    showNotification(
      `Lepljenje za mrežu ${snapToGridEnabled ? "uključeno" : "isključeno"}.`
    );
    console.log(
      `[Grid Debug] Toggled snapToGridEnabled to: ${snapToGridEnabled}`
    );

    if (snapToGridEnabled) {
      workspace.classList.add("grid-visible");
    } else {
      workspace.classList.remove("grid-visible");
      workspace.style.backgroundSize = "";
      workspace.style.backgroundPosition = "";
    }

    if (
      typeof ui !== "undefined" &&
      typeof ui.updateSnapToGridButtonState === "function"
    ) {
      ui.updateSnapToGridButtonState(snapToGridEnabled);
    }
    applyViewTransform();
    saveState();
  }

  function createNewProject() {
    showNotification("Kreiranje novog projekta...", "info");
    clearWorkspace();
    clearMapData();

    viewTransform = { x: 0, y: 0, scale: 1 };

    snapToGridEnabled = false;
    if (workspace.classList.contains("grid-visible")) {
      workspace.classList.remove("grid-visible");
    }
    if (
      typeof ui !== "undefined" &&
      typeof ui.updateSnapToGridButtonState === "function"
    ) {
      ui.updateSnapToGridButtonState(snapToGridEnabled);
    }

    applyViewTransform();
    requestAnimationFrame(redrawAllConnectors);

    saveState();
    showNotification(
      "Novi projekat je kreiran. Radna površina je očišćena.",
      "success"
    );
  }

  return {
    init: init,
    addNode: addNode,
    deleteNode: deleteNode,
    findNodeById: findNodeById,
    selectNode: selectNode,
    getSelectedNode: getSelectedNode,
    updateConnectorsForNode: updateConnectorsForNode,
    redrawAllConnectors: redrawAllConnectors,
    saveState: saveState,
    startConnection: (node) => connectorManager.startConnection(node),
    initiateDrag: initiateDrag,
    isConnectingMode: () => connectorManager.isConnectingMode(),
    wasDragging: wasDragging,
    toggleSnapToGrid: toggleSnapToGrid,
    isSnapToGridEnabled: isSnapToGridEnabled,
  };
})();

document.addEventListener("DOMContentLoaded", app.init);
