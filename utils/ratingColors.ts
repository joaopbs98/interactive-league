// FIFA-style rating color scheme
export interface RatingColors {
  background: string;
  text: string;
  border?: string;
}

export function getRatingColors(rating: number): RatingColors {
  if (rating >= 90) {
    // 90-99: Verde escuro
    return {
      background: "bg-green-800",
      text: "text-white",
      border: "border-green-700"
    };
  } else if (rating >= 80) {
    // 80-89: Verde claro
    return {
      background: "bg-green-600",
      text: "text-white", 
      border: "border-green-500"
    };
  } else if (rating >= 65) {
    // 65-79: Amarelo (com texto preto para contraste)
    return {
      background: "bg-yellow-400",
      text: "text-black",
      border: "border-yellow-300"
    };
  } else if (rating >= 50) {
    // 50-64: Laranja
    return {
      background: "bg-orange-500",
      text: "text-white",
      border: "border-orange-400"
    };
  } else {
    // 0-49: Vermelho
    return {
      background: "bg-red-600",
      text: "text-white",
      border: "border-red-500"
    };
  }
}

// Helper function to get rating color classes as a string
export function getRatingColorClasses(rating: number): string {
  const colors = getRatingColors(rating);
  return `${colors.background} ${colors.text} ${colors.border || ''}`;
}

// For Input elements: includes dark: variants so rating colors override Input's dark:bg-input/30
export function getRatingColorClassesForInput(rating: number): string {
  const colors = getRatingColors(rating);
  const bg = colors.background; // e.g. "bg-yellow-400"
  const text = colors.text;     // e.g. "text-black"
  const darkBg = bg.replace(/^bg-/, "dark:bg-");
  const darkText = text.replace(/^text-/, "dark:text-");
  return `${colors.background} ${colors.text} ${darkBg} ${darkText} ${colors.border || ''}`;
}