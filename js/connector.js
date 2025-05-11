const connectorManager = (function () {
  let connectors = [];
  let isConnecting = false;
  let connectionStartNode = null;

  let findNodeByIdCallback;
  let saveStateCallback;
  let showNotificationCallback;
  let deselectNodeCallback;
  let getSelectedNodeCallback;
  let workspaceElement;
  let connectorLayerElement;
  let connectNodesButtonElement;

  function init(
    appFindNodeById,
    appSaveState,
    uiShowNotification,
    appDeselectNode,
    appGetSelectedNode,
    domWorkspace,
    domConnectorLayer,
    domConnectNodesButton
  ) {
    findNodeByIdCallback = appFindNodeById;
    saveStateCallback = appSaveState;
    showNotificationCallback = uiShowNotification;
    deselectNodeCallback = appDeselectNode;
    getSelectedNodeCallback = appGetSelectedNode;
    workspaceElement = domWorkspace;
    connectorLayerElement = domConnectorLayer;
    connectNodesButtonElement = domConnectNodesButton;

    if (connectNodesButtonElement) {
      connectNodesButtonElement.addEventListener("click", toggleConnectionMode);
    }
  }

  function toggleConnectionMode() {
    if (isConnecting) {
      cancelConnectionMode();
    } else {
      const selectedNode = getSelectedNodeCallback();
      if (selectedNode) {
        startConnection(selectedNode);
      } else {
        showNotificationCallback(
          "Prvo selektujte čvor iz kojeg želite da povučete vezu.",
          "warning"
        );
      }
    }
  }

  function startConnection(node) {
    isConnecting = true;
    connectionStartNode = node;
    workspaceElement.classList.add("connecting");
    node.getElement().classList.add("connecting-start");
    if (connectNodesButtonElement) {
      connectNodesButtonElement.classList.add("active");
      connectNodesButtonElement.innerHTML =
        '<i class="fas fa-times"></i> Otkaži';
    }
    showNotificationCallback(
      `Kliknite na drugi čvor da biste ga povezali sa "${node.title}" ili kliknite na prazno da otkažete.`
    );
    deselectNodeCallback();
  }

  function cancelConnectionMode() {
    if (!isConnecting) return;
    isConnecting = false;
    workspaceElement.classList.remove("connecting");
    if (connectionStartNode) {
      connectionStartNode.getElement().classList.remove("connecting-start");
      connectionStartNode = null;
    }
    if (connectNodesButtonElement) {
      connectNodesButtonElement.classList.remove("active");
      connectNodesButtonElement.innerHTML =
        '<i class="fas fa-link"></i> Poveži';
    }
  }

  function createConnector(fromNode, toNode) {
    if (!fromNode || !toNode || fromNode === toNode) return;

    const existing = connectors.find(
      (conn) =>
        (conn.fromNodeId === fromNode.id && conn.toNodeId === toNode.id) ||
        (conn.fromNodeId === toNode.id && conn.toNodeId === fromNode.id)
    );
    if (existing) {
      showNotificationCallback("Ova dva čvora su već povezana.", "warning");
      return false;
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
    connectorLayerElement.appendChild(line);
    updateConnectorPosition(newConnector);
    showNotificationCallback(
      `Povezani čvorovi: "${fromNode.title}" i "${toNode.title}".`,
      "success"
    );
    saveStateCallback();
    return true;
  }

  function removeConnectorObject(connectorToRemove) {
    if (!connectorToRemove) return;
    connectors = connectors.filter((conn) => conn.id !== connectorToRemove.id);
    if (connectorToRemove.element) {
      connectorToRemove.element.remove();
    }
  }

  function removeConnectorsForNode(nodeId) {
    const toRemove = connectors.filter(
      (conn) => conn.fromNodeId === nodeId || conn.toNodeId === nodeId
    );
    toRemove.forEach(removeConnectorObject);
    if (toRemove.length > 0) {
    }
  }

  function updateConnectorPosition(connector) {
    const fromNode = findNodeByIdCallback(connector.fromNodeId);
    const toNode = findNodeByIdCallback(connector.toNodeId);
    if (!fromNode || !toNode || !connector.element) {
      return;
    }

    const line = connector.element;
    const fromNodeEl = fromNode.getElement();
    const toNodeEl = toNode.getElement();

    if (!fromNodeEl || !toNodeEl) {
      return;
    }

    const svgX1 = fromNode.x + fromNodeEl.offsetWidth / 2;
    const svgY1 = fromNode.y + fromNodeEl.offsetHeight / 2;
    const svgX2 = toNode.x + toNodeEl.offsetWidth / 2;
    const svgY2 = toNode.y + toNodeEl.offsetHeight / 2;

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
        connectorLayerElement.appendChild(line);
      }
      updateConnectorPosition(conn);
    });
  }

  function getSerializedData() {
    return connectors.map((conn) => ({
      id: conn.id,
      fromNodeId: conn.fromNodeId,
      toNodeId: conn.toNodeId,
    }));
  }

  function loadSerializedData(connectorsData) {
    clearData();
    const loadedConnectors = connectorsData
      .map((connData) => {
        const fromNode = findNodeByIdCallback(connData.fromNodeId);
        const toNode = findNodeByIdCallback(connData.toNodeId);
        if (fromNode && toNode) {
          const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
          );
          line.setAttribute("id", connData.id);
          line.classList.add("connector-line");
          connectorLayerElement.appendChild(line);
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

  function clearData() {
    connectors.forEach((conn) => {
      if (conn.element) conn.element.remove();
    });
    connectors = [];
    if (isConnecting) {
      cancelConnectionMode();
    }
  }

  return {
    init,
    toggleConnectionMode,
    startConnection,
    cancelConnectionMode,
    createConnector,
    removeConnectorsForNode,
    updateConnectorsForNode,
    redrawAllConnectors,
    getSerializedData,
    loadSerializedData,
    clearData,
    isConnectingMode: () => isConnecting,
    getConnectionStartNode: () => connectionStartNode,
  };
})();
