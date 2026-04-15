import { execSync } from "child_process";

const commitMessage = `feat: add Scout supplier chat interface with file attachment support

Scaffold a mobile-first Next.js PWA for the Scout hackathon demo that
lets suppliers provide product-level sustainability data through a
conversational iMessage-style chat.

Key additions:
- Next.js 15 App Router project structure (layout, globals.css,
  tailwind config, postcss, tsconfig) replacing the previous Vite/Hono
  dev setup while preserving the MCP server source under src/.
- Chat page at /chat/[engagementId] with mocked agent logic that
  collects fibre composition, dye process, and recycled-content
  percentage through natural-language keyword matching.
- Header card showing the Scout wordmark (Sofia Sans 800), product
  context, and three live status chips (Fibre, Dye, Recycled) that
  turn green as data is captured.
- File attachment support: paperclip button opens a native file picker
  accepting PDFs, images, Word/Excel docs, CSVs, and plain text.
  Selected files stage above the input bar with previews and can be
  removed before sending. Sent attachments render inline as tappable
  chips inside message bubbles.
- shadcn/ui primitives (Button, Card, Input) wired to a custom
  Ice-White / Ocean-Blue design-token palette.
- iOS safe-area padding and typing-indicator animation for a native
  feel on mobile.`;

function run(cmd) {
  console.log(`> ${cmd}`);
  const output = execSync(cmd, { cwd: "/vercel/share/v0-project", encoding: "utf-8" });
  if (output.trim()) console.log(output.trim());
}

run("git add -A");
run(`git commit -m ${JSON.stringify(commitMessage)}`);
run("git push origin supplier-chat-interface");

console.log("Done! Committed and pushed to supplier-chat-interface.");
