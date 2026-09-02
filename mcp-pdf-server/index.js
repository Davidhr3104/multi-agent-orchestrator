#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import puppeteer from "puppeteer";
import { extractText, getDocumentProxy } from "unpdf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");

const PDF_OPTIONS = {
  format: "A4",
  printBackground: true,
  margin: {
    top: "16mm",
    right: "14mm",
    bottom: "16mm",
    left: "14mm",
  },
};

const TOOLS = [
  {
    name: "generate_pdf_from_html",
    description:
      "Renders an HTML string with Puppeteer and saves it as an A4 PDF.",
    inputSchema: {
      type: "object",
      properties: {
        html: {
          type: "string",
          description: "Full HTML document or fragment to render.",
        },
        filename: {
          type: "string",
          description:
            "Output file name, with or without .pdf (saved under the server output folder).",
        },
      },
      required: ["html", "filename"],
      additionalProperties: false,
    },
  },
  {
    name: "generate_pdf_from_url",
    description:
      "Navigates to a URL with Puppeteer and saves the page as an A4 PDF.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Absolute http(s) URL to capture.",
        },
        filename: {
          type: "string",
          description:
            "Output file name, with or without .pdf (saved under the server output folder).",
        },
      },
      required: ["url", "filename"],
      additionalProperties: false,
    },
  },
  {
    name: "extract_text_from_pdf",
    description:
      "Extracts plain text from a PDF previously saved in this server's output folder.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "PDF file name inside the output folder.",
        },
      },
      required: ["filename"],
      additionalProperties: false,
    },
  },
];

function textResult(text, isError = false) {
  return {
    content: [{ type: "text", text }],
    isError,
  };
}

function sanitizeFilename(filename) {
  if (typeof filename !== "string" || !filename.trim()) {
    throw new Error("filename is required and must be a non-empty string.");
  }

  const base = path.basename(filename.trim());
  const withExt = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
  const safe = withExt.replace(/[^a-zA-Z0-9._-]/g, "_");

  if (!safe || safe === ".pdf") {
    throw new Error("filename is invalid after sanitization.");
  }

  return safe;
}

function resolveOutputPath(filename) {
  const safeName = sanitizeFilename(filename);
  const outputPath = path.resolve(OUTPUT_DIR, safeName);
  const outputRoot = path.resolve(OUTPUT_DIR) + path.sep;

  if (!outputPath.startsWith(outputRoot) && outputPath !== path.resolve(OUTPUT_DIR)) {
    throw new Error("Refusing to write outside the output directory.");
  }

  return outputPath;
}

async function withBrowserPage(run) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    return await run(page);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function generatePdfFromHtml({ html, filename }) {
  if (typeof html !== "string" || !html.trim()) {
    throw new Error("html is required and must be a non-empty string.");
  }

  const outputPath = resolveOutputPath(filename);
  await mkdir(OUTPUT_DIR, { recursive: true });

  await withBrowserPage(async (page) => {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf(PDF_OPTIONS);
    await writeFile(outputPath, pdfBuffer);
  });

  return outputPath;
}

async function generatePdfFromUrl({ url, filename }) {
  if (typeof url !== "string" || !url.trim()) {
    throw new Error("url is required and must be a non-empty string.");
  }

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("url must be a valid absolute URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("url must use http or https.");
  }

  const outputPath = resolveOutputPath(filename);
  await mkdir(OUTPUT_DIR, { recursive: true });

  await withBrowserPage(async (page) => {
    await page.goto(parsed.toString(), {
      waitUntil: "networkidle0",
      timeout: 60_000,
    });
    const pdfBuffer = await page.pdf(PDF_OPTIONS);
    await writeFile(outputPath, pdfBuffer);
  });

  return outputPath;
}

async function extractTextFromPdf({ filename }) {
  const outputPath = resolveOutputPath(filename);
  const bytes = new Uint8Array(await readFile(outputPath));
  const pdf = await getDocumentProxy(bytes);
  const extracted = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(extracted.text)
    ? extracted.text.join("\n\n")
    : String(extracted.text ?? "");
  if (!text.trim()) {
    throw new Error("No extractable text in this PDF.");
  }
  return text.trim();
}

const server = new Server(
  {
    name: "mcp-pdf-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};

  try {
    if (name === "generate_pdf_from_html") {
      const outputPath = await generatePdfFromHtml(args);
      return textResult(
        `PDF generated successfully from HTML.\nSaved to: ${outputPath}`
      );
    }

    if (name === "generate_pdf_from_url") {
      const outputPath = await generatePdfFromUrl(args);
      return textResult(
        `PDF generated successfully from URL.\nSaved to: ${outputPath}`
      );
    }

    if (name === "extract_text_from_pdf") {
      const text = await extractTextFromPdf(args);
      return textResult(text);
    }

    return textResult(`Unknown tool: ${name}`, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return textResult(`Failed to generate PDF: ${message}`, true);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal MCP server error:", error);
  process.exit(1);
});
