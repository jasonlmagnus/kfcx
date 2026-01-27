import { NextRequest, NextResponse } from "next/server";
import { readOpportunities, writeOpportunities } from "@/lib/data/store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const urgency = searchParams.get("urgency");
  const status = searchParams.get("status");

  const data = await readOpportunities();
  if (!data) {
    return NextResponse.json(
      {
        error: "Opportunity analysis has not been generated yet. Run the reindex process.",
        empty: true,
      },
      { status: 200 }
    );
  }

  let opportunities = data.opportunities;

  if (type) {
    opportunities = opportunities.filter((o) => o.type === type);
  }
  if (urgency) {
    opportunities = opportunities.filter((o) => o.urgency === urgency);
  }
  if (status) {
    opportunities = opportunities.filter((o) => o.status === status);
  }

  return NextResponse.json({
    lastGenerated: data.lastGenerated,
    opportunities,
  });
}

export async function PATCH(request: NextRequest) {
  const { id, status } = await request.json();

  if (!id || !status) {
    return NextResponse.json(
      { error: "id and status are required" },
      { status: 400 }
    );
  }

  const data = await readOpportunities();
  if (!data) {
    return NextResponse.json(
      { error: "No opportunities data found" },
      { status: 404 }
    );
  }

  const opp = data.opportunities.find((o) => o.id === id);
  if (!opp) {
    return NextResponse.json(
      { error: "Opportunity not found" },
      { status: 404 }
    );
  }

  opp.status = status;
  await writeOpportunities(data);

  return NextResponse.json({ success: true, opportunity: opp });
}
