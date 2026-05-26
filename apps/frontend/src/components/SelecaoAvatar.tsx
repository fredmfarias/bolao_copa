interface SelecaoAvatarProps {
  nome: string;
  bandeiraSvg: string;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'circle' | 'rect';
}

const SIZES = {
  circle: { sm: 'w-6 h-6', md: 'w-10 h-10', lg: 'w-16 h-16' },
  rect:   { sm: 'w-8 h-6', md: 'w-12 h-9', lg: 'w-14 h-10' },
} as const;

export function SelecaoAvatar({ nome, bandeiraSvg, size = 'md', shape = 'circle' }: SelecaoAvatarProps) {
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-md';
  return (
    <img
      src={bandeiraSvg}
      alt={nome}
      className={`${SIZES[shape][size]} ${radius} object-cover flex-shrink-0`}
    />
  );
}
