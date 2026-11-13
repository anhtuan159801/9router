// Agnes AI video jobs — https://wiki.agnes-ai.com/en/docs/agnes-video-25
//
// Differs from the xAI default shape in two ways:
//  - creation POSTs to the collection root ({baseUrl}/videos) instead of
//    /videos/generations, and
//  - retrieval does NOT poll {baseUrl}/{id}. Agnes exposes a dedicated
//    query endpoint (?video_id=<id>) that must be called instead.
//
// Both the create and retrieve responses are passed through verbatim
// (status / progress / url), so no transformResponse is needed.
//
// Polls carry no model (see handleVideoGet), so we retrieve by video_id only.
// That is the form Agnes documents as valid for text-to-video — the most
// common case. Keyframe/reference jobs would need model_name; they are not
// reachable through the poll path today and fall back to text retrieval.
import { URL } from "node:url";

const SUPPORTED_ACTIONS = new Set(["generations"]);

function headers(config, token) {
  return {
    Accept: "application/json",
    ...(config.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default {
  buildRequest({ config, action, requestId, rawBody, contentType, token }) {
    const createBase = (config.baseUrl || "").replace(/\/$/, "");

    if (requestId) {
      // Poll: GET {retrieveBaseUrl}?video_id=<id>
      const retrieveBase = (config.retrieval?.baseUrl || "https://apihub.agnes-ai.com/agnesapi").replace(/\/$/, "");
      const u = new URL(retrieveBase);
      u.searchParams.set("video_id", requestId);
      return { method: "GET", url: u.toString(), headers: headers(config, token) };
    }

    if (!SUPPORTED_ACTIONS.has(action)) {
      return { error: `Agnes AI video supports 'generations' only (got '${action}')` };
    }
    if (contentType && !contentType.includes("application/json")) {
      return { error: "Agnes AI video requires an application/json body" };
    }
    return {
      method: "POST",
      url: `${createBase}/videos`,
      headers: { ...headers(config, token), "Content-Type": "application/json" },
      body: rawBody,
    };
  },
};
