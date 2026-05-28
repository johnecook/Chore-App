import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chores",
    short_name: "Chores",
    description: "Mobile-first chores and family responsibility tracking.",
    start_url: "/start",
    scope: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#176b5b",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
