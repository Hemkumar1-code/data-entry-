import { useEffect, useRef, useState, useCallback } from 'react';
import { db, ref, push, set, update } from '../firebase';
import { getDistance } from 'geolib';

const THROTTLE_MS = 5000; // push to Firebase at most every 5 seconds

export function useLiveTracking(userId) {
  const watchId = useRef(null);
  const lastPushTime = useRef(0);
  const pathRef = useRef([]);

  const [active, setActive] = useState(false);
  const [path, setPath] = useState([]);
  const [distance, setDistance] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [error, setError] = useState(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!userId || active) return;
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    setError(null);
    setActive(true);
    const t = Date.now();
    setStartTime(t);
    pathRef.current = [];
    setPath([]);
    setDistance(0);

    // Mark user as tracking-active
    set(ref(db, `tracking/${userId}/meta`), { active: true, startTime: t });

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          ts: pos.timestamp,
        };

        pathRef.current = [...pathRef.current, point];
        setPath((prev) => {
          if (prev.length > 0) {
            const d = getDistance(prev[prev.length - 1], point);
            setDistance((dist) => dist + d);
          }
          return [...prev, point];
        });

        const now = Date.now();
        if (now - lastPushTime.current >= THROTTLE_MS) {
          lastPushTime.current = now;
          push(ref(db, `tracking/${userId}/points`), point).catch(console.error);
          update(ref(db, `tracking/${userId}/meta`), {
            lastLat: point.latitude,
            lastLng: point.longitude,
            lastTs: point.ts,
            active: true,
          }).catch(console.error);
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }, [userId, active]);

  const stop = useCallback(async () => {
    if (!userId || !active) return null;

    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setActive(false);

    const endTime = Date.now();
    const tripData = {
      path: pathRef.current,
      distance,
      startTime,
      endTime,
      createdAt: endTime,
    };

    // Save trip
    const tripRef = push(ref(db, `trips/${userId}`));
    await set(tripRef, tripData);

    // Mark tracking as inactive
    await update(ref(db, `tracking/${userId}/meta`), { active: false });

    setPath([]);
    setDistance(0);
    setStartTime(null);
    pathRef.current = [];

    return { distance, durationMs: endTime - startTime, tripId: tripRef.key };
  }, [userId, active, distance, startTime]);

  return { active, path, distance, startTime, error, start, stop };
}
