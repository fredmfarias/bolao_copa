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
    <div
      title={nome}
      className={`${SIZES[size]} rounded-full overflow-hidden flex-shrink-0 [&>svg]:w-full [&>svg]:h-full`}
      dangerouslySetInnerHTML={{ __html: bandeiraSvg }}
    />
  );
}
