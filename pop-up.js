document.addEventListener("DOMContentLoaded", () => {
  const rateInput = document.getElementById("rate");
  const pitchInput = document.getElementById("pitch");
  const volumeInput = document.getElementById("volume");
  const voiceSelect = document.getElementById("voice");
  const saveButton = document.getElementById("save");
  const closeButton = document.getElementById("close");

  const toggles = {
    "focus-line": "focusLineEnabled",
    "flash-content": "flashContentEnabled",
    "highlight-links": "highlightLinksEnabled",
    "dyslexia-font": "dyslexiaFontEnabled",
    "high-contrast": "highContrastEnabled",
    "toggle-images": "hideImagesEnabled",
    "letter-spacing": "letterSpacingEnabled",
    "dimmer-overlay": "dimmerOverlayEnabled",
    "lg-cursor": "largeCursorEnabled",
    "autocomplete": "autocompleteEnabled",
// ... other actions for additional features ...
  };

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const currentTabId = tabs[0].id;

    // Initialize the state of each checkbox based on stored values
    Object.keys(toggles).forEach((toggleId) => {
      const stateKey = toggles[toggleId];
      chrome.storage.local.get({ [stateKey]: {} }, function (result) {
        const tabState = result[stateKey][currentTabId];
        document.getElementById(toggleId).checked = !!tabState;
      });
    });

    // Update the stored state when each toggle is toggled
    Object.entries(toggles).forEach(([toggleId, stateKey]) => {
      const checkbox = document.getElementById(toggleId);
      checkbox.addEventListener("change", function () {
        chrome.storage.local.get({ [stateKey]: {} }, function (result) {
          const tabState = result[stateKey] || {};
          tabState[currentTabId] = checkbox.checked;
          chrome.storage.local.set({ [stateKey]: tabState });
        });
        // Send the state to the content script
        chrome.tabs.sendMessage(currentTabId, {
          action: stateKey,
          enabled: checkbox.checked,
        });
      });
    });
  });
  // Load any previously saved settings and update the UI accordingly
  chrome.storage.local.get(["rate", "pitch", "volume", "voice"], (settings) => {
    if (settings.rate) rateInput.value = settings.rate;
    if (settings.pitch) pitchInput.value = settings.pitch;
    if (settings.volume) volumeInput.value = settings.volume;
    if (settings.voice) voiceSelect.value = settings.voice;
  });

  // Function to populate the voice selection dropdown
  function populateVoices() {
    chrome.tts.getVoices((voices) => {
      voiceSelect.innerHTML = ""; // Clear existing options
      voices.forEach((voice) => {
        const option = document.createElement("option");
        option.textContent = voice.voiceName;
        option.value = voice.voiceName;
        voiceSelect.appendChild(option);
      });
      // Set the previously selected voice if it exists
      chrome.storage.local.get("voice", (data) => {
        if (data.voice) {
          voiceSelect.value = data.voice;
        }
      });
    });
  }

  // Initial population of voices
  populateVoices();

  // Save button event listener
  saveButton.addEventListener("click", () => {
    chrome.storage.local.set(
      {
        rate: parseFloat(rateInput.value),
        pitch: parseFloat(pitchInput.value),
        volume: parseFloat(volumeInput.value),
        voice: voiceSelect.value,
      },
      () => {
        console.log("Settings saved");
        // Optional: Provide feedback to the user that settings were saved.
        this.close(); // Close the popup window
      }
    );
  });

  // Close button event listener
  closeButton.addEventListener("click", () => {
    this.close(); // Close the popup window
  });
});
