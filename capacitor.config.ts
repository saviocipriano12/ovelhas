import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.saviocipriano.ovelhas",
  appName: "Ovelhas",
  webDir: ".next",
  server: {
    url: "https://ovelhas.vercel.app",
    cleartext: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#064e3b",
    },
  },
};

export default config;
