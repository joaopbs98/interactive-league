import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active'; // 'active' or 'finished'
    const leagueId = searchParams.get('leagueId');
    
    // Fetch auctions (filter by league if provided)
    let query = supabase
      .from('auctions')
      .select(`
        *,
        player:player_id(*),
        bids(
          *,
          team:team_id(id, name)
        )
      `)
      .eq('status', status)
      .order('end_time', { ascending: true });
    if (leagueId) query = query.eq('league_id', leagueId);
    const { data: auctions, error } = await query;

    if (error) {
      console.error('Error fetching auctions:', error);
      return NextResponse.json({ error: "Failed to fetch auctions" }, { status: 500 });
    }

    // Process auctions to include user's bid status
    const processedAuctions = (auctions || []).map(auction => {
      const bids = auction.bids || [];
      type BidItem = { amount: number; team?: { name?: string } };
      const highestBid: BidItem | null = bids.length > 0
        ? (bids as BidItem[]).reduce((max, bid) => (bid.amount > max.amount ? bid : max), bids[0] as BidItem)
        : null;
      
      // Find user's bid (assuming user has a team)
      const userBid = (bids as { team?: { user_id?: string }; amount: number }[]).find(
        (bid) => bid.team?.user_id === session.user.id
      );
      
      let userPosition: { status: 'winning' | 'losing' | 'none'; rating?: number } = { status: 'none' };
      if (userBid) {
        if (highestBid && userBid.amount >= highestBid.amount) {
          userPosition = { status: 'winning', rating: userBid.amount };
        } else {
          userPosition = { status: 'losing', rating: userBid.amount };
        }
      }

      return {
        id: auction.id,
        player: auction.player,
        timeLeft: calculateTimeLeft(auction.end_time),
        bestOffer: highestBid ? {
          teamName: highestBid.team?.name || 'Unknown',
          rating: highestBid.amount
        } : null,
        yourPosition: userPosition,
        finished: auction.status === 'finished'
      };
    });

    return NextResponse.json({ auctions: processedAuctions });

  } catch (error: any) {
    console.error('Auctions API error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { auctionId, amount, leagueId } = body;

    if (!auctionId || !amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid bid data" }, { status: 400 });
    }

    // Get user's team (prefer league-scoped if leagueId provided)
    let query = supabase.from('teams').select('id, budget, league_id').eq('user_id', session.user.id);
    if (leagueId) query = query.eq('league_id', leagueId);
    const { data: userTeam, error: teamError } = await query.single();

    if (teamError || !userTeam) {
      return NextResponse.json({ error: "User team not found" }, { status: 404 });
    }

    // Phase lock (per final_doc 3.3): no roster moves during IN_SEASON
    if (userTeam.league_id) {
      const { data: league } = await supabase.from('leagues').select('status').eq('id', userTeam.league_id).single();
      if (league?.status === 'IN_SEASON') {
        return NextResponse.json({ error: "Cannot bid during the season" }, { status: 400 });
      }
    }

    // Roster cap (per IL25 spec): block if roster would exceed 23 after winning
    const { count } = await supabase.from('league_players').select('*', { count: 'exact', head: true }).eq('team_id', userTeam.id);
    if ((count ?? 0) >= 23) {
      return NextResponse.json({ error: "Roster is full (23 players max)" }, { status: 400 });
    }

    // Check if user has enough budget
    if ((userTeam.budget ?? 0) < amount) {
      return NextResponse.json({ error: "Insufficient budget" }, { status: 400 });
    }

    // Get auction details
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('*')
      .eq('id', auctionId)
      .eq('status', 'active')
      .single();

    if (auctionError || !auction) {
      return NextResponse.json({ error: "Auction not found or not active" }, { status: 404 });
    }

    // Check if auction has ended
    if (new Date(auction.end_time) <= new Date()) {
      return NextResponse.json({ error: "Auction has ended" }, { status: 400 });
    }

    // Get current highest bid
    const { data: currentBids, error: bidsError } = await supabase
      .from('bids')
      .select('amount')
      .eq('auction_id', auctionId)
      .order('amount', { ascending: false })
      .limit(1);

    if (bidsError) {
      console.error('Error fetching current bids:', bidsError);
      return NextResponse.json({ error: "Failed to check current bids" }, { status: 500 });
    }

    const currentHighest = currentBids?.[0]?.amount || 0;
    if (amount % 100000 !== 0) {
      return NextResponse.json({ error: "Bid must be in $100,000 increments" }, { status: 400 });
    }
    if (amount < currentHighest + 100000) {
      return NextResponse.json({ error: "Bid must be at least $100,000 higher than current highest" }, { status: 400 });
    }

    // Create the bid
    const { error: bidError } = await supabase
      .from('bids')
      .insert({
        auction_id: auctionId,
        team_id: userTeam.id,
        amount: amount,
        created_at: new Date().toISOString()
      });

    if (bidError) {
      console.error('Error creating bid:', bidError);
      return NextResponse.json({ error: "Failed to place bid" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Bid placed successfully" 
    });

  } catch (error: any) {
    console.error('Place bid API error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function calculateTimeLeft(endTime: string): string {
  const end = new Date(endTime);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return "0m";
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
} 