import type { ReactNode } from 'react';
import { useMemo, useRef } from 'react';
import { Animated, Pressable, type PressableProps, type ViewStyle } from 'react-native';
import type { ThemeColors } from '../theme/colors';
import { surfaceCard } from '../theme/tokens';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  colors: ThemeColors;
  elevated?: boolean;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle | ViewStyle[];
  children?: ReactNode;
};

export function PressableCard({ colors, elevated = true, style, contentStyle, children, ...props }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const baseStyle = useMemo(() => {
    const extra = Array.isArray(style) ? style : style ? [style] : [];
    return [surfaceCard(colors, elevated), ...extra];
  }, [colors, elevated, style]);

  return (
    <Pressable
      onPressIn={(e) => {
        Animated.spring(scale, { toValue: 0.985, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
        props.onPressOut?.(e);
      }}
      {...props}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            ...baseStyle,
            { transform: [{ scale }], opacity: pressed ? 0.95 : 1 },
            contentStyle,
          ]}
        >
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}

