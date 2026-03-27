import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: reminders, error } = await supabase
      .from("user_reminders")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reminders:", error);
      return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
    }

    return NextResponse.json({ success: true, reminders: reminders || [] });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { title } = await request.json();

    if (!title || title.trim() === "") {
      return NextResponse.json({ error: "Reminder title is required" }, { status: 400 });
    }

    const { data: reminder, error } = await supabase
      .from("user_reminders")
      .insert([
        {
          user_id: session.user.id,
          title: title.trim(),
          type: "default"
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating reminder:", error);
      return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
    }

    return NextResponse.json({ success: true, reminder });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reminderId = searchParams.get("id");

    if (!reminderId) {
      return NextResponse.json({ error: "Reminder ID is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_reminders")
      .delete()
      .eq("id", reminderId)
      .eq("user_id", session.user.id);

    if (error) {
      console.error("Error deleting reminder:", error);
      return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 