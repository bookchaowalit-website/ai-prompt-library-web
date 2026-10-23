import { NextResponse } from "next/server";
import { SEED, filterRecipes, type Area, type Stage, AREAS, STAGES } from "@/lib/prompts";

// Stateless JSON-RPC MCP endpoint over the sample prompt recipes the page starts with.
// Recipes a visitor adds or edits live only in that visitor's browser, so the server cannot see them.

type RpcRequest = { id?: number | string | null; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };

const TOOLS = [
  { name: "get_all", description: "List the sample prompt recipes", inputSchema: { type: "object", properties: {} } },
  { name: "get_by_id", description: "Get one sample prompt recipe by id", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  {
    name: "search",
    description: "Search sample recipes by text, optionally filtered by stage and area",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, stage: { type: "string", enum: ["All", ...STAGES] }, area: { type: "string", enum: ["All", ...AREAS] } },
      required: ["query"],
    },
  },
];

class RpcError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

function callTool(name: string | undefined, args: Record<string, unknown> = {}) {
  switch (name) {
    case "get_all":
      return { recipes: SEED };
    case "get_by_id": {
      const recipe = SEED.find((entry) => entry.id === args.id);
      if (!recipe) throw new RpcError(-32602, `No recipe with id ${String(args.id)}`);
      return { recipe };
    }
    case "search": {
      const stage = STAGES.includes(args.stage as Stage) ? (args.stage as Stage) : "All";
      const area = AREAS.includes(args.area as Area) ? (args.area as Area) : "All";
      return { recipes: filterRecipes(SEED, stage, area, typeof args.query === "string" ? args.query : "") };
    }
    default:
      throw new RpcError(-32602, `Unknown tool: ${String(name)}`);
  }
}

export async function POST(request: Request) {
  let id: RpcRequest["id"] = null;
  try {
    const body = (await request.json()) as RpcRequest;
    id = body.id ?? null;
    let result: unknown;
    switch (body.method) {
      case "initialize":
        result = { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "Prompt Workbench", version: "1.0.0" } };
        break;
      case "tools/list":
        result = { tools: TOOLS };
        break;
      case "tools/call":
        result = callTool(body.params?.name, body.params?.arguments);
        break;
      default:
        throw new RpcError(-32601, `Unknown method: ${String(body.method)}`);
    }
    return NextResponse.json({ jsonrpc: "2.0", id, result });
  } catch (error) {
    const code = error instanceof RpcError ? error.code : -32700;
    const message = error instanceof RpcError ? error.message : "Parse error";
    return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 400 });
  }
}
