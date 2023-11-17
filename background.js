// Create context menu items
const api = chrome || browser || window;

api.runtime.onInstalled.addListener(() => {

    api.contextMenus.create({
      id: "speak-selected-text",
      title: "Speak Selection",
      contexts: ["selection"],
    });

  if (window.SpeechRecognition || window.webkitSpeechRecognition) {
    api.contextMenus.create({
      id: "speech-to-text",
      title: "Speech-To-Text",
      contexts: ["editable"],
    });
  }

  api.contextMenus.create({
    id: "define",
    title: "Define Selection",
    contexts: ["selection"],
  });

  api.contextMenus.create({
    id: "focused-reading",
    title: "Apply Focused Reading",
    contexts: ["selection"],
  });

  api.contextMenus.create({
    id: "magnify-image",
    title: "Magnify",
    contexts: ["image"],
  });
});

// Handle context menu item clicks
api.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "speak-selected-text") {
    const settings = await api.storage.local.get([
      "rate",
      "pitch",
      "volume",
      "voice",
    ]);
    const { rate = 1, pitch = 1, volume = 1, voice = "native" } = settings;

    const isChrome = typeof chrome !== "undefined" && !!chrome.tts;

    if (isChrome) {
      // Use chrome.tts if the browser is Chrome
      chrome.tts.speak(info.selectionText, {
        rate,
        pitch,
        volume,
        voiceName: voice,
        onEvent: function (event) {
          if (event.type === "error") {
            console.error("TTS Error: ", event.errorMessage);
          }
        },
      });
    } else {
      // Use Web Speech API for other browsers
      const speech = window.speechSynthesis || speechSynthesis;
      let utterance = new SpeechSynthesisUtterance(info.selectionText);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      // Set the voice if available
      const voices = speech.getVoices();
      const selectedVoice = voices.find((v) => v.name === voice);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      speech.speak(utterance);
    }
  } else if (info.menuItemId === "speech-to-text") {
    chrome
      ? api.scripting.executeScript({
          target: { tabId: tab.id },
          function: startSpeechToText,
        })
      : api.tabs.executeScript(tab.id, {
          code: `(${startSpeechToText.toString()})()`,
        });
  } else if (info.menuItemId === "define" && info.selectionText) {
    const query = info.selectionText.trim();
    if (/\s/.test(query)) {
      // If the selection contains space, it might be more than one word
      api.tabs.sendMessage(tab.id, {
        action: "alertUser",
        message: "Please select only a single word to define.",
      });
    } else {
      // Proceed with fetching the definition
      try {
        const response = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${query}`
        );
        const definitions = await response.json();
        if (definitions.length > 0 && definitions[0].meanings.length > 0) {
          const definition =
            definitions[0].meanings[0].definitions[0].definition;
          api.tabs.sendMessage(tab.id, {
            action: "showDefinition",
            definition,
            word: query,
          });
        }
      } catch (error) {
        api.tabs.sendMessage(tab.id, {
          action: "alertUser",
          message: "An error occurred while fetching the definition.",
        });
      }
    }
  } else if (info.menuItemId === "focused-reading") {
    api.tabs.sendMessage(tab.id, {
      action: "applyFocusedReading",
    });
  } else if (info.menuItemId === "magnify-image") {
    api.tabs.sendMessage(tab.id, {
      action: "openMagnifiedImage",
      srcUrl: info.srcUrl,
    });
  }
});

// Inject speech-to-text function into active tab
function startSpeechToText() {
  const activeElement = document.activeElement;

  const recognition = new (window.SpeechRecognition ||
    window.webkitSpeechRecognition)();
  recognition.lang = "en-US";
  recognition.start();

  recognition.onresult = function (event) {
    const transcript = event.results[0][0].transcript;
    if (activeElement) {
      activeElement.value += transcript;
      activeElement.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  recognition.onerror = function (event) {
    console.error("Speech Recognition Error:", event.error);
  };

  recognition.onend = function () {
    // Handle end of speech recognition
  };
}

// Toggle features on tab update
api.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status === "complete") {
    api.storage.local.get(null, function (allStates) {
      Object.keys(allStates).forEach((stateKey) => {
        const isEnabled = allStates[stateKey]?.[tabId];
        if (isEnabled) {
          const actions = {
            focusLineEnabled: "focusLineEnabled",
            flashContentEnabled: "flashContentEnabled",
            highlightLinksEnabled: "highlightLinksEnabled",
            dyslexiaFontEnabled: "dyslexiaFontEnabled",
            highContrastEnabled: "highContrastEnabled",
            hideImagesEnabled: "hideImagesEnabled",
            letterSpacingEnabled: "letterSpacingEnabled",
            dimmerOverlayEnabled: "dimmerOverlayEnabled",
            largeCursorEnabled: "largeCursorEnabled",
            autocompleteEnabled: "autocompleteEnabled",
            // ... other actions for additional features ...
          };
          const action = actions[stateKey];
          if (action) {
            api.tabs.sendMessage(tabId, {
              action,
              enabled: true,
            });
          }
        }
      });
    });
  }
});
