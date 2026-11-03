import { MCP_NAME, MCP_URL } from "./site";

const b64 = (s: string) => (typeof btoa === "function" ? btoa(s) : Buffer.from(s).toString("base64"));

/** One-click install links (open the editor's own "add MCP server" flow). */
export const CURSOR_INSTALL = `cursor://anysphere.cursor-deeplink/mcp/install?name=${MCP_NAME}&config=${encodeURIComponent(b64(JSON.stringify({ url: MCP_URL })))}`;
export const VSCODE_INSTALL = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: MCP_NAME, type: "http", url: MCP_URL }))}`;

export interface AgentClient {
  id: string;
  name: string;
  /** Where the snippet goes, shown above it. */
  where: string;
  lang: "bash" | "json" | "toml" | "text";
  code: string;
  install?: { href: string; label: string };
  note?: string;
}

export const AGENT_CLIENTS: AgentClient[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    where: "Run once in your terminal (add --scope user to enable it in every project)",
    lang: "bash",
    code: `claude mcp add --transport http ${MCP_NAME} ${MCP_URL}`,
  },
  {
    id: "cursor",
    name: "Cursor",
    where: ".cursor/mcp.json in your project, or ~/.cursor/mcp.json for all projects",
    lang: "json",
    code: JSON.stringify({ mcpServers: { [MCP_NAME]: { url: MCP_URL } } }, null, 2),
    install: { href: CURSOR_INSTALL, label: "Add to Cursor" },
  },
  {
    id: "vscode",
    name: "VS Code",
    where: ".vscode/mcp.json (GitHub Copilot agent mode)",
    lang: "json",
    code: JSON.stringify({ servers: { [MCP_NAME]: { type: "http", url: MCP_URL } } }, null, 2),
    install: { href: VSCODE_INSTALL, label: "Add to VS Code" },
  },
  {
    id: "claude-desktop",
    name: "Claude apps",
    where: "Claude desktop or claude.ai → Settings → Connectors → Add custom connector",
    lang: "text",
    code: `Name: Image Asset Server\nURL:  ${MCP_URL}`,
  },
  {
    id: "windsurf",
    name: "Windsurf",
    where: "~/.codeium/windsurf/mcp_config.json",
    lang: "json",
    code: JSON.stringify({ mcpServers: { [MCP_NAME]: { serverUrl: MCP_URL } } }, null, 2),
  },
  {
    id: "codex",
    name: "Codex CLI",
    where: "~/.codex/config.toml",
    lang: "toml",
    code: `[mcp_servers.${MCP_NAME}]\nurl = "${MCP_URL}"`,
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    where: "Run once in your terminal",
    lang: "bash",
    code: `gemini mcp add --transport http ${MCP_NAME} ${MCP_URL}`,
  },
  {
    id: "other",
    name: "Any client",
    where: "Clients that only speak stdio can bridge to the HTTP endpoint",
    lang: "json",
    code: JSON.stringify({ mcpServers: { [MCP_NAME]: { command: "npx", args: ["-y", "mcp-remote", MCP_URL] } } }, null, 2),
  },
];

export const EXAMPLE_PROMPTS = [
  "Find a wide 4K photo of a misty forest I can use in a client's hero section, and tell me the credit line",
  "Pick the images for this landing page: a hero of a mountain lake, icons for upload, share and settings, and a paper texture background",
  "Get Hubble's Crab Nebula from NASA and download a 1920 px copy into ./images",
  "I need a public-domain Hokusai print for a book cover; check the licence and which museum it's from",
];
