const app = (function () {
  const workspace = document.getElementById("workspace");
  const nodeLayer = document.getElementById("node-layer");
  const connectorLayer = document.getElementById("connector-layer");
  const addNodeButton = document.getElementById("add-node-btn");
  const connectNodesButton = document.getElementById("connect-nodes-btn");
  const exportJsonButton = document.getElementById("export-json-btn");
  const importJsonInput = document.getElementById("import-json-input");
  const exportPngButton = document.getElementById("export-png-btn");

  let nodes = [];
  let connectors = [];
  let selectedNode = null;
  let isDraggingNode = false;
  let isPanning = false;
  let dragOffsetX, dragOffsetY;
  let panStartX, panStartY;
  let viewTransform = { x: 0, y: 0, scale: 1 };

  let isConnecting = false;
  let connectionStartNode = null;
  let lastDragEndTime = 0; // Timestamp of the last drag end

  function wasDragging() {
    // Consider a drag operation if it ended very recently (e.g., within 100ms)
    return Date.now() - lastDragEndTime < 100;
  }

  function isConnectingMode() {
    return isConnecting;
  }

  function init() {
    console.log("App Initializing...");
    initUI();
    loadState();
    setupEventListeners();
    redrawAllConnectors();
    console.log("App Initialized.");
  }

  function setupEventListeners() {
    addNodeButton.addEventListener("click", () => addNode());
    connectNodesButton.addEventListener("click", toggleConnectionMode);
    exportJsonButton.addEventListener("click", exportMapJson);
    importJsonInput.addEventListener("change", importMapJson);
    exportPngButton.addEventListener("click", exportMapPng);

    // Mouse pan events
    workspace.addEventListener("mousedown", handlePanStart);
    // Touch pan events
    workspace.addEventListener("touchstart", handlePanStart, {
      passive: false,
    });

    // Mouse move for drag/pan
    window.addEventListener("mousemove", handleGenericMove);
    // Touch move for drag/pan
    window.addEventListener("touchmove", handleGenericMove, { passive: false });

    // Mouse up for ending drag/pan
    window.addEventListener("mouseup", handleGenericEnd);
    // Touch up for ending drag/pan
    window.addEventListener("touchend", handleGenericEnd);
    window.addEventListener("touchcancel", handleGenericEnd);

    workspace.addEventListener("wheel", zoom, { passive: false });

    workspace.addEventListener("click", (e) => {
      if (wasDragging()) return; // If a drag just ended, don't deselect/cancel connection
      if (
        e.target === workspace ||
        e.target === nodeLayer ||
        e.target === connectorLayer
      ) {
        deselectNode();
        if (isConnecting && connectionStartNode) {
          cancelConnectionMode();
        }
      }
    });
  }

  function addNode(x, y) {
    if (x === undefined || y === undefined) {
      const rect = workspace.getBoundingClientRect();

      x = (rect.width / 2 - viewTransform.x) / viewTransform.scale;
      y = (rect.height / 2 - viewTransform.y) / viewTransform.scale;
    }

    const newNode = new Node(null, x, y);
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

    const connectorsToRemove = connectors.filter(
      (conn) => conn.fromNodeId === nodeId || conn.toNodeId === nodeId
    );
    connectorsToRemove.forEach((conn) => removeConnector(conn));

    if (selectedNode && selectedNode.id === nodeId) {
      selectedNode = null;
    }

    showNotification(`Ideja "${nodeToDelete.title}" obrisana.`);
    saveState();
  }

  function findNodeById(id) {
    return nodes.find((node) => node.id === id);
  }

  function selectNode(nodeToSelect) {
    if (wasDragging() && selectedNode === nodeToSelect) {
      // If it was a drag of the currently selected node, don't re-process selection
      return;
    }

    if (
      isConnecting &&
      connectionStartNode &&
      nodeToSelect !== connectionStartNode
    ) {
      createConnector(connectionStartNode, nodeToSelect);
      cancelConnectionMode();
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
    // For touch events, event.button is undefined.
    if (event.type === "mousedown" && event.button !== 0) return;

    console.log("Initiating drag for node:", node.id);
    isDraggingNode = true;
    selectNode(node); // Select the node being dragged
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
      event.preventDefault(); // Prevent scrolling while dragging a node
    }
  }

  function dragNode(event) {
    if (!isDraggingNode || !selectedNode) return;
    // No preventDefault here, as it's called in handleGenericMove for touchmove

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

    const newX = mouseX_in_nodelayer - dragOffsetX;
    const newY = mouseY_in_nodelayer - dragOffsetY;

    selectedNode.x = newX;
    selectedNode.y = newY;
    selectedNode.updatePosition();
  }

  function endDragNode() {
    if (!isDraggingNode || !selectedNode) return;
    console.log("Ending drag for node:", selectedNode.id);
    lastDragEndTime = Date.now(); // Record drag end time
    const draggedNodeElement = selectedNode.getElement();
    draggedNodeElement.classList.remove("dragging");

    // Add class to trigger bounce animation
    draggedNodeElement.classList.add("dropped");
    // Remove the class after the animation completes
    setTimeout(() => {
      if (draggedNodeElement) {
        draggedNodeElement.classList.remove("dropped");
      }
    }, 500); // Duration of the dragBounceDrop animation

    draggedNodeElement.classList.add("dragging-ended-recently");
    setTimeout(() => {
      if (draggedNodeElement) {
        draggedNodeElement.classList.remove("dragging-ended-recently");
      }
    }, 50);

    isDraggingNode = false;

    if (!isPanning) {
      // Check isPanning, not event type, as pan might also end
      workspace.style.cursor = "grab";
    }
    saveState();
  }

  function handleGenericMove(event) {
    if (isDraggingNode) {
      if (event.type === "touchmove") event.preventDefault(); // Prevent scroll during drag
      dragNode(event);
    } else if (isPanning) {
      if (event.type === "touchmove") event.preventDefault(); // Prevent scroll during pan
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

  function toggleConnectionMode() {
    if (isConnecting) {
      cancelConnectionMode();
    } else if (selectedNode) {
      startConnection(selectedNode);
    } else {
      showNotification(
        "Prvo selektujte čvor iz kojeg želite da povučete vezu.",
        "warning" // Added type
      );
    }
  }

  function startConnection(node) {
    isConnecting = true;
    connectionStartNode = node;
    workspace.classList.add("connecting");
    node.getElement().classList.add("connecting-start");
    connectNodesButton.classList.add("active");
    connectNodesButton.innerHTML = '<i class="fas fa-times"></i> Otkaži';
    showNotification(
      `Kliknite na drugi čvor da biste ga povezali sa "${node.title}" ili kliknite na prazno da otkažete.`
    );
    deselectNode();
  }

  function cancelConnectionMode() {
    if (!isConnecting) return;
    isConnecting = false;
    workspace.classList.remove("connecting");
    if (connectionStartNode) {
      connectionStartNode.getElement().classList.remove("connecting-start");
      connectionStartNode = null;
    }
    connectNodesButton.classList.remove("active");
    connectNodesButton.innerHTML = '<i class="fas fa-link"></i> Poveži';
  }

  function createConnector(fromNode, toNode) {
    if (!fromNode || !toNode || fromNode === toNode) return;

    const existing = connectors.find(
      (conn) =>
        (conn.fromNodeId === fromNode.id && conn.toNodeId === toNode.id) ||
        (conn.fromNodeId === toNode.id && conn.toNodeId === fromNode.id)
    );
    if (existing) {
      showNotification("Ova dva čvora su već povezana.", "warning"); // Added type
      return;
    }

    const connectorId = `conn_${fromNode.id}_${toNode.id}`;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("id", connectorId);
    line.classList.add("connector-line");

    const newConnector = {
      id: connectorId,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      element: line,
    };

    connectors.push(newConnector);
    connectorLayer.appendChild(line);
    updateConnectorPosition(newConnector);
    showNotification(
      `Povezani čvorovi: "${fromNode.title}" i "${toNode.title}".`,
      "success" // Added type
    );
    saveState();
  }

  function removeConnector(connectorToRemove) {
    if (!connectorToRemove) return;

    connectors = connectors.filter((conn) => conn.id !== connectorToRemove.id);

    if (connectorToRemove.element) {
      connectorToRemove.element.remove();
    }
  }

  function updateConnectorPosition(connector) {
    const fromNode = findNodeById(connector.fromNodeId);
    const toNode = findNodeById(connector.toNodeId);
    if (!fromNode || !toNode || !connector.element) return;

    const line = connector.element;
    const fromRect = fromNode.getElement().getBoundingClientRect();
    const toRect = toNode.getElement().getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();

    const fromCenterX = fromRect.left + fromRect.width / 2;
    const fromCenterY = fromRect.top + fromRect.height / 2;
    const toCenterX = toRect.left + toRect.width / 2;
    const toCenterY = toRect.top + toRect.height / 2;

    const svgX1 =
      (fromCenterX - workspaceRect.left - viewTransform.x) /
      viewTransform.scale;
    const svgY1 =
      (fromCenterY - workspaceRect.top - viewTransform.y) / viewTransform.scale;
    const svgX2 =
      (toCenterX - workspaceRect.left - viewTransform.x) / viewTransform.scale;
    const svgY2 =
      (toCenterY - workspaceRect.top - viewTransform.y) / viewTransform.scale;

    line.setAttribute("x1", svgX1);
    line.setAttribute("y1", svgY1);
    line.setAttribute("x2", svgX2);
    line.setAttribute("y2", svgY2);
  }

  function updateConnectorsForNode(node) {
    connectors.forEach((conn) => {
      if (conn.fromNodeId === node.id || conn.toNodeId === node.id) {
        updateConnectorPosition(conn);
      }
    });
  }

  function redrawAllConnectors() {
    connectors.forEach((conn) => {
      if (!conn.element) {
        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        line.setAttribute("id", conn.id);
        line.classList.add("connector-line");
        conn.element = line;
        connectorLayer.appendChild(line);
      }
      updateConnectorPosition(conn);
    });
  }

  function applyViewTransform() {
    nodeLayer.style.transform = `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`;
    connectorLayer.style.transform = `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`;
  }

  function handlePanStart(event) {
    const isNodeTarget = event.target.closest(".node");
    // For touch events, event.button is undefined.
    // For mousedown, check event.button.
    const isPrimaryAction =
      event.type === "touchstart" ||
      (event.type === "mousedown" && event.button === 0);
    const isMiddleMousePan =
      event.type === "mousedown" && event.button === 1 && !isDraggingNode;

    if (
      isDraggingNode ||
      isConnecting ||
      isNodeTarget ||
      !(isPrimaryAction || isMiddleMousePan)
    )
      return;

    if (event.type === "mousedown" && event.button === 0) {
      if (
        document.activeElement &&
        document.activeElement.closest('[contenteditable="true"]')
      ) {
        return; // Don't pan if starting on editable content
      }
    }

    if (event.type.startsWith("touch")) {
      event.preventDefault(); // Prevent default touch actions like scrolling or zooming
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
    // No preventDefault here, as it's called in handleGenericMove for touchmove

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
    // Prevent zoom if a pan just ended (middle mouse release might trigger wheel)
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
  }

  function saveState() {
    const data = {
      nodes: nodes.map((node) => node.serialize()),
      connectors: connectors.map((conn) => ({
        id: conn.id,
        fromNodeId: conn.fromNodeId,
        toNodeId: conn.toNodeId,
      })),
      viewTransform: viewTransform,
    };
    saveMapData(data);
    console.log("Application state saved.");
  }

  function loadState() {
    const data = loadMapData();
    if (data) {
      clearWorkspace();

      if (data.viewTransform) {
        viewTransform = data.viewTransform;
        applyViewTransform();
      }

      if (data.nodes) {
        nodes = data.nodes.map((nodeData) => {
          const node = Node.deserialize(nodeData);
          nodeLayer.appendChild(node.getElement());

          return node;
        });
      }

      if (data.connectors) {
        const loadedConnectors = data.connectors
          .map((connData) => {
            const fromNode = findNodeById(connData.fromNodeId);
            const toNode = findNodeById(connData.toNodeId);
            if (fromNode && toNode) {
              const line = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "line"
              );
              line.setAttribute("id", connData.id);
              line.classList.add("connector-line");
              connectorLayer.appendChild(line);
              return {
                id: connData.id,
                fromNodeId: connData.fromNodeId,
                toNodeId: connData.toNodeId,
                element: line,
              };
            }
            return null;
          })
          .filter((conn) => conn !== null);

        connectors = loadedConnectors;
        redrawAllConnectors();
      }

      console.log("Application state loaded.");
      showNotification("Prethodna mapa uspešno učitana.", "success"); // Added type
    } else {
      // Optional: Show a notification if no data was loaded
      // showNotification("Započnite kreiranjem nove ideje!", "info");
    }
  }

  function clearWorkspace() {
    nodes.forEach((node) => node.remove());
    nodes = [];

    connectors.forEach((conn) => {
      if (conn.element) conn.element.remove();
    });
    connectors = [];

    selectedNode = null;
    isConnecting = false;
    connectionStartNode = null;
  }

  function exportMapJson() {
    const data = {
      nodes: nodes.map((node) => node.serialize()),
      connectors: connectors.map((conn) => ({
        id: conn.id,
        fromNodeId: conn.fromNodeId,
        toNodeId: conn.toNodeId,
      })),
      viewTransform: viewTransform,
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
    showNotification("Mapa eksportovana u JSON fajl.", "success"); // Added type
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
            applyViewTransform();
          }
          nodes = data.nodes.map((nodeData) => {
            const node = Node.deserialize(nodeData);
            nodeLayer.appendChild(node.getElement());

            return node;
          });
          const loadedConnectors = data.connectors
            .map((connData) => {
              const fromNode = findNodeById(connData.fromNodeId);
              const toNode = findNodeById(connData.toNodeId);
              if (fromNode && toNode) {
                const line = document.createElementNS(
                  "http://www.w3.org/2000/svg",
                  "line"
                );
                line.setAttribute("id", connData.id);
                line.classList.add("connector-line");
                connectorLayer.appendChild(line);
                return {
                  id: connData.id,
                  fromNodeId: connData.fromNodeId,
                  toNodeId: connData.toNodeId,
                  element: line,
                };
              }
              return null;
            })
            .filter((conn) => conn !== null);
          connectors = loadedConnectors;
          redrawAllConnectors();

          showNotification("Mapa uspešno uvezena iz JSON fajla.", "success"); // Added type
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
    showNotification("Priprema PNG eksport..."); // Default info type

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
        showNotification("Mapa eksportovana kao PNG slika.", "success"); // Added type
      })
      .catch(function (error) {
        console.error("Greška tokom dom-to-image eksporta:", error);
        showNotification(
          `Greška pri kreiranju PNG slike: ${error.message || error}`,
          "error"
        );
      });
  }

  return {
    init: init,
    addNode: addNode,
    deleteNode: deleteNode,
    findNodeById: findNodeById,
    selectNode: selectNode,
    updateConnectorsForNode: updateConnectorsForNode,
    saveState: saveState,
    startConnection: startConnection,
    initiateDrag: initiateDrag,
    isConnectingMode: isConnectingMode,
    wasDragging: wasDragging, // Expose wasDragging
  };
})();

document.addEventListener("DOMContentLoaded", app.init);
