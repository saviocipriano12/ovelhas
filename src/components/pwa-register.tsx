"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
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
