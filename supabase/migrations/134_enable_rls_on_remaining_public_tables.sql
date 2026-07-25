-- Reference / catalog tables: read-only for authenticated clients, writes only via service role
ALTER TABLE public.player ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view players catalog"
  ON public.player FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.contract_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view contract values"
  ON public.contract_values FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view sponsors"
  ON public.sponsors FOR SELECT
  TO authenticated
  USING (true);

-- contracts: viewable by anyone with a team in the same league, manageable by league hosts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view contracts from their leagues"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT t.id FROM public.teams t
      WHERE t.league_id IN (SELECT public.get_user_league_ids(auth.uid()))
    )
  );
CREATE POLICY "League hosts can manage contracts"
  ON public.contracts FOR ALL
  TO authenticated
  USING (
    team_id IN (
      SELECT t.id FROM public.teams t
      JOIN public.leagues l ON l.id = t.league_id
      WHERE l.commissioner_user_id = auth.uid()
    )
  );

-- draft_picks: viewable by users with a team in the same league
ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view draft picks from their leagues"
  ON public.draft_picks FOR SELECT
  TO authenticated
  USING (
    league_id IN (SELECT public.get_user_league_ids(auth.uid()))
  );

-- Tables only ever accessed via the service-role client: enable RLS, no policies
-- (deny all to anon/authenticated; service role bypasses RLS)
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wage_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youngster_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youngster_performance ENABLE ROW LEVEL SECURITY;

-- league_players partitions: enable RLS for defense-in-depth (parent table policies
-- already cover access through public.league_players; service role bypasses RLS)
ALTER TABLE public.league_players_p0 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_players_p1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_players_p2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_players_p3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_players_p4 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_players_p5 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_players_p6 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_players_p7 ENABLE ROW LEVEL SECURITY;
