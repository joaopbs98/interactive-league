// Format player name to show only first and last word
export const formatPlayerName = (fullName: string): string => {
  if (!fullName) return "Unknown Player";
  
  const words = fullName.trim().split(' ');
  
  if (words.length <= 2) {
    return fullName;
  }
  
  // Return first and last word
  return `${words[0]} ${words[words.length - 1]}`;
};

// Get initials from full name
export const getPlayerInitials = (fullName: string): string => {
  if (!fullName) return "UN";
  
  const words = fullName.trim().split(' ');
  
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  
  // Return first letter of first and last word
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}; 