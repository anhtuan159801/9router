export default {
  id: "agnes",
  priority: 120,
  alias: "agnes",
  aliases: [
    "agnes-ai",
  ],
  uiAlias: "agnes",
  display: {
    name: "Agnes AI",
    icon: "auto_awesome",
    color: "#7C3AED",
    textIcon: "AG",
    website: "https://agnes-ai.com",
    notice: {
      text: "OpenAI-compatible gateway from Agnes AI, offering free API credits on sign-up. Accepts a bearer token or an x-api-key header.",
      apiKeyUrl: "https://platform.agnes-ai.com",
    },
  },
  category: "freeTier",
  authType: "apikey",
  transport: {
    baseUrl: "https://apihub.agnes-ai.com/v1/chat/completions",
    validateUrl: "https://apihub.agnes-ai.com/v1/models",
  },
  serviceKinds: ["llm", "image", "imageToText", "video"],
  imageConfig: {
    baseUrl: "https://apihub.agnes-ai.com/v1/images/generations",
  },
  // Async video jobs — OpenAI Videos-compatible. Create: POST /v1/videos
  // (handled by the agnes adapter, which also drives the non-standard
  // retrieval endpoint GET /agnesapi?video_id=<id>). Docs:
  // https://wiki.agnes-ai.com/en/docs/agnes-video-25
  videoConfig: {
    baseUrl: "https://apihub.agnes-ai.com/v1",
    retrieval: { baseUrl: "https://apihub.agnes-ai.com/agnesapi" },
  },
  // Seeds so the dashboard has something to show before a key is saved and
  // /v1/models answers with a usable list. The live catalogue at
  // apihub.agnes-ai.com/v1/models requires a token (401 "Token not provided"),
  // so these ids are a curated starting set rather than a verified dump —
  // passthroughModels below still accepts any id the account actually has.
  models: [
    { id: "agnes-2.5-flash", name: "Agnes 2.5 Flash" },
    { id: "agnes-2.5-pro", name: "Agnes 2.5 Pro" },
    { id: "agnes-2.5-pro-beta", name: "Agnes 2.5 Pro Beta" },
    { id: "agnes-3.0-flash", name: "Agnes 3.0 Flash" },
    { id: "agnes-image-2.5-flash", name: "Agnes Image 2.5 Flash", kind: "image" },
    { id: "agnes-video-2.5", name: "Agnes Video 2.5", params: ["seconds", "size", "aspect_ratio"], kind: "video" },
    { id: "agnes-video-2.5-flash", name: "Agnes Video 2.5 Flash", params: ["seconds", "size", "aspect_ratio"], kind: "video" },
  ],
  passthroughModels: true,
};
