import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    console.log("Logout API route called");
    
    // Create Supabase client
    const supabase = await createClient();

    // Sign out the user
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error("Logout error:", error);
      return NextResponse.json(
        { error: "Logout failed: " + error.message },
        { status: 500 }
      );
    }

    console.log("User logged out successfully");
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Logout API route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
} 