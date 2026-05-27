"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export function PwaRegister() {
  useEffect(() => {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "0.0.0.0";

    if (isLocalhost) {
      navigator.serviceWorker?.getRegistrations?.().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });

      caches?.keys?.().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      });

      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          registration.update().catch(() => undefined);
        })
        .catch(() => undefined);
    }

    if (Capacitor.isNativePlatform()) {
      import("@capacitor/local-notifications")
        .then(({ LocalNotifications }) =>
          LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
            const target = event.notification.extra?.url ?? "/notificacoes";
            window.location.href = target;
          }),
        )
        .catch(() => undefined);
    }
  }, []);

  return null;
}
