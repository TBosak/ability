// Create context menu items
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "speak-selected-text",
        title: "Speak",
        contexts: ["selection"],
    });

    chrome.contextMenus.create({
        id: "speech-to-text",
        title: "Speech-To-Text",
        contexts: ["editable"],
    });

    chrome.contextMenus.create({
        id: 'define',
        title: 'Define',
        contexts: ['selection']
    });
});

// Handle context menu item clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "speak-selected-text") {
        const { rate = 1, pitch = 1, volume = 1, voice = "native" } = await chrome.storage.local.get(["rate", "pitch", "volume", "voice"]);
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
    } else if (info.menuItemId === "speech-to-text") {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: startSpeechToText,
        });
    } else if (info.menuItemId === 'define' && info.selectionText) {
        const query = info.selectionText.trim();
        if (/\s/.test(query)) {
            // If the selection contains space, it might be more than one word
            chrome.tabs.sendMessage(tab.id, {
                action: 'alertUser',
                message: 'Please select only a single word to define.'
            });
        } else {
            // Proceed with fetching the definition
            try {
                const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${query}`);
                const definitions = await response.json();
                if (definitions.length > 0 && definitions[0].meanings.length > 0) {
                    const definition = definitions[0].meanings[0].definitions[0].definition;
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'showDefinition',
                        definition,
                        word: query
                    });
                }
            } catch (error) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'alertUser',
                    message: 'An error occurred while fetching the definition.'
                });
            }
        }
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
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {
        chrome.storage.local.get(null, function(allStates) {
            Object.keys(allStates).forEach((stateKey) => {
                const isEnabled = allStates[stateKey]?.[tabId];
                if (isEnabled) {
                    const actions = {
                        focusLineEnabled: 'focusLineEnabled',
                        flashContentEnabled: 'flashContentEnabled',
                        highlightLinksEnabled: 'highlightLinksEnabled',
                        dyslexiaFontEnabled: 'dyslexiaFontEnabled',
                        highContrastEnabled: 'highContrastEnabled',
                        hideImagesEnabled: 'hideImagesEnabled',
                        letterSpacingEnabled: 'letterSpacingEnabled',
                        dimmerOverlayEnabled: 'dimmerOverlayEnabled',
                        largeCursorEnabled: 'largeCursorEnabled',
                        // ... other actions for additional features ...
                    };
                    const action = actions[stateKey];
                    if (action) {
                        chrome.tabs.sendMessage(tabId, {
                            action,
                            enabled: true
                        });
                    }
                }
            });
        });
    }
});
