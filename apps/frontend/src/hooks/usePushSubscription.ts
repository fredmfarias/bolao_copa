'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';
import type { Usuario } from '@/types/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushSubscription(user: Usuario | null) {
  useEffect(() => {
    if (
      !user ||
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) return;

    if (Notification.permission === 'denied') return;

    let cancelled = false;

    async function subscribe() {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (cancelled) return;

        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          const keys = existing.toJSON().keys;
          if (keys?.p256dh && keys?.auth) {
            await api.post('/notificacoes/subscribe', {
              endpoint: existing.endpoint,
              p256dh: keys.p256dh,
              auth: keys.auth,
            }).catch(() => {});
          }
          return;
        }

        const permission = await Notification.requestPermission();
        if (cancelled || permission !== 'granted') return;

        const { key } = await api.get<{ key: string }>('/notificacoes/vapid-public-key');
        if (cancelled || !key) return;

        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key).buffer as ArrayBuffer,
        });

        const subJson = sub.toJSON();
        const keys = subJson.keys;
        if (!keys?.p256dh || !keys?.auth) return;

        await api.post('/notificacoes/subscribe', {
          endpoint: subJson.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        });
      } catch (err) {
        console.warn('[push] erro ao registrar subscription:', err);
      }
    }

    subscribe();
    return () => { cancelled = true; };
  }, [user?.id]);  // re-run se trocar de usuário
}
