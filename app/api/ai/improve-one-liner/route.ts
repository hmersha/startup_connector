import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/ai/rate-limit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Verify user with Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      if (rateLimit.reason === "cooldown") {
        return NextResponse.json(
          { error: `Please wait ${rateLimit.cooldownSecondsLeft}s before trying again.` },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Daily AI limit reached. Try again tomorrow." },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { builderCard } = body;

    if (!builderCard) {
      return NextResponse.json({ error: "Missing builder card data" }, { status: 400 });
    }

    // Check for OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.error("OPENAI_API_KEY not configured");
      return NextResponse.json(
        { error: "AI service not configured. Please contact support." },
        { status: 500 }
      );
    }

    // Build prompt
    const prompt = buildOneLinerPrompt(builderCard);

    // Call OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a startup pitch coach. Generate compelling one-liner descriptions for founder profiles. Each one-liner must be under 140 characters. Be specific and avoid jargon.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", response.status, errorData);
      return NextResponse.json(
        { error: "Failed to generate suggestions. Please try again." },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: "Failed to generate suggestions. Please try again." },
        { status: 500 }
      );
    }

    // Parse the three options from the response
    const options = parseOneLinerOptions(content);

    if (options.length === 0) {
      return NextResponse.json(
        { error: "Failed to parse suggestions. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      options,
      remainingDaily: rateLimit.remainingDaily,
    });
  } catch (error) {
    console.error("Improve one-liner error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

function buildOneLinerPrompt(builderCard: {
  one_liner?: string;
  categories?: string[];
  stage?: string;
  looking_for?: string[];
  skills?: string[];
}): string {
  return `Generate 3 improved one-liner options for a startup founder profile.

CURRENT PROFILE:
- Current one-liner: "${builderCard.one_liner || "(empty)"}"
- Categories: ${(builderCard.categories || []).join(", ") || "not specified"}
- Stage: ${builderCard.stage || "early stage"}
- Looking for: ${(builderCard.looking_for || []).join(", ") || "collaborators"}
- Skills: ${(builderCard.skills || []).join(", ") || "various"}

Generate exactly 3 one-liner options, each MUST be under 140 characters:

1. DIRECT style: Clear, straightforward, focuses on what they're building
2. FRIENDLY style: Warm, approachable, invites collaboration
3. BOLD style: Confident, memorable, makes a strong statement

Format your response exactly like this:
DIRECT: [one-liner here]
FRIENDLY: [one-liner here]
BOLD: [one-liner here]

Remember: Each must be under 140 characters and specific to their profile.`;
}

function parseOneLinerOptions(content: string): Array<{ style: string; text: string }> {
  const options: Array<{ style: string; text: string }> = [];
  const lines = content.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    const directMatch = line.match(/^DIRECT:\s*(.+)$/i);
    const friendlyMatch = line.match(/^FRIENDLY:\s*(.+)$/i);
    const boldMatch = line.match(/^BOLD:\s*(.+)$/i);

    if (directMatch) {
      options.push({ style: "Direct", text: directMatch[1].trim().slice(0, 140) });
    } else if (friendlyMatch) {
      options.push({ style: "Friendly", text: friendlyMatch[1].trim().slice(0, 140) });
    } else if (boldMatch) {
      options.push({ style: "Bold", text: boldMatch[1].trim().slice(0, 140) });
    }
  }

  return options;
}
