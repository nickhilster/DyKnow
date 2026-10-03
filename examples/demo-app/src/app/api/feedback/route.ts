type FeedbackPayload = {
  message?: unknown;
};

export function GET() {
  return Response.json({
    route: "/api/feedback",
    methods: ["GET", "POST"],
    requiredField: "message",
  });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | FeedbackPayload
    | null;
  const message =
    typeof payload?.message === "string" ? payload.message.trim() : "";

  if (message.length < 3) {
    return Response.json(
      { error: "message must be at least 3 characters long" },
      { status: 400 },
    );
  }

  return Response.json({
    status: "received",
    preview: message.slice(0, 60),
  });
}
