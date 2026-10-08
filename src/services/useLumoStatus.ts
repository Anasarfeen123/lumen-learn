import { useEffect, useState } from 'react';
import { canSpeak, onStatus, type LumoStatus } from './speech';

/** Live AI / voice status from the server (null until loaded, or on static hosting). */
export function useLumoStatus(): { status: LumoStatus | null; canSpeak: boolean } {
  const [status, setStatus] = useState<LumoStatus | null>(null);
  useEffect(() => onStatus(setStatus), []);
  return { status, canSpeak: canSpeak() };
}
