"use client";

import React, { useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { formationPositions, Position } from "@/lib/formationPositions";
import { Images } from "@/lib/assets";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FormationSelector: React.FC = () => {
  const formations = Object.keys(formationPositions);
  const [selected, setSelected] = useState<string>(formations[0]);
  const positions: Position[] = formationPositions[selected];

  return (
    <div className="h-fit flex w-fit flex-col gap-8 bg-gradient-to-t border border-neutral-800 to-[#09090B] from-[#262626] p-4 rounded-lg">
      <div className="flex w-full justify-between items-center">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 items-center">
            <p className="font-bold text-sm">Rating Avg.</p>
            <Badge variant="secondary">71</Badge>
          </div>
          <div className="flex gap-2 items-center">
            <p className="font-bold text-sm">Formation</p>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Select formation" />
              </SelectTrigger>
              <SelectContent>
                {formations.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button>Manage Team</Button>
      </div>
      <div className="relative w-[556px] h-[400px] rounded-lg overflow-hidden">
        <Image
          src={Images.Field}
          fill
          alt="Football Field"
          className="object-cover"
        />
        {positions.map((pos, idx) => (
          <div
            key={idx}
            className="absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div className="w-10 h-10 bg-blend-saturation rounded-full flex flex-col items-center justify-center">
              <Image
                src={Images.JN}
                height={54}
                width={54}
                alt="Football Field"
                className="object-cover"
              />
              <Badge className="bg-green-700 absolute left-11 bottom-10 rounded-full text-white">
                84
              </Badge>
            </div>
            <p className="text-sm w-fit whitespace-nowrap font-semibold">
              João Neves
            </p>
            <div className="flex items-center px-1 py-0.5 bg-neutral-800 bg-opacity-50">
              <p className="mt-1 text-[10px] text-white uppercase">
                {pos.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FormationSelector;
