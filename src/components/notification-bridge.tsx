"use client";

import { useEffect } from "react";
import { sendDeviceNotification } from "@/lib/device-notifications";
import { usePastoralNotifications } from "@/lib/use-pastoral-notifications";

export function NotificationBridge() {
  const { unread } = usePastoralNotifications();

  useEffect(() => {
    const nextNotification = unread.find((item) => item.priority === "Urgente") ?? unread.find((item) => item.priority === "Alta");

    if (!nextNotification) {
      return;
    }

    sendDeviceNotification({
      id: nextNotification.id,
      title: nextNotification.title,
      body: nextNotification.description,
      url: nextNotification.href,
    }).catch(() => undefined);
  }, [unread]);

  return null;
}
