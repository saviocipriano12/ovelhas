"use client";

import { Capacitor } from "@capacitor/core";

export const DEVICE_NOTIFICATIONS_KEY = "ovelhas:device-notifications-enabled";
const LAST_SENT_KEY = "ovelhas:last-device-notification";

export type DeviceNotificationPayload = {
  id: string;
  title: string;
  body: string;
  url?: string;
};

export function notificationsSupported() {
  if (typeof window === "undefined") {
    return false;
  }

  return Capacitor.isNativePlatform() || "Notification" in window;
}

export function notificationsEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(DEVICE_NOTIFICATIONS_KEY) === "true";
}

export function setNotificationsEnabled(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEVICE_NOTIFICATIONS_KEY, enabled ? "true" : "false");
}

export function wasNotificationSent(id: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(LAST_SENT_KEY) === id;
}

export function markNotificationSent(id: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LAST_SENT_KEY, id);
}

export async function requestDeviceNotificationPermission() {
  if (!notificationsSupported()) {
    return { ok: false, status: "unsupported" as const };
  }

  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const result = await LocalNotifications.requestPermissions();
    const granted = result.display === "granted";
    setNotificationsEnabled(granted);
    return { ok: granted, status: result.display };
  }

  const result = await Notification.requestPermission();
  const granted = result === "granted";
  setNotificationsEnabled(granted);
  return { ok: granted, status: result };
}

export async function sendDeviceNotification(payload: DeviceNotificationPayload) {
  if (!notificationsSupported() || !notificationsEnabled() || wasNotificationSent(payload.id)) {
    return false;
  }

  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.abs(hashString(payload.id)),
          title: payload.title,
          body: payload.body,
          schedule: { at: new Date(Date.now() + 700) },
          extra: { url: payload.url ?? "/notificacoes" },
        },
      ],
    });
    markNotificationSent(payload.id);
    return true;
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration?.showNotification) {
    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: payload.url ?? "/notificacoes" },
    });
  } else {
    const notification = new Notification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      data: { url: payload.url ?? "/notificacoes" },
    });
    notification.onclick = () => {
      window.focus();
      window.location.href = payload.url ?? "/notificacoes";
    };
  }

  markNotificationSent(payload.id);
  return true;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return hash || 1;
}
