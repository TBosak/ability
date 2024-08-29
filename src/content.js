import { pipeline, env } from '@xenova/transformers';
let toggleImgListener;
let hideImages = false;

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  switch (request.action) {
    case "hideImagesEnabled":
      hideImages = request.enabled;
      toggleImagesVisibility();
      if (hideImages) {
        imageObserver = observeNewElements();
        toggleImgListener = window.addEventListener("scroll", () => {
          toggleImagesVisibility();
        });
      } else if (imageObserver) {
        imageObserver.disconnect();
        window.removeEventListener("scroll", toggleImgListener);
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
    case "autocompleteEnabled":
      enableAutocomplete();
      break;
    case "applyFocusedReading":
      applyFocusedReadingToSelection();
      break;
    case "summarizeSelection":
      summarizeSelection();
      break;
    case "openMagnifiedImage":
      openMagnifiedImage(request.srcUrl);
      break;
    case "readImage":
      readImage(request.srcUrl);
      break;
    default:
      console.log("Unknown action: " + request.action);
  }
});

let wordList = [];

fetch(chrome.runtime.getURL("assets/words.json"))
  .then((response) => response.json())
  .then((json) => {
    wordList = Object.keys(json);
    console.log(wordList);
  })
  .catch((error) => console.error("Error loading word list:", error));

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

let flashObserver = null;
let freezeGifsOnScroll = null;
function flashContent(enabled) {
  const cssAnimationsStyleElement = document.createElement("style");
  document.head.appendChild(cssAnimationsStyleElement);

  if (enabled) {
    // Freeze CSS animations and transitions
    cssAnimationsStyleElement.textContent = `* {
      animation-play-state: paused !important;
      transition: none !important;
    }`;

    // Freeze GIF images
    [].slice.apply(document.images).filter(isGif).map(freezeGif);

    // Pause autoplay videos
    const videos = document.querySelectorAll("video[autoplay]");
    videos.forEach((video) => {
      video.pause();
    });

    // Set up a MutationObserver to watch for new images being added to the DOM
    flashObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          // Freeze new GIF images
          if (node.tagName === "IMG" && isGif(node)) {
            freezeGif(node);
          }
          // If a new node with child images is added, check those images too
          if (node.getElementsByTagName) {
            [].slice
              .apply(node.getElementsByTagName("img"))
              .filter(isGif)
              .map(freezeGif);
          }
          // Pause new videos that are added to the DOM
          if (node.tagName === "VIDEO" && node.autoplay) {
            node.pause();
          }
        });
      });
    });

    flashObserver.observe(document.body, { childList: true, subtree: true });

    // Add event listener for scroll events to handle any lazy-loaded GIFs
    freezeGifsOnScroll = window.addEventListener("scroll", function () {
      [].slice.apply(document.images).filter(isGif).map(freezeGif);
    });
  } else {
    // Resume CSS animations and transitions
    cssAnimationsStyleElement.textContent = "";

    // Resume autoplay videos
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      if (video.paused) {
        video.play();
      }
    });

    // Disconnect the observer and remove the scroll event listener
    flashObserver.disconnect();
    window.removeEventListener("scroll", freezeGifsOnScroll);

    // Reload the page to reset GIFs and videos
    document.location.reload();
  }
}

function isGif(i) {
  return /^(?!data:).*\.gif/i.test(i.src);
}

function freezeGif(i) {
  var c = document.createElement("canvas");
  var w = (c.width = i.width);
  var h = (c.height = i.height);
  c.getContext("2d").drawImage(i, 0, 0, w, h);
  try {
    i.src = c.toDataURL("image/gif"); // Try to change the source of the image
  } catch (e) {
    // Cross-domain images will throw an error, we handle them here
    for (var j = 0, a; (a = i.attributes[j]); j++) {
      c.setAttribute(a.name, a.value);
    }
    i.parentNode.replaceChild(c, i);
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
      focusTriangle.style.borderLeft = "10px solid transparent"; // Adjust size as needed
      focusTriangle.style.borderRight = "10px solid transparent"; // Adjust size as needed
      focusTriangle.style.borderBottom = "10px solid blue"; // Adjust color and size as needed
      focusTriangle.style.zIndex = "10000"; // Should be above the line
      focusTriangle.style.pointerEvents = "none"; // Ignore mouse events
      document.body.appendChild(focusTriangle);
    }
    // Event listener to update position of focus line and triangle
    document.addEventListener("mousemove", function (e) {
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
  if (focusLine !== null && focusTriangle !== null) {
    // Use clientY for vertical position to avoid issues with scrolling
    const yPosition = e.clientY;

    // Update focus line position to follow the mouse cursor
    focusLine.style.top = `${yPosition}px`;

    // Update triangle position
    // The '- 10' is to account for the height of the triangle to center it vertically around the cursor
    focusTriangle.style.left = `${e.clientX - 10}px`; // Adjust '- 10' if the size of the triangle changes
    focusTriangle.style.top = `${yPosition - 10}px`; // Keep the triangle centered with the cursor
  }
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
  const styleId = "my-extension-letter-spacing-style";
  let styleElement = document.getElementById(styleId);
  if (enabled) {
    if (!styleElement) {
      styleElement = document.createElement("style");
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

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "showDefinition") {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const span = document.createElement("span");
    span.title = request.definition;
    range.surroundContents(span);
    selection.removeAllRanges();
    selection.addRange(range);
  } else if (request.action === "alertUser" && request.message) {
    alert(request.message);
  }
});

let flashlightOverlay;

function toggleDimmerOverlay(enabled) {
  if (enabled) {
    if (!flashlightOverlay) {
      // Create the dimmer overlay if it doesn't exist
      flashlightOverlay = document.createElement("div");
      flashlightOverlay.style.position = "fixed";
      flashlightOverlay.style.top = "0";
      flashlightOverlay.style.left = "0";
      flashlightOverlay.style.width = "100%";
      flashlightOverlay.style.height = "100%";
      flashlightOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)"; // Darker for flashlight effect
      flashlightOverlay.style.zIndex = "99999"; // High z-index to cover the page
      flashlightOverlay.style.pointerEvents = "none"; // Allows clicking through the overlay
      document.body.appendChild(flashlightOverlay);

      // Add mouse move listener to create flashlight effect
      document.addEventListener("mousemove", updateFlashlightPosition);
    }
    flashlightOverlay.style.display = "block";
  } else {
    if (flashlightOverlay) {
      flashlightOverlay.style.display = "none";
      document.removeEventListener("mousemove", updateFlashlightPosition);
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
  const cursorUrl = chrome.runtime.getURL("assets/cursor.png"); // Path to your PNG cursor image
  const cursorStyleElement =
    document.getElementById("large-cursor-style") || createCursorStyleElement();

  if (enabled) {
    // Enlarge the cursor using the PNG cursor image
    cursorStyleElement.textContent = `body, body * { cursor: url('${cursorUrl}'), auto !important; }`;
  } else {
    // Reset to the default cursor
    cursorStyleElement.textContent = "";
  }
}

function createCursorStyleElement() {
  const style = document.createElement("style");
  style.id = "large-cursor-style";
  document.head.appendChild(style);
  return style;
}

function createAutocomplete(inputElement) {
  let autoCompleteDiv = document.createElement("div");
  autoCompleteDiv.className = "autocomplete-items";
  // Position the autocomplete items below the input element
  autoCompleteDiv.style.position = "absolute";
  autoCompleteDiv.style.border = "1px solid #d4d4d4";
  autoCompleteDiv.style.backgroundColor = "#fff";
  autoCompleteDiv.style.zIndex = "99";
  autoCompleteDiv.style.top = `${
    inputElement.offsetTop + inputElement.offsetHeight
  }px`;
  autoCompleteDiv.style.left = `${inputElement.offsetLeft}px`;
  autoCompleteDiv.style.width = `${inputElement.offsetWidth}px`;

  inputElement.parentNode.appendChild(autoCompleteDiv);

  inputElement.addEventListener("input", function () {
    // Get the current word the user is typing (the last word in the input)
    let currentInput = this.value;
    let currentWords = currentInput.split(/\s+/); // Split the input into words
    let currentWord = currentWords[currentWords.length - 1]; // Get the last word
    // Clear any existing autocomplete items
    while (autoCompleteDiv.firstChild) {
      autoCompleteDiv.removeChild(autoCompleteDiv.firstChild);
    }
    if (!currentWord) return false;
    // Filter the wordList based on the current word
    let matchedWords = wordList.filter(
      (word) =>
        word.substr(0, currentWord.length).toUpperCase() ===
        currentWord.toUpperCase()
    );
    // Sort the matched words by length
    // Sort the matched words by length, and then alphabetically for words of the same length
    matchedWords.sort((a, b) => {
      if (a.length === b.length) {
        return a.localeCompare(b); // Alphabetical order for words of the same length
      }
      return a.length - b.length; // Shortest words first
    }); // Limit the number of suggestions
    matchedWords.slice(0, 5).forEach((matchedWord) => {
      // Create a DIV element for each matching element
      let itemDiv = document.createElement("div");
      // Make the matching letters bold
      itemDiv.innerHTML = `<strong>${matchedWord.substr(
        0,
        currentWord.length
      )}</strong>${matchedWord.substr(currentWord.length)}`;
      itemDiv.addEventListener("click", function () {
        // Replace the last word with the selected word from autocomplete suggestions
        currentWords[currentWords.length - 1] = matchedWord;
        inputElement.value = currentWords.join(" ") + " "; // Add a space after the inserted word
        // Clear the items
        while (autoCompleteDiv.firstChild) {
          autoCompleteDiv.removeChild(autoCompleteDiv.firstChild);
        }
      });
      autoCompleteDiv.appendChild(itemDiv);
    });
  });

  // Close the list when the user clicks elsewhere
  document.addEventListener("click", function (e) {
    if (e.target !== inputElement && e.target.parentNode !== autoCompleteDiv) {
      while (autoCompleteDiv.firstChild) {
        autoCompleteDiv.removeChild(autoCompleteDiv.firstChild);
      }
    }
    e.stopPropagation(); // Stop the click event from closing the div prematurely
  });
}

// Query all text inputs and attach the autocomplete
function enableAutocomplete() {
  document
    .querySelectorAll('input[type="text"]:not([autocomplete="on"])')
    .forEach((inputElement) => {
      createAutocomplete(inputElement);
    });
}

function applyFocusedReadingToSelection() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  if (!range.collapsed) {
    const selectedText = range.toString();
    const processedText = processText(selectedText);
    const newNode = document.createElement('span');
    newNode.innerHTML = processedText;
    range.deleteContents();
    range.insertNode(newNode);
    selection.removeAllRanges();
  }
}

function processText(text) {
  // Split the text and wrap parts of it in <b> tags as per the logic in splitWord
  // Assuming splitWord returns an array of two strings: the part to be bolded and the rest
  return text.split(/\s+/).map(word => {
    const [firstPart, secondPart] = splitWord(word);
    return `<b>${firstPart}</b>${secondPart}`;
  }).join(' ');
}

function splitWord(word) {
  // Define the logic to split the word for bolding part of it
  // Here we're bolding the first letter or first few letters of each word
  const wordLength = word.length;
  let splitIndex = wordLength <= 4 ? 1 : 4;
  return [word.substring(0, splitIndex), word.substring(splitIndex)];
}

function summarizeSelection(){
  createLoadingOverlay();
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!range.collapsed) {
    summarizeText(range.toString());
  }
}

async function summarizeText(txt){
  const summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
  await summarizer(txt).then((response) => {
    const selectedText = "Summary: " + response[0].summary_text;
    removeLoadingOverlay();
    createPopup(selectedText)
  });
}

function createPopup(summary) {
  const popup = document.createElement('div');
  popup.style.position = 'fixed';
  popup.style.bottom = '10px';
  popup.style.right = '10px';
  popup.style.backgroundColor = '#fff';
  popup.style.padding = '10px';
  popup.style.border = '1px solid #000';
  popup.style.zIndex = '1000';
  popup.style.fontWeight = "5"
  popup.textContent = summary;

  document.body.appendChild(popup);

  // Function to remove the popup
  function removePopup(event) {
    if (!popup.contains(event.target)) {
      document.body.removeChild(popup);
      document.removeEventListener('click', removePopup);
    }
  }

  // Add an event listener to detect clicks outside the popup
  setTimeout(() => {
    document.addEventListener('click', removePopup);
  }, 0);
}

  // Add loading overlay
  const createLoadingOverlay = () => {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '10000';

    const spinner = document.createElement('div');
    spinner.style.border = '16px solid #f3f3f3';
    spinner.style.borderTop = '16px solid #3498db';
    spinner.style.borderRadius = '50%';
    spinner.style.width = '120px';
    spinner.style.height = '120px';
    spinner.style.animation = 'spin 2s linear infinite';

    overlay.appendChild(spinner);
    document.body.appendChild(overlay);

    // Add spinner animation
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  };

  // Remove loading overlay
  const removeLoadingOverlay = () => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.remove();
    }
  };

async function readImage(srcUrl){
  const captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
  createLoadingOverlay();
  const description = await captioner(srcUrl).then((response) => {
    removeLoadingOverlay();
    createPopup("Image Details: " + response[0].generated_text);
});
}

function openMagnifiedImage(imageSrc) {
  // Create an underlay to dim the background content
  const underlay = document.createElement('div');
  underlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    cursor: pointer;
  `;
  document.body.appendChild(underlay);

  // Create a container for the magnified image and append it to underlay
  const imgContainer = document.createElement('div');
  imgContainer.className = 'img-magnifier-container';
  imgContainer.style.cssText = `
    position: relative;
    width: 80%;  // Set this to the desired width
    max-width: 600px;  // Set a max-width if needed
    margin: auto;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  `;
  underlay.appendChild(imgContainer);

  // Create the magnified image itself and append it to the container
  const magnifiedImg = document.createElement('img');
  magnifiedImg.src = imageSrc;
  magnifiedImg.style.cssText = `
    width: 100%;  // Image takes the full width of its container
    height: auto;  // Height is set automatically to keep aspect ratio
    display: block;  // To prevent inline default spacing
  `;
  magnifiedImg.onload = () => {
    // Once the image is loaded, apply the magnifying glass effect
    magnify(magnifiedImg, 2);  // The second parameter is the zoom level
  };
  imgContainer.appendChild(magnifiedImg);

  // Event listener for closing the magnified image when the underlay is clicked
  underlay.addEventListener('click', function() {
    underlay.remove();
  });
}

function magnify(img, zoom) {
  var glass = document.createElement("DIV");
  glass.className = "img-magnifier-glass";
  glass.style.cssText = `
    position: absolute;
    border-radius: 50%;
    border: 3px solid #000;
    cursor: none;
    width: 100px;
    height: 100px !important;
    box-shadow: 0 0 0 7px rgba(255, 255, 255, 0.85), 0 0 7px 7px rgba(0, 0, 0, 0.25);
    background-image: url('${img.src}');
    background-repeat: no-repeat;
    background-size: ${img.width * zoom}px ${img.height * zoom}px;
    visibility: hidden;  // Hide it initially
  `;
  // Insert magnifier glass
  img.parentElement.insertBefore(glass, img);

  // Event listeners for moving the magnifier glass
  glass.addEventListener("mousemove", moveMagnifier);
  img.addEventListener("mousemove", moveMagnifier);

  // Event listeners for touch screens
  glass.addEventListener("touchmove", moveMagnifier);
  img.addEventListener("touchmove", moveMagnifier);

  function moveMagnifier(e) {
    var pos, x, y;
    e.preventDefault();  // Prevent any other actions that may occur when moving over the image
    pos = getCursorPos(e);
    x = pos.x;
    y = pos.y;
    // Prevent the magnifier glass from being positioned outside the image
    if (x > img.width - (glass.offsetWidth / zoom)) {x = img.width - (glass.offsetWidth / zoom);}
    if (x < glass.offsetWidth / zoom) {x = glass.offsetWidth / zoom;}
    if (y > img.height - (glass.offsetHeight / zoom)) {y = img.height - (glass.offsetHeight / zoom);}
    if (y < glass.offsetHeight / zoom) {y = glass.offsetHeight / zoom;}
    // Set the position of the magnifier glass
    glass.style.left = (x - glass.offsetWidth / 2) + "px";
    glass.style.top = (y - glass.offsetHeight / 2) + "px";
    // Display what the magnifier glass "sees"
    glass.style.backgroundPosition = `-${((x * zoom) - glass.offsetWidth / 2 + 3)}px -${((y * zoom) - glass.offsetHeight / 2 + 3)}px`;
    glass.style.visibility = 'visible';  // Show magnifier
  }

  function getCursorPos(e) {
    var a, x = 0, y = 0;
    e = e || window.event;
    a = img.getBoundingClientRect();
    x = e.pageX - a.left;
    y = e.pageY - a.top;
    x = x - window.pageXOffset;
    y = y - window.pageYOffset;
    return {x : x, y : y};
  }
}
