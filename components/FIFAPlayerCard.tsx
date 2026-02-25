"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Users, Trash2, ListPlus } from 'lucide-react';
import { Images } from '@/lib/assets';
import { getStatColor } from '@/hooks/getStatColor';

interface Player {
  player_id: string;
  name: string;
  full_name?: string;
  positions: string;
  overall_rating: number;
  age?: number;
  wage?: number;
  image?: string;
  country_name?: string;
  pace?: number;
  shooting?: number;
  passing?: number;
  dribbling?: number;
  defending?: number;
  physical?: number;
}

interface FIFAPlayerCardProps {
  player: Player;
  onMoveToSquad?: (playerId: string) => void;
  onAddToTransferList?: (playerId: string) => void;
  onRelease?: (playerId: string) => void;
  showActions?: boolean;
  compact?: boolean;
  /** Stagger animation delay for pack reveal (ms) */
  revealDelay?: number;
  className?: string;
}

export function FIFAPlayerCard({ 
  player, 
  onMoveToSquad, 
  onAddToTransferList,
  onRelease, 
  showActions = true,
  compact = false,
  revealDelay = 0,
  className = "" 
}: FIFAPlayerCardProps) {
  // Determine card color based on rating
  const getCardColor = (rating: number) => {
    if (rating >= 75) {
      return {
        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
        border: '2px solid #FFD700',
        textColor: '#000',
        statColor: '#8B4513'
      };
    } else if (rating >= 65) {
      return {
        background: 'linear-gradient(135deg, #C0C0C0 0%, #A9A9A9 50%, #808080 100%)',
        border: '2px solid #C0C0C0',
        textColor: '#000',
        statColor: '#2F4F4F'
      };
    } else {
      return {
        background: 'linear-gradient(135deg, #CD7F32 0%, #B8860B 50%, #DAA520 100%)',
        border: '2px solid #CD7F32',
        textColor: '#000',
        statColor: '#8B4513'
      };
    }
  };

  const cardStyle = getCardColor(player.overall_rating);

  // Get position group for color coding
  const getPositionColor = (position: string) => {
    const pos = position.toUpperCase();
    if (pos === 'GK') return 'bg-yellow-500';
    if (['CB', 'LB', 'RB'].includes(pos)) return 'bg-blue-500';
    if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'bg-green-500';
    if (['LW', 'RW', 'ST', 'CF'].includes(pos)) return 'bg-red-500';
    return 'bg-gray-500';
  };

  const imageSrc = player.image?.startsWith("http")
    ? `/api/proxy-image?url=${encodeURIComponent(player.image)}`
    : player.image || Images.NoImage.src;

  const displayName = player.full_name || player.name;
  const ratingColorClass = getStatColor(player.overall_rating);

  return (
    <Card 
      className={`relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${className}`}
      style={{
        background: cardStyle.background,
        border: cardStyle.border,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        animation: revealDelay > 0 ? `fadeInUp 0.5s ease-out ${revealDelay}ms both` : undefined,
      } as React.CSSProperties}
    >
      <CardContent className="p-4">
        {/* Player Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-muted">
              <img
                src={imageSrc}
                alt={displayName}
                width={48}
                height={48}
                className="object-cover w-full h-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = Images.NoImage.src;
                }}
              />
            </div>
            <div className="min-w-0">
              <h3 
                className="font-bold text-lg truncate"
                style={{ color: cardStyle.textColor }}
              >
                {displayName}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge 
                  className={`${getPositionColor(player.positions)} text-white text-xs font-bold`}
                >
                  {player.positions}
                </Badge>
                {player.country_name && (
                  <span 
                    className="text-xs font-medium opacity-90"
                    style={{ color: cardStyle.textColor }}
                    title={player.country_name}
                  >
                    {player.country_name}
                  </span>
                )}
                {player.age != null && (
                  <span 
                    className="text-sm font-semibold"
                    style={{ color: cardStyle.textColor }}
                  >
                    {player.age} years
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Overall Rating - color-coded by quality */}
          <div className="text-right shrink-0">
            <div 
              className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-lg text-2xl font-bold ${ratingColorClass}`}
            >
              {player.overall_rating}
            </div>
            <div className="text-xs font-semibold mt-0.5" style={{ color: cardStyle.textColor }}>OVERALL</div>
          </div>
        </div>

        {/* Player Stats - hide in compact mode */}
        {!compact && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {player.pace !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold" style={{ color: cardStyle.statColor }}>PAC</span>
              <span className="text-sm font-bold" style={{ color: cardStyle.textColor }}>{player.pace}</span>
            </div>
          )}
          {player.shooting !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold" style={{ color: cardStyle.statColor }}>SHO</span>
              <span className="text-sm font-bold" style={{ color: cardStyle.textColor }}>{player.shooting}</span>
            </div>
          )}
          {player.passing !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold" style={{ color: cardStyle.statColor }}>PAS</span>
              <span className="text-sm font-bold" style={{ color: cardStyle.textColor }}>{player.passing}</span>
            </div>
          )}
          {player.dribbling !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold" style={{ color: cardStyle.statColor }}>DRI</span>
              <span className="text-sm font-bold" style={{ color: cardStyle.textColor }}>{player.dribbling}</span>
            </div>
          )}
          {player.defending !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold" style={{ color: cardStyle.statColor }}>DEF</span>
              <span className="text-sm font-bold" style={{ color: cardStyle.textColor }}>{player.defending}</span>
            </div>
          )}
          {player.physical !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold" style={{ color: cardStyle.statColor }}>PHY</span>
              <span className="text-sm font-bold" style={{ color: cardStyle.textColor }}>{player.physical}</span>
            </div>
          )}
        </div>
        )}

        {/* Wage - hide in compact mode */}
        {!compact && (
        <div className="text-center mb-3">
          <span 
            className="text-xs font-semibold"
            style={{ color: cardStyle.statColor }}
          >
            €{player.wage ? player.wage.toLocaleString() : 
               (player.overall_rating && player.positions ? 
                calculateWage(player.overall_rating, player.positions) : 
                '0')}/week
          </span>
        </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 w-8 p-0"
                  style={{ color: cardStyle.textColor }}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onMoveToSquad && (
                  <DropdownMenuItem onClick={() => onMoveToSquad(player.player_id)}>
                    <Users className="mr-2 h-4 w-4" />
                    Move to Squad
                  </DropdownMenuItem>
                )}
                {onAddToTransferList && (
                  <DropdownMenuItem onClick={() => onAddToTransferList(player.player_id)}>
                    <ListPlus className="mr-2 h-4 w-4" />
                    Transfer List
                  </DropdownMenuItem>
                )}
                {onRelease && (
                  <DropdownMenuItem 
                    onClick={() => onRelease(player.player_id)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Release Player
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to calculate wage based on rating and position
function calculateWage(rating: number, positions: string): string {
  // Import wage calculation logic
  const { wageTable } = require('@/lib/wageTable');
  
  // Safety check for undefined parameters
  if (!rating || !positions) {
    return '0';
  }
  
  // Determine if player is defender (CB, LB, RB, CDM)
  const isDefender = positions.includes('CB') || positions.includes('LB') || positions.includes('RB') || positions.includes('CDM');
  
  // Get base wage from wage table
  const baseWage = wageTable[rating] || wageTable[65]; // Default to 65 rating if not found
  
  // Return appropriate wage based on position (wageTable uses 'def' and 'att')
  const weeklyWage = isDefender ? baseWage.def : baseWage.att;
  
  return weeklyWage.toLocaleString();
} 