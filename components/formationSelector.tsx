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
import TeamFormationDisplay from "@/components/TeamFormationDisplay";
import { Images } from "@/lib/assets";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPlayerName } from "@/utils/playerUtils";

interface Player {
  name: string;
  full_name?: string;
  positions: string;
  overall_rating: number;
  image?: string;
  player_id: string;
}

interface FormationSelectorProps {
  teamData?: {
    squad: Player[];
    formation: string;
    averageRating: number;
  };
  onFormationChange?: (formation: string) => void;
  onManageTeamClick?: () => void;
}

const FormationSelector: React.FC<FormationSelectorProps> = ({ 
  teamData, 
  onFormationChange,
  onManageTeamClick 
}) => {
  const formations = Object.keys(formationPositions);
  const [selected, setSelected] = useState<string>(teamData?.formation || formations[0]);
  
  // Use team data if available, otherwise fall back to mock data
  const squad = teamData?.squad || [];
  const averageRating = teamData?.averageRating || 71;
  
  const positions: Position[] = formationPositions[selected];

  const handleFormationChange = (newFormation: string) => {
    setSelected(newFormation);
    onFormationChange?.(newFormation);
  };

  const handleManageTeamClick = () => {
    onManageTeamClick?.();
  };



  return (
    <div className="h-fit flex w-fit flex-col gap-8 bg-gradient-to-t border border-neutral-800 to-[#09090B] from-[#262626] p-4 rounded-lg">
      <div className="flex w-full justify-between items-center">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 items-center">
            <p className="font-bold text-sm">Rating Avg.</p>
            <Badge variant="secondary">{averageRating}</Badge>
          </div>
          <div className="flex gap-2 items-center">
            <p className="font-bold text-sm">Formation</p>
            <Select value={selected} onValueChange={handleFormationChange}>
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
        <Button onClick={handleManageTeamClick}>Manage Team</Button>
      </div>
                    <TeamFormationDisplay
                formation={selected}
                positions={positions}
                players={squad}
                className="w-[556px]"
              />
    </div>
  );
};

export default FormationSelector;
