import type { CSSProperties, FC, ReactNode } from 'react';

interface BaseProps {
  className?: string;
  style?: CSSProperties;
}

export const Box: FC<BaseProps & { width?: string | number; height?: string | number; rounded?: string }> = ({
  width = '100%',
  height = '1rem',
  rounded = 'rounded',
  className = '',
  style,
}) => (
  <div
    className={`bg-gray-200 dark:bg-gray-700 animate-pulse ${rounded} ${className}`}
    style={{ width, height, ...style }}
  />
);

export const Circle: FC<BaseProps & { size?: string | number }> = ({
  size = '2.5rem',
  className = '',
  style,
}) => (
  <div
    className={`bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse flex-shrink-0 ${className}`}
    style={{ width: size, height: size, ...style }}
  />
);

export const Text: FC<BaseProps & { lines?: number; lastWidth?: string }> = ({
  lines = 1,
  lastWidth = '60%',
  className = '',
  style,
}) => (
  <div className={`space-y-2 ${className}`} style={style}>
    {Array.from({ length: lines }, (_, i) => (
      <Box
        key={i}
        height="0.75rem"
        width={i === lines - 1 ? lastWidth : '100%'}
      />
    ))}
  </div>
);

export const Card: FC<BaseProps & { children?: ReactNode }> = ({ children, className = '', style }) => (
  <div
    className={`p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${className}`}
    style={style}
  >
    {children}
  </div>
);

export const Stack: FC<BaseProps & { children?: ReactNode; gap?: number }> = ({
  children,
  gap = 12,
  className = '',
  style,
}) => (
  <div className={className} style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
    {children}
  </div>
);

export const List: FC<BaseProps & { count: number; children?: (i: number) => ReactNode }> = ({
  count,
  children,
  className = '',
  style,
}) => (
  <div className={`space-y-3 ${className}`} style={style}>
    {Array.from({ length: count }, (_, i) => (
      <div key={i}>{children?.(i)}</div>
    ))}
  </div>
);

interface SkeletonPresetProps {
  count?: number;
  className?: string;
}

export const RoadmapCardSkeleton: FC<SkeletonPresetProps> = ({ count = 1, className = '' }) => (
  <List count={count} className={className}>
    {() => (
      <Card>
        <div className="flex items-start gap-4">
          <Circle size="3rem" />
          <div className="flex-1">
            <Box width="60%" height="1.25rem" className="mb-3" />
            <Text lines={2} lastWidth="80%" />
            <Box width="40%" height="0.5rem" className="mt-3" rounded="rounded-full" />
          </div>
        </div>
      </Card>
    )}
  </List>
);

export const DetailPageSkeleton: FC = () => (
  <div className="space-y-6">
    <Box width="40%" height="2rem" />
    <Box width="70%" height="1rem" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      {[0, 1].map((i) => (
        <Card key={i}>
          <Box width="50%" height="1.25rem" className="mb-3" />
          <Text lines={3} />
        </Card>
      ))}
    </div>
  </div>
);

export const ChatMessageSkeleton: FC<{ count?: number }> = ({ count = 2 }) => (
  <List count={count}>
    {(i) => (
      <div className={`flex gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
        <Circle size="2.25rem" />
        <div className="flex-1 max-w-md">
          <Box width="30%" height="0.75rem" className="mb-2" />
          <Box width="100%" height="3rem" rounded="rounded-2xl" />
        </div>
      </div>
    )}
  </List>
);
