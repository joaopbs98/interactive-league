-- Managers must see the tier of tickets publicly listed in their league.
-- Unlisted ticket inventory remains owner-only.
CREATE POLICY "League members can view listed upgrade tickets"
  ON team_upgrade_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM auctions a
      JOIN teams viewer ON viewer.league_id = a.league_id AND viewer.user_id = auth.uid()
      WHERE a.upgrade_ticket_id = team_upgrade_tickets.id
    )
  );
