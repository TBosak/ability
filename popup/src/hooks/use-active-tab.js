import { useEffect, useState } from 'react';

export function useActiveTabId() {
  const [tabId, setTabId] = useState(null);

  useEffect(() => {
    if (!chrome?.tabs?.query) {
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to fetch active tab:', chrome.runtime.lastError.message);
        setTabId(null);
        return;
      }

      setTabId(tabs?.[0]?.id ?? null);
    });
  }, []);

  return tabId;
}
