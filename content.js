let toggleImgListener;
let hideImages = false;
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  switch (request.action) {
    case "hideImagesEnabled":
      hideImages = request.enabled;
      toggleImagesVisibility();
      if (hideImages) {
        imageObserver = observeNewElements();
        toggleImgListener = window.addEventListener('scroll', () => {toggleImagesVisibility()});
      } else if (imageObserver) {
        imageObserver.disconnect();
        window.removeEventListener('scroll', toggleImgListener);
      }
      break;
    case "highContrastEnabled":
      applyHighContrast(request.enabled);
      break;
    case "highlightLinksEnabled":
      toggleLinkHighlight(request.enabled);
      break;
    case "flashContentEnabled":
      flashContent(request.enabled);
      break;
    case "focusLineEnabled":
      focusLineEnabled(request.enabled);
      break;
    case "dyslexiaFontEnabled":
      toggleDyslexiaFont(request.enabled);
      break;
    case "letterSpacingEnabled":
      toggleLetterSpacing(request.enabled);
      break;
    case "dimmerOverlayEnabled":
      toggleDimmerOverlay(request.enabled);
      break;
    case "largeCursorEnabled":
      toggleLargeCursor(request.enabled);
      break;
    default:
      console.log("Unknown action: " + request.action);
  }
});

function toggleImagesVisibility() {
  const images = document.querySelectorAll("img");
  images.forEach((img) => {
    img.style.visibility = hideImages ? "hidden" : "visible";
  });
  const elementsWithBackground = document.querySelectorAll("*");
  elementsWithBackground.forEach((el) => {
    if (el.style.backgroundImage !== "") {
      el.style.visibility = hideImages ? "hidden" : "visible";
    }
  });
}

let imageObserver;
// Function to observe new images added to the document and hide them if needed
function observeNewElements() {
  imageObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        // For <img> elements
        if (node.tagName === "IMG") {
          node.style.visibility = hideImages ? "hidden" : "visible";
        }
        // For elements with CSS background images
        if (node.nodeType === Node.ELEMENT_NODE) {
          const computedStyle = window.getComputedStyle(node);
          if (computedStyle.backgroundImage !== "none") {
            node.style.visibility = hideImages ? "hidden" : "visible";
          }
        }
      });
    });
  });

  imageObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function applyHighContrast(state) {
  document.documentElement.style.filter = state
    ? "invert(1) hue-rotate(180deg)"
    : "";
}

const originalStyles = new Map();
// Apply or remove the highlight class from links
function toggleLinkHighlight(highlight) {
  const links = document.querySelectorAll("a");
  links.forEach((link) => {
    if (highlight) {
      // Store original styles if not already stored
      if (!originalStyles.has(link)) {
        originalStyles.set(link, link.style.cssText);
      }

      // Apply styles directly, with increased specificity and !important
      link.style.cssText +=
        "; background-color: black !important; color: yellow !important; filter: invert(0%) !important;";
    } else {
      // Restore original styles
      const originalStyle = originalStyles.get(link);
      if (originalStyle !== undefined) {
        link.style.cssText = originalStyle;
        originalStyles.delete(link);
      }
    }
  });
}

// Add the style to the page
const style = document.createElement("style");
document.head.appendChild(style);
style.sheet.insertRule(
  `
  .highlight-links {
    background-color: yellow !important; /* Replace with color inversion logic if needed */
    color: black !important; /* Replace with color inversion logic if needed */
  }
`,
  0
);

function flashContent(enabled) {
  if (enabled) {
    // Stop CSS animations and transitions
    const css = document.createElement("style");
    css.innerHTML = `* { animation-play-state: paused !important; transition: none !important; }`;
    document.head.appendChild(css);

    // Stop GIFs by replacing them with a static image of the first frame
    const gifs = document.querySelectorAll('img[src*=".gif"]');
    gifs.forEach((gif) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const image = new Image();
      image.src = gif.src;
      image.onload = () => {
        canvas.width = image.width;
        canvas.height = image.height;
        context.drawImage(image, 0, 0, image.width, image.height);
        gif.src = canvas.toDataURL("image/png");
      };
    });

    // Pause HTML5 videos
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => video.pause());
  } else {
    document.reload();
  }
}

let focusLine = null;
let focusTriangle = null;

function focusLineEnabled(enabled) {

  if (enabled) {
    if (!focusLine) {
      // Create the focus line
      focusLine = document.createElement("div");
      focusLine.style.position = "fixed";
      focusLine.style.left = 0;
      focusLine.style.right = 0;
      focusLine.style.height = "5px";
      focusLine.style.backgroundColor = "blue";
      focusLine.style.pointerEvents = "none";
      focusLine.style.zIndex = "9999";
      document.body.appendChild(focusLine);

      // Create the triangle
      focusTriangle = document.createElement("div");
      focusTriangle.style.position = "fixed";
      focusTriangle.style.width = "0";
      focusTriangle.style.height = "0";
      focusTriangle.style.borderLeft = "10px solid transparent";  // Adjust size as needed
      focusTriangle.style.borderRight = "10px solid transparent"; // Adjust size as needed
      focusTriangle.style.borderBottom = "10px solid blue";       // Adjust color and size as needed
      focusTriangle.style.zIndex = "10000"; // Should be above the line
      focusTriangle.style.pointerEvents = "none"; // Ignore mouse events
      document.body.appendChild(focusTriangle);
    }
    // Event listener to update position of focus line and triangle
    document.addEventListener("mousemove", function(e) {
      updateFocusLine(e, focusLine, focusTriangle);
    });
  } else {
    document.removeEventListener("mousemove", updateFocusLine);
    // Remove the focus line and triangle if they exist
    if (focusLine) {
      focusLine.remove();
      focusLine = null;
    }
    if (focusTriangle) {
      focusTriangle.remove();
      focusTriangle = null;
    }
  }
}

function updateFocusLine(e, focusLine, focusTriangle) {
  // Use clientY for vertical position to avoid issues with scrolling
  const yPosition = e.clientY;
  
  // Update focus line position to follow the mouse cursor
  focusLine.style.top = `${yPosition}px`;
  
  // Update triangle position
  // The '- 10' is to account for the height of the triangle to center it vertically around the cursor
  focusTriangle.style.left = `${e.clientX - 10}px`; // Adjust '- 10' if the size of the triangle changes
  focusTriangle.style.top = `${yPosition - 10}px`; // Keep the triangle centered with the cursor
}

function toggleDyslexiaFont(enableFont) {
  const styleId = "dyslexia-friendly-style";
  let styleElement = document.getElementById(styleId);

  if (enableFont) {
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    // Embed the font in the document
    styleElement.textContent = `
        @font-face {
          font-family: 'OpenDyslexic';
          src: url('${chrome.runtime.getURL(
            "assets/OpenDyslexic.otf"
          )}') format('opentype');
        }

        body, button, input, textarea, select, p, li, span, div  {
          font-family: 'OpenDyslexic', sans-serif !important;
        }
      }
      `;
  } else {
    if (styleElement) {
      styleElement.remove();
    }
  }
}

function toggleLetterSpacing(enabled) {
  const styleId = 'my-extension-letter-spacing-style';
  let styleElement = document.getElementById(styleId);
  if (enabled) {
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = `* { letter-spacing: 0.12em !important; }`; // Set desired letter-spacing value
  } else {
    if (styleElement) {
      styleElement.remove();
    }
  }
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'showDefinition') {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.title = request.definition;
    range.surroundContents(span);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  else if (request.action === 'alertUser' && request.message) {
  alert(request.message);
}
});

let flashlightOverlay;

function toggleDimmerOverlay(enabled) {
  if (enabled) {
    if (!flashlightOverlay) {
      // Create the dimmer overlay if it doesn't exist
      flashlightOverlay = document.createElement('div');
      flashlightOverlay.style.position = 'fixed';
      flashlightOverlay.style.top = '0';
      flashlightOverlay.style.left = '0';
      flashlightOverlay.style.width = '100%';
      flashlightOverlay.style.height = '100%';
      flashlightOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'; // Darker for flashlight effect
      flashlightOverlay.style.zIndex = '99999'; // High z-index to cover the page
      flashlightOverlay.style.pointerEvents = 'none'; // Allows clicking through the overlay
      document.body.appendChild(flashlightOverlay);

      // Add mouse move listener to create flashlight effect
      document.addEventListener('mousemove', updateFlashlightPosition);
    }
    flashlightOverlay.style.display = 'block';
  } else {
    if (flashlightOverlay) {
      flashlightOverlay.style.display = 'none';
      document.removeEventListener('mousemove', updateFlashlightPosition);
    }
  }
}

function updateFlashlightPosition(e) {
  const radius = 100; // Radius of the flashlight circle
  const flashlightStyle = `
    radial-gradient(circle ${radius}px at ${e.clientX}px ${e.clientY}px, 
    transparent, transparent ${radius}px, rgba(0, 0, 0, 0.7) ${radius + 1}px)
  `;
  flashlightOverlay.style.background = flashlightStyle;
}

function toggleLargeCursor(enabled) {
  const cursorUrl = chrome.runtime.getURL('assets/cursor.png'); // Path to your PNG cursor image
  const cursorStyleElement = document.getElementById('large-cursor-style') || createCursorStyleElement();

  if (enabled) {
    // Enlarge the cursor using the PNG cursor image
    cursorStyleElement.textContent = `body, body * { cursor: url('${cursorUrl}'), auto !important; }`;
  } else {
    // Reset to the default cursor
    cursorStyleElement.textContent = '';
  }
}

function createCursorStyleElement() {
  const style = document.createElement('style');
  style.id = 'large-cursor-style';
  document.head.appendChild(style);
  return style;
}