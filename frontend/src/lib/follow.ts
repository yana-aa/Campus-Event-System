import { useCallback, useEffect, useState } from 'react';

const KEY = 'campuspass.followedClubs';

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Follow a host club. Stored per device so students can track clubs without an account change. */
export function useFollowClub(clubId: string): [boolean, () => void] {
  const [following, setFollowing] = useState<boolean>(() => read().includes(clubId));

  useEffect(() => setFollowing(read().includes(clubId)), [clubId]);

  const toggle = useCallback(() => {
    const current = new Set(read());
    if (current.has(clubId)) current.delete(clubId);
    else current.add(clubId);
    try {
      window.localStorage.setItem(KEY, JSON.stringify([...current]));
    } catch {
      // Ignore storage failures; state still updates for this session.
    }
    setFollowing(current.has(clubId));
  }, [clubId]);

  return [following, toggle];
}
