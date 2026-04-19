import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages, custom_variables } = await req.json();

    const assistant_id = process.env.YUANQI_ASSISTANT_ID || "2044761886189456576";
    const api_token = process.env.YUANQI_API_TOKEN || "";

    if (!api_token) {
      return new Response(JSON.stringify({ error: "Missing Yuanqi API Token" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const payload = {
      assistant_id,
      user_id: "lexora-web-ts",
      stream: true,
      messages,
      custom_variables
    };

    const response = await fetch("https://yuanqi.tencent.com/openapi/v1/agent/chat/completions", {
      method: "POST",
      headers: {
        "X-Source": "openapi",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${api_token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `API Error: ${response.status}`, details: errorText }), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Return the response stream directly to the client
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
