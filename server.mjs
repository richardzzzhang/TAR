import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const dataDirectory = resolve(root, ".data");
const messagesFile = resolve(dataDirectory, "messages.json");
const maxRequestBytes = 4096;
const maxMessages = 500;
const clients = new Set();
let messages = [];
let saveQueue = Promise.resolve();

try {
  messages = JSON.parse(await readFile(messagesFile, "utf8"));
  if (!Array.isArray(messages)) throw new Error("Message store must contain an array.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

await mkdir(dataDirectory, { recursive: true });

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(value));
}

function broadcast(message) {
  const event = `data: ${JSON.stringify(message)}\n\n`;
  for (const client of clients) client.write(event);
}

async function readJsonBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxRequestBytes) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.status = 400;
    throw error;
  }
}

async function handleMessagePost(request, response) {
  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    sendJson(response, error.status || 400, { error: error.message });
    return;
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    sendJson(response, 400, { error: "Request body must be an object." });
    return;
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 500) {
    sendJson(response, 400, { error: "Messages must be between 1 and 500 characters." });
    return;
  }

  const message = {
    id: randomUUID(),
    text,
    createdAt: new Date().toISOString()
  };

  const save = saveQueue.then(async () => {
    const updatedMessages = [...messages, message].slice(-maxMessages);
    await writeFile(messagesFile, `${JSON.stringify(updatedMessages, null, 2)}\n`);
    messages = updatedMessages;
    broadcast(message);
  });
  saveQueue = save.catch(() => {});

  try {
    await save;
    sendJson(response, 201, { message });
  } catch (error) {
    console.error("Couldn’t save message:", error);
    sendJson(response, 500, { error: "Message couldn’t be saved. Please try again." });
  }
}

function handleEvents(request, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  response.write(": connected\n\n");
  clients.add(response);
  request.on("close", () => clients.delete(response));
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".mp4": "video/mp4"
};
const staticFiles = new Map([
  ["/", resolve(root, "index.html")],
  ["/index.html", resolve(root, "index.html")],
  ["/invite.mp4", resolve(root, "invite.mp4")]
]);

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, "http://localhost");

  if (pathname === "/api/messages") {
    if (request.method === "GET") {
      sendJson(response, 200, messages);
    } else if (request.method === "POST") {
      await handleMessagePost(request, response);
    } else {
      response.writeHead(405, { Allow: "GET, POST" });
      response.end();
    }
    return;
  }

  if (pathname === "/api/messages/events") {
    if (request.method === "GET") {
      handleEvents(request, response);
    } else {
      response.writeHead(405, { Allow: "GET" });
      response.end();
    }
    return;
  }

  const file = staticFiles.get(pathname);
  if (!file || request.method !== "GET") {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  try {
    const contents = await readFile(file);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(file)],
      "Cache-Control": "no-cache"
    });
    response.end(contents);
  } catch (error) {
    console.error("Couldn’t serve requested file:", error);
    response.writeHead(500);
    response.end("Unable to serve file");
  }
});

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () => {
  console.log(`CLUB TAR prototype running at http://${host}:${port}`);
});
