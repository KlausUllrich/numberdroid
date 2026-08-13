export function directionIndexForFacing(facing: number) {
  const normalized = ((facing % 360) + 360) % 360;
  return Math.round(normalized / 45) % 8;
}

export function directionClassForFacing(facing: number) {
  return `dir-${directionIndexForFacing(facing)}`;
}
