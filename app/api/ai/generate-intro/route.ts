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
    const { currentUser, targetUser } = body;

    if (!currentUser || !targetUser) {
      return NextResponse.json({ error: "Missing user data" }, { status: 400 });
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
    const prompt = buildIntroPrompt(currentUser, targetUser);

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
              "You are helping startup founders connect. Write concise, authentic intro messages. No fluff. Be specific about why they should connect based on their profiles.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", response.status, errorData);
      return NextResponse.json(
        { error: "Failed to generate intro. Please try again." },
        { status: 500 }
      );
    }

    const data = await response.json();
    const intro = data.choices?.[0]?.message?.content?.trim();

    if (!intro) {
      return NextResponse.json(
        { error: "Failed to generate intro. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      intro,
      remainingDaily: rateLimit.remainingDaily,
    });
  } catch (error) {
    console.error("Generate intro error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

function buildIntroPrompt(
  currentUser: {
    username?: string;
    one_liner?: string;
    categories?: string[];
    stage?: string;
    looking_for?: string[];
    skills?: string[];
    school?: string;
  },
  targetUser: {
    username?: string;
    one_liner?: string;
    categories?: string[];
    stage?: string;
    looking_for?: string[];
    skills?: string[];
    school?: string;
  }
): string {
  const currentName = currentUser.username || "I";
  const targetName = targetUser.username || "you";

  // Find overlaps
  const categoryOverlap = (currentUser.categories || []).filter((c) =>
    (targetUser.categories || []).includes(c)
  );
  const skillsIHave = currentUser.skills || [];
  const theyLookingFor = targetUser.looking_for || [];
  const matchingSkills = skillsIHave.filter((s) =>
    theyLookingFor.some((lf) => s.toLowerCase().includes(lf.toLowerCase()))
  );

  return `Write a short intro message (max 80 words) from one founder to another.

SENDER (${currentName}):
- Working on: ${currentUser.one_liner || "a startup"}
- Categories: ${(currentUser.categories || []).join(", ") || "not specified"}
- Stage: ${currentUser.stage || "early"}
- Looking for: ${(currentUser.looking_for || []).join(", ") || "collaborators"}
- Skills: ${(currentUser.skills || []).join(", ") || "various"}
${currentUser.school ? `- School: ${currentUser.school}` : ""}

RECIPIENT (${targetName}):
- Working on: ${targetUser.one_liner || "a startup"}
- Categories: ${(targetUser.categories || []).join(", ") || "not specified"}
- Stage: ${targetUser.stage || "early"}
- Looking for: ${(targetUser.looking_for || []).join(", ") || "collaborators"}
- Skills: ${(targetUser.skills || []).join(", ") || "various"}
${targetUser.school ? `- School: ${targetUser.school}` : ""}

OVERLAPS DETECTED:
- Categories in common: ${categoryOverlap.length > 0 ? categoryOverlap.join(", ") : "none"}
- Sender has skills recipient needs: ${matchingSkills.length > 0 ? matchingSkills.join(", ") : "none"}
${currentUser.school && targetUser.school && currentUser.school === targetUser.school ? "- Same school!" : ""}

Write a friendly, specific intro that:
1. References something specific from their profile or overlap
2. Briefly mentions what you're working on
3. Suggests a quick call or chat
Keep it under 80 words. Don't be generic.`;
}
