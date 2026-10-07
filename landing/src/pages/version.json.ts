import app from "../../../package.json";
import type { APIRoute } from "astro";
export const prerender = true;
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      version: app.version,
      downloadUrl:
        "https://github.com/hayalows/starlink/releases/latest/download/starlink-ghana-monitor-chrome.zip",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    },
  );
