// app/(dashboard)/team-management/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { toast, Toaster } from "sonner";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

import { formationPositions, Position } from "@/lib/formationPositions";
import { Images } from "@/lib/assets";

// —————————————————————————————————————————
// Mock squad (18 players)
interface Player {
  id: number;
  name: string;
  role: string;
  rating: number;
}
const ALL_PLAYERS: Player[] = [
  { id: 1, name: "João Neves", role: "ST", rating: 82 },
  { id: 2, name: "Maria Gomes", role: "CM", rating: 85 },
  { id: 3, name: "Carlos Silva", role: "CB", rating: 69 },
  { id: 4, name: "Ana Pereira", role: "ST", rating: 91 },
  { id: 5, name: "Pedro Costa", role: "CDM", rating: 70 },
  { id: 6, name: "Sofia Martins", role: "LB", rating: 87 },
  { id: 7, name: "Ricardo Lopes", role: "RM", rating: 76 },
  { id: 8, name: "Inês Rocha", role: "LB", rating: 74 },
  { id: 9, name: "Miguel Duarte", role: "RB", rating: 80 },
  { id: 10, name: "Raquel Freitas", role: "LM", rating: 78 },
  { id: 11, name: "Tiago Alves", role: "GK", rating: 75 },
  { id: 12, name: "Leonor Reis", role: "CM", rating: 73 },
  { id: 13, name: "Bruno Pinto", role: "CB", rating: 70 },
  { id: 14, name: "Filipa Silva", role: "RB", rating: 72 },
  { id: 15, name: "João Sousa", role: "CM", rating: 77 },
  { id: 16, name: "Mariana Costa", role: "CDM", rating: 79 },
  { id: 17, name: "André Melo", role: "ST", rating: 68 },
  { id: 18, name: "Carolina Alves", role: "CAM", rating: 81 },
];

// —————————————————————————————————————————
// Helpers
const avg = (arr: number[]) =>
  arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
const isDef = (l: string) =>
  ["GK", "CB", "LB", "RB", "LWB", "RWB", "WB"].includes(l);
const isMid = (l: string) =>
  ["CDM", "CM", "CAM", "LM", "RM"].some((x) => l.includes(x));
const isAtk = (l: string) =>
  ["ST", "CF", "AM", "FW", "W"].some((x) => l.includes(x));

// —————————————————————————————————————————
// Main component
export default function TeamManagementPage() {
  // Formation & positions
  const forms = Object.keys(formationPositions);
  const [formation, setFormation] = useState(forms[0]);
  const positions: Position[] = formationPositions[formation];

  // Squad state
  const [starting, setStarting] = useState<Player[]>(ALL_PLAYERS.slice(0, 11));
  const [bench, setBench] = useState<Player[]>(ALL_PLAYERS.slice(11, 16));
  const [res, setRes] = useState<Player[]>(ALL_PLAYERS.slice(16));

  // Swap dialog state
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);

  // Compute ratings
  const ratings = useMemo(() => {
    const labs = positions.map((p) => p.label);
    const vals = starting.map((p) => p.rating);
    return {
      overall: avg(vals),
      attack: avg(
        starting.filter((_, i) => isAtk(labs[i])).map((p) => p.rating)
      ),
      midfield: avg(
        starting.filter((_, i) => isMid(labs[i])).map((p) => p.rating)
      ),
      defense: avg(
        starting.filter((_, i) => isDef(labs[i])).map((p) => p.rating)
      ),
    };
  }, [starting, positions]);

  // Swap logic
  function doSwap(pid: number) {
    if (swapIdx === null) return;
    const pool = [...bench, ...res];
    const picked = pool.find((p) => p.id === pid)!;
    const replaced = starting[swapIdx];

    if (bench.some((b) => b.id === pid)) {
      setBench((b) => [...b.filter((x) => x.id !== pid), replaced]);
    } else {
      setRes((r) => [...r.filter((x) => x.id !== pid), replaced]);
    }
    setStarting((s) => {
      const c = [...s];
      c[swapIdx] = picked;
      return c;
    });

    toast.success(`Swapped ${replaced.name} ⇄ ${picked.name}`);
    setSwapOpen(false);
    setSwapIdx(null);
  }

  return (
    <div className="h-full flex flex-col p-6 bg-[#0b0b0d] text-white">
      <Toaster position="top-center" />

      {/* Tabs + Ratings */}
      <Tabs defaultValue="tactics" className="flex-none mb-4">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="tactics">Team Tactics</TabsTrigger>
            <TabsTrigger value="roles" disabled>
              Player Roles
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Badge>AVG {ratings.overall}</Badge>
            <Badge variant="destructive">Atk {ratings.attack}</Badge>
            <Badge variant="default">Mid {ratings.midfield}</Badge>
            <Badge variant="secondary">Def {ratings.defense}</Badge>
          </div>
        </div>

        <TabsContent value="tactics" className="flex-1 flex gap-6">
          {/* Left: Pitch & Controls */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="relative flex-1 rounded-lg border border-neutral-800 overflow-hidden">
              <Image
                src={Images.Field}
                fill
                alt="Field"
                className="object-cover"
              />
              {positions.map((p, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setSwapIdx(i);
                    setSwapOpen(true);
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                >
                  <div className="w-12 h-12 bg-teal-800 rounded-full flex items-center justify-center text-sm font-bold">
                    {starting[i].name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div className="mt-1 text-xs text-center">{p.label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold">Formation:</span>
              <Select value={formation} onValueChange={setFormation}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {forms.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Accordion type="single" collapsible defaultValue="preset">
              <AccordionItem value="preset">
                <AccordionTrigger className="font-semibold">
                  Tactical Preset
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div>
                    <div className="flex justify-between">
                      <span>Build-Up Style</span>
                      <Select defaultValue="Balanced">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Balanced", "Fast", "Slow", "Long Ball"].map(
                            (s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-neutral-400">
                      How you bring the ball out.
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span>Defensive Approach</span>
                      <Select defaultValue="Balanced">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Balanced", "High", "Low", "Press"].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-neutral-400">
                      How you press & track.
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span>Line Height</span>
                      <span className="font-medium">50</span>
                    </div>
                    <Slider defaultValue={[50]} max={100} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Right: Squad in ScrollArea */}
          <ScrollArea className="flex-1 rounded-lg border border-neutral-800">
            <table className="w-full border-separate border-spacing-y-1">
              <thead>
                <tr className="text-left text-sm">
                  <th>Pos</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Rate</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {starting.map((p, i) => (
                  <tr key={p.id} className="bg-teal-900 hover:bg-teal-800">
                    <td className="px-2 py-1">{positions[i].label}</td>
                    <td className="px-2 py-1">{p.name}</td>
                    <td className="px-2 py-1">{p.role}</td>
                    <td className="px-2 py-1">{p.rating}</td>
                    <td className="px-2 py-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSwapIdx(i);
                          setSwapOpen(true);
                        }}
                      >
                        Swap
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className="pt-2 font-medium">
                    Bench
                  </td>
                </tr>
                {bench.map((p) => (
                  <tr
                    key={p.id}
                    className="bg-neutral-800 hover:bg-neutral-700"
                  >
                    <td colSpan={2} className="px-2 py-1 italic text-sm">
                      SUB
                    </td>
                    <td className="px-2 py-1">{p.role}</td>
                    <td className="px-2 py-1">{p.rating}</td>
                    <td className="px-2 py-1"></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className="pt-2 font-medium">
                    Reserves
                  </td>
                </tr>
                {res.map((p) => (
                  <tr
                    key={p.id}
                    className="bg-neutral-700 hover:bg-neutral-600"
                  >
                    <td colSpan={2} className="px-2 py-1 italic text-sm">
                      RES
                    </td>
                    <td className="px-2 py-1">{p.role}</td>
                    <td className="px-2 py-1">{p.rating}</td>
                    <td className="px-2 py-1"></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Swap Dialog */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select a Bench or Reserve player</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {bench.length > 0 && (
              <>
                <h3 className="font-semibold">Bench</h3>
                <div className="grid grid-cols-3 gap-2">
                  {bench.map((p) => (
                    <div
                      key={p.id}
                      className="p-2 bg-neutral-800 rounded hover:bg-neutral-700 cursor-pointer flex justify-between"
                      onClick={() => doSwap(p.id)}
                    >
                      <span className="text-sm">{p.name}</span>
                      <Badge>{p.rating}</Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
            {res.length > 0 && (
              <>
                <h3 className="font-semibold pt-4">Reserves</h3>
                <div className="grid grid-cols-2 gap-2">
                  {res.map((p) => (
                    <div
                      key={p.id}
                      className="p-2 bg-neutral-700 rounded hover:bg-neutral-600 cursor-pointer flex justify-between"
                      onClick={() => doSwap(p.id)}
                    >
                      <span className="text-sm">{p.name}</span>
                      <Badge>{p.rating}</Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <DialogFooter className="justify-end pt-4">
            <Button variant="outline" onClick={() => setSwapOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
