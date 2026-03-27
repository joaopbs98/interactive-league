import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    console.log("Fetching user profile API route called");
    
    // Create Supabase client
    const supabase = await createClient();

    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Session error:", sessionError);
      return NextResponse.json(
        { error: "Session error: " + sessionError.message },
        { status: 401 }
      );
    }
    
    if (!session) {
      console.log("No session found");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.log("User ID from session:", session.user.id);

    // Fetch user profile from auth.users and profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(`
        id,
        user_id,
        username,
        full_name,
        avatar_url,
        team_id,
        is_host,
        created_at,
        updated_at
      `)
      .eq("user_id", session.user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      
      // If profile doesn't exist, create a basic one
      if (profileError.code === 'PGRST116') {
        console.log("Profile not found, creating basic profile");
        
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert([
            {
              user_id: session.user.id,
              username: session.user.email?.split('@')[0] || 'user',
              full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
              avatar_url: session.user.user_metadata?.avatar_url || null,
              is_host: false
            }
          ])
          .select()
          .single();

        if (createError) {
          console.error("Error creating profile:", createError);
          return NextResponse.json(
            { error: "Failed to create user profile" },
            { status: 500 }
          );
        }

        console.log("Successfully created user profile");
        return NextResponse.json({
          success: true,
          profile: newProfile
        });
      }

      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      );
    }

    console.log("Successfully fetched user profile");
    return NextResponse.json({
      success: true,
      profile: profile
    });

  } catch (error: any) {
    console.error("Fetch user profile API route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
} 