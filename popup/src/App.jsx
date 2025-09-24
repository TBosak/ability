import { useEffect, useMemo, useState, useId } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useActiveTabId } from '@/hooks/use-active-tab';

const FEATURE_TOGGLES = [
  {
    id: 'hide-images',
    label: 'Hide Images',
    description: 'Remove images from the page to reduce sensory load.',
    storageKey: 'hideImagesEnabled'
  },
  {
    id: 'high-contrast',
    label: 'High Contrast',
    description: 'Apply a high-contrast theme for easier reading.',
    storageKey: 'highContrastEnabled'
  },
  {
    id: 'dyslexia-font',
    label: 'Dyslexia-Friendly Font',
    description: 'Swap fonts with a dyslexia-friendly alternative.',
    storageKey: 'dyslexiaFontEnabled'
  },
  {
    id: 'highlight-links',
    label: 'Highlight Links',
    description: 'Improve link visibility across the page.',
    storageKey: 'highlightLinksEnabled'
  },
  {
    id: 'flash-content',
    label: 'Disable Animations',
    description: 'Stop CSS animations and autoplaying media.',
    storageKey: 'flashContentEnabled'
  },
  {
    id: 'focus-line',
    label: 'Focus Line',
    description: 'Add a horizontal guide that follows the cursor.',
    storageKey: 'focusLineEnabled'
  },
  {
    id: 'letter-spacing',
    label: 'Letter Spacing',
    description: 'Increase spacing between characters.',
    storageKey: 'letterSpacingEnabled'
  },
  {
    id: 'dimmer-overlay',
    label: 'Dimmer Overlay',
    description: 'Dim surrounding content to reduce distractions.',
    storageKey: 'dimmerOverlayEnabled'
  },
  {
    id: 'large-cursor',
    label: 'Large Cursor',
    description: 'Increase cursor size for better visibility.',
    storageKey: 'largeCursorEnabled'
  },
  {
    id: 'autocomplete',
    label: 'Autocomplete',
    description: 'Enable autocomplete for all inputs on the page.',
    storageKey: 'autocompleteEnabled'
  }
];

const DEFAULT_TTS = {
  rate: 1,
  pitch: 1,
  volume: 1,
  voice: ''
};

const buildToggleDefaults = () =>
  FEATURE_TOGGLES.reduce((acc, toggle) => {
    acc[toggle.storageKey] = false;
    return acc;
  }, {});

export default function App() {
  const tabId = useActiveTabId();
  const [toggles, setToggles] = useState(buildToggleDefaults);
  const [toggleLoading, setToggleLoading] = useState(true);
  const [voices, setVoices] = useState([]);
  const [ttsSettings, setTtsSettings] = useState(DEFAULT_TTS);
  const [saving, setSaving] = useState(false);

  const abilityIconSrc = useMemo(
    () => (typeof chrome !== 'undefined' ? chrome.runtime.getURL('assets/fullsize.png') : ''),
    []
  );
  const abilityHeadingId = useId();
  const ttsHeadingId = useId();
  const togglesHeadingId = useId();
  const rateLabelId = useId();
  const pitchLabelId = useId();
  const volumeLabelId = useId();
  const voiceDescriptionId = useId();

  const toggleKeys = useMemo(() => FEATURE_TOGGLES.map((toggle) => toggle.storageKey), []);

  useEffect(() => {
    chrome.storage.local.get(['rate', 'pitch', 'volume', 'voice'], (stored) => {
      if (chrome.runtime.lastError) {
        console.error('Unable to load saved TTS settings:', chrome.runtime.lastError.message);
        return;
      }

      setTtsSettings((current) => ({
        rate: stored.rate ?? current.rate,
        pitch: stored.pitch ?? current.pitch,
        volume: stored.volume ?? current.volume,
        voice: stored.voice ?? current.voice
      }));
    });

    chrome.tts.getVoices((availableVoices) => {
      if (chrome.runtime.lastError) {
        console.error('Unable to fetch voices:', chrome.runtime.lastError.message);
        return;
      }

      const sorted = [...availableVoices].sort((a, b) => a.voiceName.localeCompare(b.voiceName));
      setVoices(sorted);
      setTtsSettings((current) => {
        if (current.voice && sorted.some((voice) => voice.voiceName === current.voice)) {
          return current;
        }

        return {
          ...current,
          voice: sorted[0]?.voiceName ?? ''
        };
      });
    });
  }, []);

  useEffect(() => {
    if (tabId == null) {
      setToggleLoading(false);
      return;
    }

    const defaults = toggleKeys.reduce((acc, key) => ({ ...acc, [key]: {} }), {});
    chrome.storage.local.get(defaults, (stored) => {
      if (chrome.runtime.lastError) {
        console.error('Unable to load toggle state:', chrome.runtime.lastError.message);
        setToggleLoading(false);
        return;
      }

      const nextState = FEATURE_TOGGLES.reduce((acc, toggle) => {
        const tabState = stored?.[toggle.storageKey] ?? {};
        acc[toggle.storageKey] = Boolean(tabState?.[tabId]);
        return acc;
      }, buildToggleDefaults());

      setToggles(nextState);
      setToggleLoading(false);
    });
  }, [tabId, toggleKeys]);

  const handleToggleChange = (storageKey, checked) => {
    setToggles((prev) => ({ ...prev, [storageKey]: checked }));

    if (tabId == null) {
      return;
    }

    chrome.storage.local.get({ [storageKey]: {} }, (existing) => {
      if (chrome.runtime.lastError) {
        console.error('Unable to read toggle state before write:', chrome.runtime.lastError.message);
        return;
      }

      const tabState = { ...(existing?.[storageKey] ?? {}) };
      tabState[tabId] = checked;
      chrome.storage.local.set({ [storageKey]: tabState }, () => {
        if (chrome.runtime.lastError) {
          console.error('Unable to persist toggle state:', chrome.runtime.lastError.message);
        }
      });
    });

    chrome.tabs.sendMessage(
      tabId,
      {
        action: storageKey,
        enabled: checked
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('Toggle message failed:', chrome.runtime.lastError.message);
        }
      }
    );
  };

  const handleSave = () => {
    setSaving(true);
    chrome.storage.local.set(
      {
        rate: Number(ttsSettings.rate),
        pitch: Number(ttsSettings.pitch),
        volume: Number(ttsSettings.volume),
        voice: ttsSettings.voice
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error('Unable to save TTS settings:', chrome.runtime.lastError.message);
          setSaving(false);
          return;
        }

        setSaving(false);
        window.close();
      }
    );
  };

  const resolveSliderValue = (value, fallback) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return fallback;
    }
    return Math.round(value * 10) / 10;
  };

  const disableToggles = tabId == null || toggleLoading;

  return (
    <main className="p-2" role="main" aria-labelledby={abilityHeadingId}>
      <Card className="w-full max-w-[360px]">
        <CardHeader className="sticky top-0 z-10 flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
          <div className="flex items-center gap-2">
            {abilityIconSrc ? (
              <img
                src={abilityIconSrc}
                alt="Ability icon"
                className="h-8 w-8 flex-shrink-0 select-none animate-ability-spin"
                draggable={false}
              />
            ) : null}
            <CardTitle id={abilityHeadingId} className="text-xl font-bold">
              Ability
            </CardTitle>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close popup" onClick={() => window.close()}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <section className="space-y-4" aria-labelledby={ttsHeadingId}>
            <header>
              <h2 id={ttsHeadingId} className="text-sm font-semibold text-muted-foreground">
                Text to Speech
              </h2>
            </header>
            <div className="space-y-4 rounded-md border bg-muted/30 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span id={rateLabelId}>Rate</span>
                  <span aria-live="polite">{Number(ttsSettings.rate).toFixed(1)}×</span>
                </div>
                <Slider
                  value={[Number(ttsSettings.rate)]}
                  onValueChange={([value]) =>
                    setTtsSettings((current) => ({
                      ...current,
                      rate: resolveSliderValue(value, current.rate)
                    }))
                  }
                  min={0.1}
                  max={10}
                  step={0.1}
                  aria-labelledby={rateLabelId}
                  aria-valuetext={`${Number(ttsSettings.rate).toFixed(1)} times speed`}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span id={pitchLabelId}>Pitch</span>
                  <span aria-live="polite">{Number(ttsSettings.pitch).toFixed(1)}</span>
                </div>
                <Slider
                  value={[Number(ttsSettings.pitch)]}
                  onValueChange={([value]) =>
                    setTtsSettings((current) => ({
                      ...current,
                      pitch: resolveSliderValue(value, current.pitch)
                    }))
                  }
                  min={0}
                  max={2}
                  step={0.1}
                  aria-labelledby={pitchLabelId}
                  aria-valuetext={`${Number(ttsSettings.pitch).toFixed(1)} pitch level`}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span id={volumeLabelId}>Volume</span>
                  <span aria-live="polite">{Number(ttsSettings.volume).toFixed(1)}</span>
                </div>
                <Slider
                  value={[Number(ttsSettings.volume)]}
                  onValueChange={([value]) =>
                    setTtsSettings((current) => ({
                      ...current,
                      volume: resolveSliderValue(value, current.volume)
                    }))
                  }
                  min={0}
                  max={1}
                  step={0.1}
                  aria-labelledby={volumeLabelId}
                  aria-valuetext={`${Number(ttsSettings.volume).toFixed(1)} volume level`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voice-select">Voice</Label>
                <select
                  id="voice-select"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={ttsSettings.voice}
                  onChange={(event) =>
                    setTtsSettings((current) => ({
                      ...current,
                      voice: event.target.value
                    }))
                  }
                  disabled={!voices.length}
                  aria-describedby={voiceDescriptionId}
                >
                  {voices.length === 0 ? (
                    <option value="" disabled>
                      Loading voices…
                    </option>
                  ) : null}
                  {voices.map((voice) => (
                    <option key={voice.voiceName} value={voice.voiceName}>
                      {voice.voiceName}
                    </option>
                  ))}
                </select>
                <p id={voiceDescriptionId} className="text-xs text-muted-foreground">
                  Selected voice is used for text-to-speech commands triggered from the context menu.
                </p>
              </div>
            </div>
          </section>

          <Separator className="my-6" />

          <section className="space-y-4" aria-labelledby={togglesHeadingId}>
            <header>
              <h2 id={togglesHeadingId} className="text-sm font-semibold text-muted-foreground">
                Accessibility Toggles
              </h2>
              <p className="text-xs text-muted-foreground">
                Changes apply to the current tab and persist until you disable them.
              </p>
            </header>
            <div className="space-y-3">
              {FEATURE_TOGGLES.map((toggle) => (
                <div
                  key={toggle.storageKey}
                  className="flex items-center justify-between gap-3 rounded-md border bg-card/40 p-3"
                  role="group"
                  aria-labelledby={`${toggle.id}-label`}
                  aria-describedby={`${toggle.storageKey}-description`}
                >
                  <div className="space-y-1">
                    <Label id={`${toggle.id}-label`} htmlFor={toggle.id} className="text-sm font-medium">
                      {toggle.label}
                    </Label>
                    <p id={`${toggle.storageKey}-description`} className="text-xs text-muted-foreground">
                      {toggle.description}
                    </p>
                  </div>
                  <Switch
                    id={toggle.id}
                    checked={Boolean(toggles[toggle.storageKey])}
                    onCheckedChange={(checked) => handleToggleChange(toggle.storageKey, checked)}
                    disabled={disableToggles}
                    aria-describedby={`${toggle.storageKey}-description`}
                  />
                </div>
              ))}
            </div>
          </section>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save TTS Settings'}
          </Button>
          <Button variant="outline" onClick={() => window.close()}>
            Close
          </Button>
          <a
            href="mailto:timb63701@gmail.com"
            className="text-center text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Report bugs or provide feedback
          </a>
        </CardFooter>
      </Card>
    </main>
  );
}
