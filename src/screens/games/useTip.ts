import { useEffect, useRef } from 'react';
import { getTip, type TipRequest } from '../../services/ai';

/**
 * Fetches an AI hint for the current item as soon as it appears, so it's ready
 * the moment it's needed. Returns a ref: null until (and unless) a valid tip arrives.
 */
export function useTip(req: TipRequest) {
  const tip = useRef<string | null>(null);
  useEffect(() => {
    let live = true;
    void getTip(req).then((t) => { if (live) tip.current = t; });
    return () => { live = false; };
    // One request per item; the item component remounts for each word.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return tip;
}
