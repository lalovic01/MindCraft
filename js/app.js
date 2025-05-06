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

    workspace.addEventListener("mousedown", startPan);
    workspace.addEventListener("mouseup", endPan);
    workspace.addEventListener("wheel", zoom);

    window.addEventListener("mousemove", handleMouseMove);

    window.addEventListener("mouseup", handleMouseUp);

    workspace.addEventListener("click", (e) => {
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

    console.log("Initiating drag for node:", node.id);
    isDraggingNode = true;
    selectNode(node);
    node.getElement().classList.add("dragging");
    workspace.style.cursor = "grabbing";

    const nodeRect = node.getElement().getBoundingClientRect();

    const mouseX_viewport = event.clientX;
    const mouseY_viewport = event.clientY;

    const offsetX_viewport = mouseX_viewport - nodeRect.left;
    const offsetY_viewport = mouseY_viewport - nodeRect.top;

    dragOffsetX = offsetX_viewport / viewTransform.scale;
    dragOffsetY = offsetY_viewport / viewTransform.scale;

    console.log("Drag Offset X:", dragOffsetX, "Y:", dragOffsetY);
  }

  function dragNode(event) {
    if (!isDraggingNode || !selectedNode) return;
    event.preventDefault();

    const workspaceRect = workspace.getBoundingClientRect();
    const mouseX_viewport = event.clientX;
    const mouseY_viewport = event.clientY;

    const mouseX_relative_to_workspace_viewport =
      mouseX_viewport - workspaceRect.left;
    const mouseY_relative_to_workspace_viewport =
      mouseY_viewport - workspaceRect.top;

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
    const draggedNodeElement = selectedNode.getElement();
    draggedNodeElement.classList.remove("dragging");

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

  function handleMouseMove(event) {
    if (isDraggingNode) {
      dragNode(event);
    } else if (isPanning) {
      pan(event);
    }
  }

  function handleMouseUp(event) {
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
        "Prvo selektujte čvor iz kojeg želite da povučete vezu."
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
      showNotification("Ova dva čvora su već povezana.");
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
      `Povezani čvorovi: "${fromNode.title}" i "${toNode.title}".`
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

  function startPan(event) {
    const isNodeTarget = event.target.closest(".node");
    if (isDraggingNode || isConnecting || isNodeTarget) return;

    if (event.button === 0) {
      if (
        document.activeElement &&
        document.activeElement.closest('[contenteditable="true"]')
      ) {
        return;
      }
      isPanning = true;
      panStartX = event.clientX - viewTransform.x;
      panStartY = event.clientY - viewTransform.y;
      workspace.classList.add("panning");
      workspace.style.cursor = "grabbing";
    } else if (event.button === 1 && !isDraggingNode) {
      event.preventDefault();
      isPanning = true;
      panStartX = event.clientX - viewTransform.x;
      panStartY = event.clientY - viewTransform.y;
      workspace.classList.add("panning");
      workspace.style.cursor = "grabbing";
    }
  }

  function pan(event) {
    if (!isPanning) return;
    event.preventDefault();
    viewTransform.x = event.clientX - panStartX;
    viewTransform.y = event.clientY - panStartY;
    applyViewTransform();
  }

  function endPan() {
    if (!isPanning) return;
    isPanning = false;
    workspace.classList.remove("panning");
    workspace.style.cursor = "grab";
  }

  function zoom(event) {
    if (isPanning || (event.buttons & 4) === 4) {
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
      showNotification("Prethodna mapa uspešno učitana.");
    } else {
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
    showNotification("Mapa eksportovana u JSON fajl.");
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

          showNotification("Mapa uspešno uvezena iz JSON fajla.");
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
        showNotification("Mapa eksportovana kao PNG slika.");
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
  };
})();

document.addEventListener("DOMContentLoaded", app.init);
