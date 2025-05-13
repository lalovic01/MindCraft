const onboardingManager = (function () {
  let appRef = null;
  let currentStepIndex = 0;
  let isActive = false;
  const ONBOARDING_COMPLETED_KEY = "mindcraft_onboarding_completed";

  const onboardingSteps = [
    {
      title: "Dobrodošli u MindCraft!",
      text: "Ovaj kratki vodič će vas upoznati sa osnovnim funkcionalnostima. Kliknite 'Dalje' za početak.",
      element: null,
      position: "center",
    },
    {
      element: "#add-node-btn",
      title: "Dodavanje Ideja",
      text: "Kliknite ovde da dodate novu ideju (čvor) na vašu mapu.",
      position: "bottom",
      onBeforeShow: () => {},
    },
    {
      element: "#workspace",
      title: "Radna Površina",
      text: "Ovde će se prikazivati vaše ideje. Možete ih prevlačiti i organizovati.",
      position: "center",
    },
    {
      element: ".node",
      title: "Interakcija sa Idejom",
      text: "Kliknite na naslov ili opis da ih izmenite. Desni klik (ili dugi pritisak na mobilnom) otvara dodatne opcije.",
      position: "bottom",
      onBeforeShow: async () => {
        if (!document.querySelector(".node") && appRef) {
          showTemporaryMessage("Kreiram primer ideje za vodič...");
          const newNode = appRef.addNode();
          if (newNode && typeof newNode.then === "function") {
            await newNode;
          } else if (newNode) {
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
          clearTemporaryMessage();
          if (!document.querySelector(".node")) {
            logger.warn("Onboarding: Primer čvora nije uspešno kreiran.");
            return false;
          }
        }
        return true;
      },
    },
    {
      element: "#connect-nodes-btn",
      title: "Povezivanje Ideja",
      text: "Koristite ovo dugme da biste kreirali veze između vaših ideja.",
      position: "bottom",
      onBeforeShow: () => {},
    },
    {
      title: "Kraj Vodiča",
      text: "Sada ste spremni da istražite MindCraft! Detaljniju pomoć možete naći klikom na dugme 'Pomoć'.",
      element: "#help-btn",
      position: "bottom",
      onBeforeShow: () => {},
    },
  ];

  let overlayPieces = {};
  let messageBoxElement,
    titleElement,
    textElement,
    nextButton,
    skipButton,
    tempMessageElement;

  function init(appInstance) {
    appRef = appInstance;

    const pieceNames = ["top", "bottom", "left", "right"];
    pieceNames.forEach((name) => {
      const piece = document.createElement("div");
      piece.id = `onboarding-overlay-${name}`;
      piece.classList.add("onboarding-overlay-piece");
      document.body.appendChild(piece);
      overlayPieces[name] = piece;
    });

    messageBoxElement = document.createElement("div");
    messageBoxElement.id = "onboarding-message-box";

    titleElement = document.createElement("h3");
    textElement = document.createElement("p");

    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "onboarding-buttons";

    nextButton = document.createElement("button");
    nextButton.id = "onboarding-next-btn";
    nextButton.textContent = "Dalje";
    nextButton.addEventListener("click", nextStep);

    skipButton = document.createElement("button");
    skipButton.id = "onboarding-skip-btn";
    skipButton.textContent = "Preskoči Vodič";
    skipButton.addEventListener("click", endTour);

    buttonsContainer.appendChild(skipButton);
    buttonsContainer.appendChild(nextButton);

    messageBoxElement.appendChild(titleElement);
    messageBoxElement.appendChild(textElement);
    messageBoxElement.appendChild(buttonsContainer);
    document.body.appendChild(messageBoxElement);

    tempMessageElement = document.createElement("div");
    tempMessageElement.id = "onboarding-temp-message";
    document.body.appendChild(tempMessageElement);
  }

  function showTemporaryMessage(message) {
    tempMessageElement.textContent = message;
    tempMessageElement.classList.add("visible");
  }

  function clearTemporaryMessage() {
    tempMessageElement.classList.remove("visible");
  }

  async function start(forceStart = false) {
    if (isActive) return;
    if (localStorage.getItem(ONBOARDING_COMPLETED_KEY) && !forceStart) {
      logger.info("Onboarding already completed.");
      return;
    }

    isActive = true;
    currentStepIndex = 0;
    document.body.classList.add("onboarding-active");
    await showStep(currentStepIndex);
  }

  async function showStep(index) {
    if (index >= onboardingSteps.length) {
      endTour();
      return;
    }

    const step = onboardingSteps[index];

    document
      .querySelectorAll(".onboarding-highlight")
      .forEach((el) => el.classList.remove("onboarding-highlight"));

    messageBoxElement.style.display = "block";

    if (step.onBeforeShow) {
      const canProceed = await step.onBeforeShow();
      if (canProceed === false) {
        logger.warn(
          `Onboarding: Pre-condition for step ${index} not met. Skipping step.`
        );
        nextStep();
        return;
      }
    }

    titleElement.textContent = step.title;
    textElement.innerHTML = step.text;

    const targetElement = step.element
      ? document.querySelector(step.element)
      : null;

    Object.values(overlayPieces).forEach(
      (piece) => (piece.style.display = "block")
    );

    if (targetElement) {
      targetElement.classList.add("onboarding-highlight");

      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
      await new Promise((resolve) => setTimeout(resolve, 300));

      const targetRect = targetElement.getBoundingClientRect();
      const highlightPadding = 0;

      overlayPieces.top.style.height = `${Math.max(
        0,
        targetRect.top - highlightPadding
      )}px`;
      overlayPieces.top.style.width = "100%";
      overlayPieces.top.style.top = "0";
      overlayPieces.top.style.left = "0";

      overlayPieces.bottom.style.top = `${
        targetRect.bottom + highlightPadding
      }px`;
      overlayPieces.bottom.style.height = `calc(100vh - ${
        targetRect.bottom + highlightPadding
      }px)`;
      overlayPieces.bottom.style.width = "100%";
      overlayPieces.bottom.style.left = "0";

      overlayPieces.left.style.top = `${Math.max(
        0,
        targetRect.top - highlightPadding
      )}px`;
      overlayPieces.left.style.height = `${Math.min(
        window.innerHeight,
        targetRect.height + 2 * highlightPadding
      )}px`;
      overlayPieces.left.style.width = `${Math.max(
        0,
        targetRect.left - highlightPadding
      )}px`;
      overlayPieces.left.style.left = "0";

      overlayPieces.right.style.top = `${Math.max(
        0,
        targetRect.top - highlightPadding
      )}px`;
      overlayPieces.right.style.height = `${Math.min(
        window.innerHeight,
        targetRect.height + 2 * highlightPadding
      )}px`;
      overlayPieces.right.style.left = `${
        targetRect.right + highlightPadding
      }px`;
      overlayPieces.right.style.width = `calc(100vw - ${
        targetRect.right + highlightPadding
      }px)`;

      overlayPieces.top.style.bottom = "auto";
      overlayPieces.bottom.style.height = `max(0px, calc(100vh - ${
        targetRect.bottom + highlightPadding
      }px))`;
      overlayPieces.left.style.right = "auto";
      overlayPieces.right.style.width = `max(0px, calc(100vw - ${
        targetRect.right + highlightPadding
      }px))`;

      positionMessageBox(targetElement, step.position);
    } else {
      overlayPieces.top.style.top = "0";
      overlayPieces.top.style.left = "0";
      overlayPieces.top.style.width = "100%";
      overlayPieces.top.style.height = "100%";
      overlayPieces.bottom.style.display = "none";
      overlayPieces.left.style.display = "none";
      overlayPieces.right.style.display = "none";
      positionMessageBox(null, "center");
    }

    if (index === onboardingSteps.length - 1) {
      nextButton.textContent = "Završi";
    } else {
      nextButton.textContent = "Dalje";
    }
  }

  function positionMessageBox(targetElement, position) {
    messageBoxElement.className = "onboarding-message-box";
    if (!targetElement || position === "center") {
      messageBoxElement.classList.add("position-center");
      messageBoxElement.style.top = "50%";
      messageBoxElement.style.left = "50%";
      messageBoxElement.style.transform = "translate(-50%, -50%)";
    } else {
      const targetRect = targetElement.getBoundingClientRect();
      const msgBoxRect = messageBoxElement.getBoundingClientRect();
      messageBoxElement.classList.add(`position-${position}`);

      let top, left;

      switch (position) {
        case "top":
          top = targetRect.top - msgBoxRect.height - 10;
          left = targetRect.left + targetRect.width / 2 - msgBoxRect.width / 2;
          break;
        case "bottom":
          top = targetRect.bottom + 10;
          left = targetRect.left + targetRect.width / 2 - msgBoxRect.width / 2;
          break;
        case "left":
          top = targetRect.top + targetRect.height / 2 - msgBoxRect.height / 2;
          left = targetRect.left - msgBoxRect.width - 10;
          break;
        case "right":
          top = targetRect.top + targetRect.height / 2 - msgBoxRect.height / 2;
          left = targetRect.right + 10;
          break;
        default:
          top = targetRect.bottom + 10;
          left = targetRect.left + targetRect.width / 2 - msgBoxRect.width / 2;
      }
      messageBoxElement.style.top = `${Math.max(
        10,
        Math.min(top, window.innerHeight - msgBoxRect.height - 10)
      )}px`;
      messageBoxElement.style.left = `${Math.max(
        10,
        Math.min(left, window.innerWidth - msgBoxRect.width - 10)
      )}px`;
      messageBoxElement.style.transform = "none";
    }
  }

  async function nextStep() {
    const currentStep = onboardingSteps[currentStepIndex];
    if (currentStep && currentStep.onAfterHide) {
      await currentStep.onAfterHide();
    }

    currentStepIndex++;
    if (currentStepIndex < onboardingSteps.length) {
      await showStep(currentStepIndex);
    } else {
      endTour();
    }
  }

  function endTour() {
    isActive = false;
    document.body.classList.remove("onboarding-active");

    Object.values(overlayPieces).forEach(
      (piece) => (piece.style.display = "none")
    );

    messageBoxElement.style.display = "none";
    document
      .querySelectorAll(".onboarding-highlight")
      .forEach((el) => el.classList.remove("onboarding-highlight"));
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
    logger.info("Onboarding tour ended.");
  }

  function resetTourCompletion() {
    localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    logger.info("Onboarding tour completion status reset.");
  }

  return {
    init,
    start,
    nextStep,
    endTour,
    resetTourCompletion,
    isActive: () => isActive,
  };
})();
