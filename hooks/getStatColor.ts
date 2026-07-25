export const getStatColor = (value: number) => {
  if (value < 50) return "bg-red-500 text-white";
  if (value < 65) return "bg-orange-500 text-white";
  if (value < 80) return "bg-yellow-500 text-black";
  if (value < 90) return "bg-lime-300 text-black";
  return "bg-green-700 text-white";
};

export const getStatTextColor = (value: number) => {
  if (value < 50) return "text-red-400";
  if (value < 65) return "text-orange-400";
  if (value < 80) return "text-yellow-400";
  if (value < 90) return "text-lime-400";
  return "text-green-400";
};
