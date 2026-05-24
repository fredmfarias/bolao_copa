interface SelecaoAvatarProps {
  nome: string;
  bandeiraSvg: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
} as const;

export function SelecaoAvatar({ nome, bandeiraSvg, size = 'md' }: SelecaoAvatarProps) {
  return (
    <img
      src={bandeiraSvg}
      alt={nome}
      className={`${SIZES[size]} rounded-full object-cover flex-shrink-0`}
    />
  );
}
