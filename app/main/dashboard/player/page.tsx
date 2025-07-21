"use client";

import React, { useState, FormEvent, useMemo } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { getWageFromCsv } from "@/lib/wageTable";
import { getStatColor } from "@/hooks/getStatColor";

import type { Database } from "@/types/supabase";
type PlayerRow = Database["public"]["Tables"]["player"]["Row"];

function stripAccents(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function PlayerSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerRow[]>([]);
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) search RPC returns accent‐insensitive superset; 2) client‐filter on all tokens
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);

    const norm = stripAccents(query);
    const tokens = norm.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      setLoading(false);
      return;
    }

    const first = tokens[0];
    const { data, error: err } = await supabase.rpc("search_player", {
      query: first,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const filtered = ((data as PlayerRow[]) ?? []).filter((p) => {
      const name = stripAccents(p.full_name ?? "");
      return tokens.every((t) => name.includes(t));
    });

    setResults(filtered);
    setLoading(false);
  };

  const loadPlayer = async (id: string) => {
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("player")
      .select("*")
      .eq("player_id", id)
      .single();

    if (err) {
      setError(err.message);
      setPlayer(null);
    } else {
      setPlayer(data);
    }

    setLoading(false);
  };

  // build radar data
  const radarData = useMemo(() => {
    if (!player) return [];

    const get = <K extends keyof PlayerRow>(k: K) => player[k] ?? 0;
    const spd = get("sprint_speed"),
      acc = get("acceleration"),
      pos = get("positioning"),
      fin = get("finishing"),
      shp = get("shot_power"),
      lsh = get("long_shots"),
      vol = get("volleys"),
      pen = get("penalties"),
      vis = get("vision"),
      crs = get("crossing"),
      fka = get("fk_accuracy"),
      spg = get("short_passing"),
      lpg = get("long_passing"),
      cur = get("curve"),
      agi = get("agility"),
      bal = get("balance"),
      ctl = get("ball_control"),
      drb = get("dribbling"),
      itc = get("interceptions"),
      hea = get("heading_accuracy"),
      daf = get("defensive_awareness"),
      stb = get("standing_tackle"),
      sld = get("sliding_tackle"),
      jmp = get("jumping"),
      stm = get("stamina"),
      str = get("strength"),
      agr = get("aggression");

    const pac = Math.round(0.55 * spd + 0.45 * acc);
    const sho = Math.round(
      0.05 * pos + 0.45 * fin + 0.2 * shp + 0.2 * lsh + 0.05 * vol + 0.05 * pen
    );
    const pas = Math.round(
      0.2 * vis + 0.2 * crs + 0.05 * fka + 0.35 * spg + 0.15 * lpg + 0.05 * cur
    );
    const dri = Math.round(0.1 * agi + 0.05 * bal + 0.35 * ctl + 0.5 * drb);
    const def = Math.round(
      0.2 * itc + 0.1 * hea + 0.3 * daf + 0.3 * stb + 0.1 * sld
    );
    const phy = Math.round(0.05 * jmp + 0.25 * stm + 0.5 * str + 0.2 * agr);

    return [
      { subject: "PAC", A: pac, fullMark: 100 },
      { subject: "SHO", A: sho, fullMark: 100 },
      { subject: "PAS", A: pas, fullMark: 100 },
      { subject: "DRI", A: dri, fullMark: 100 },
      { subject: "DEF", A: def, fullMark: 100 },
      { subject: "PHY", A: phy, fullMark: 100 },
    ];
  }, [player]);

  // basic six stats
  const basicStats = useMemo(
    () =>
      Object.fromEntries(radarData.map((r) => [r.subject, r.A])) as Record<
        "PAC" | "SHO" | "PAS" | "DRI" | "DEF" | "PHY",
        number
      >,
    [radarData]
  );

  // stat categories for tabs
  const statCategories: Record<string, (keyof PlayerRow)[]> = {
    Attacking: [
      "crossing",
      "finishing",
      "heading_accuracy",
      "short_passing",
      "volleys",
    ],
    Skill: [
      "dribbling",
      "curve",
      "fk_accuracy",
      "long_passing",
      "ball_control",
    ],
    Movement: [
      "acceleration",
      "sprint_speed",
      "agility",
      "reactions",
      "balance",
    ],
    Power: ["shot_power", "jumping", "stamina", "strength", "long_shots"],
    Mentality: [
      "aggression",
      "interceptions",
      "positioning",
      "vision",
      "penalties",
      "composure",
    ],
    Defending: ["defensive_awareness", "standing_tackle", "sliding_tackle"],
    Goalkeeping: [
      "gk_diving",
      "gk_handling",
      "gk_kicking",
      "gk_positioning",
      "gk_reflexes",
    ],
  };

  const computedWage = useMemo(() => {
    if (!player) return null;
    const rating = player.overall_rating ?? 0;
    const posCsv = player.positions ?? "";
    const wageNum = getWageFromCsv(rating, posCsv);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(wageNum);
  }, [player]);

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder="Search player…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading || !query}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Search
        </button>
      </form>
      {error && <p className="text-red-500">{error}</p>}

      {!player && results.length > 0 && (
        <ul className="space-y-2">
          {results.map((p) => (
            <li key={p.player_id}>
              <button
                onClick={() => loadPlayer(p.player_id)}
                className="w-full flex justify-between px-3 py-2 hover:bg-gray-800 rounded"
              >
                <span>{p.full_name}</span>
                <Badge className={getStatColor(p.overall_rating ?? 0)}>
                  {p.overall_rating}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      {player && (
        <div className="space-y-6">
          <button
            onClick={() => setPlayer(null)}
            className="text-gray-400 hover:underline"
          >
            ← Back to results
          </button>

          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardContent className="flex items-start gap-6">
                <Image
                  src={player.image}
                  alt={player.full_name ?? ""}
                  width={120}
                  height={120}
                  className="rounded-full"
                  unoptimized
                />
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold">{player.full_name}</h2>
                  <div className="flex gap-2 items-center">
                    <Badge className={getStatColor(player.overall_rating ?? 0)}>
                      {player.overall_rating}
                    </Badge>
                    <Badge>{player.positions}</Badge>
                    <span>{player.height_cm} cm</span>
                    <span>{player.weight_kg} kg</span>
                  </div>
                  <p className="text-sm text-gray-400">{player.description}</p>
                  <div>
                    <div className="text-sm text-gray-500">Wage</div>
                    <div className="text-xl font-semibold">{computedWage}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col h-80">
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      data={radarData}
                      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: "#94A3B8", fontSize: 12 }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        axisLine={false}
                        tickCount={5}
                        tick={{ fill: "#94A3B8", fontSize: 10 }}
                      />
                      <Radar
                        dataKey="A"
                        stroke="#22c55e"
                        fill="#22c55e"
                        fillOpacity={0.6}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-6 gap-2 text-center mt-4">
                  {(["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"] as const).map(
                    (key) => (
                      <div key={key} className="flex flex-col items-center">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center ${getStatColor(
                            basicStats[key]
                          )}`}
                        >
                          <span className="font-bold">{basicStats[key]}</span>
                        </div>
                        <span className="mt-1 text-xs">{key}</span>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="Attacking" className="space-y-4">
            <TabsList>
              {Object.keys(statCategories).map((cat) => (
                <TabsTrigger key={cat} value={cat} className="capitalize">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
            {Object.entries(statCategories).map(([cat, keys]) => (
              <TabsContent key={cat} value={cat} className="space-y-2">
                <div className="grid grid-cols-5 gap-4">
                  {keys.map((stat) => (
                    <div
                      key={stat}
                      className="flex items-center space-x-2 p-2 rounded hover:bg-gray-800"
                    >
                      <Badge
                        className={getStatColor(Number(player[stat] ?? 0))}
                      >
                        {player[stat] ?? "–"}
                      </Badge>
                      <span className="capitalize">
                        {stat.replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  );
}
